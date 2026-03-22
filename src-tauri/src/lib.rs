mod screen_capture;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the management window when a second instance is launched
            if let Some(w) = app.get_webview_window("management") {
                let _ = w.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            greet,
            screen_capture::capture_screen,
            screen_capture::list_monitors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
