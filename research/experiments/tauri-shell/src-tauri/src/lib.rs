// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P1.5.2 Tauri shell. The window loads the unchanged P1.4.1 page (frontendDist) and an
// initialization script (dist-shell/shell.js) that records capabilities and Ollama access.
use base64::Engine;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const SHELL_JS: &str = include_str!("../../dist-shell/shell.js");

fn report_dir() -> PathBuf {
    std::env::var("HELIX_REPORT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("helix-tauri-shell"))
}

/// Writes a file sent by the webview into the report directory (file name only, no paths).
#[tauri::command]
fn save_file(name: String, base64: String) -> Result<String, String> {
    if name.contains('/') || name.contains("..") {
        return Err("invalid name".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| e.to_string())?;
    let dir = report_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

/// Option B for local AI: a Rust command that calls Ollama. The webview never sees the URL.
#[tauri::command]
async fn ollama_chat(body: String) -> Result<String, String> {
    let client = tauri_plugin_http::reqwest::Client::new();
    let res = client
        .post("http://localhost:11434/api/chat")
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    res.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
fn done(app: AppHandle) {
    if std::env::var("HELIX_AUTOQUIT").as_deref() == Ok("1") {
        app.exit(0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![save_file, ollama_chat, done])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Helix P1.5.2: Mol* in WKWebView")
                .inner_size(1280.0, 800.0)
                .initialization_script(SHELL_JS)
                .build()?;
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
