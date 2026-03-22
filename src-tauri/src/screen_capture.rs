use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::jpeg::JpegEncoder;
use screenshots::Screenshots;
use std::io::Cursor;
use tauri::WebviewWindow;

#[tauri::command]
pub fn capture_screen(
    window: WebviewWindow,
    quality: Option<u8>,
    max_width: Option<u32>,
) -> Result<String, String> {
    if window.label() != "overlay" {
        return Err("Screen capture is only available from the overlay window".into());
    }

    let quality = quality.unwrap_or(70);
    let max_width = max_width.unwrap_or(1920);

    let screens = Screenshots::all();
    let screen = screens
        .into_iter()
        .next()
        .ok_or_else(|| "No screens found".to_string())?;

    let capture = screen
        .capture()
        .ok_or_else(|| "Failed to capture screen".to_string())?;

    // The screenshots crate returns a PNG-encoded buffer
    let png_bytes = capture.buffer();

    let mut img = image::load_from_memory_with_format(&png_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to decode PNG: {}", e))?;

    // Resize if wider than max_width
    if img.width() > max_width {
        let ratio = max_width as f64 / img.width() as f64;
        let new_height = (img.height() as f64 * ratio) as u32;
        img = img.resize_exact(max_width, new_height, image::imageops::FilterType::Triangle);
    }

    // Encode as JPEG
    let mut buf = Cursor::new(Vec::new());
    let encoder = JpegEncoder::new_with_quality(&mut buf, quality);
    img.write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    // Base64 encode
    let b64 = STANDARD.encode(buf.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", b64))
}
