//! Muskugou native bridge.
//!
//! The KuGou protocol layer (signing, cookies, module parameter maps) lives in
//! the webview. This module only provides a thin, CORS-free HTTP transport so
//! the exact same TypeScript code can run on desktop, Android and iOS.
//! Set-Cookie headers are forwarded verbatim because the WebView `fetch` API
//! hides them from JavaScript.

use std::collections::HashMap;
use std::time::Duration;

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tauri::State;

struct HttpState {
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequest {
    method: String,
    url: String,
    #[serde(default)]
    headers: Vec<(String, String)>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    body_base64: Option<String>,
    #[serde(default)]
    response_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    set_cookies: Vec<String>,
    body: String,
}

#[tauri::command]
async fn http_request(
    state: State<'_, HttpState>,
    request: HttpRequest,
) -> Result<HttpResponse, String> {
    let method = reqwest::Method::from_bytes(request.method.to_uppercase().as_bytes())
        .map_err(|e| format!("invalid http method: {e}"))?;

    let mut builder = state.client.request(method, &request.url);

    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }

    if let Some(encoded) = request.body_base64 {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| format!("invalid base64 body: {e}"))?;
        builder = builder.body(bytes);
    } else if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = response.status().as_u16();

    let mut headers: HashMap<String, String> = HashMap::new();
    for (name, value) in response.headers().iter() {
        headers
            .entry(name.as_str().to_string())
            .or_insert_with(|| value.to_str().unwrap_or_default().to_string());
    }

    let set_cookies: Vec<String> = response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok().map(str::to_owned))
        .collect();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("failed to read response body: {e}"))?;

    let body = if request.response_type.as_deref() == Some("base64") {
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    } else {
        String::from_utf8_lossy(&bytes).to_string()
    };

    Ok(HttpResponse {
        status,
        headers,
        set_cookies,
        body,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .expect("failed to build the http client");

    tauri::Builder::default()
        .manage(HttpState { client })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![http_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
