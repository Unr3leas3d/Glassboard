use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::jpeg::JpegEncoder;
use image::DynamicImage;
use std::io::Cursor;
use tauri::WebviewWindow;
use xcap::Monitor;

#[derive(serde::Serialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[tauri::command]
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
    let infos = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i,
            name: m.name().unwrap_or_else(|_| format!("Monitor {}", i + 1)),
            width: m.width().unwrap_or(0),
            height: m.height().unwrap_or(0),
            is_primary: m.is_primary().unwrap_or(false),
        })
        .collect();
    Ok(infos)
}

#[tauri::command]
pub fn capture_screen(
    window: WebviewWindow,
    quality: Option<u8>,
    max_width: Option<u32>,
    monitor_index: Option<usize>,
) -> Result<String, String> {
    if window.label() != "overlay" {
        return Err("Screen capture is only available from the overlay window".into());
    }

    let quality = quality.unwrap_or(70);
    let max_width = max_width.unwrap_or(1920);

    let monitors = Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    let monitor = match monitor_index {
        Some(idx) => monitors
            .into_iter()
            .nth(idx)
            .ok_or_else(|| format!("Monitor index {} not found", idx))?,
        None => monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .or_else(|| {
                Monitor::all()
                    .ok()
                    .and_then(|m| m.into_iter().next())
            })
            .ok_or_else(|| "No monitors found".to_string())?,
    };

    // xcap returns RgbaImage directly — no intermediate PNG decode needed
    let rgba = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    let mut img = DynamicImage::from(rgba);

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
