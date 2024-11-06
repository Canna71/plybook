// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// https://surrealdb.com/docs/surrealdb/embedding/rust
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use surrealdb::RecordId;
use surrealdb::Surreal;
use surrealdb::engine::local::RocksDb;

use surrealdb::Surreal;
use tauri::State;

// Wrap database connection in a managed state
struct DatabaseConnection(Mutex<Option<Surreal<Db>>>);

#[tauri::command]
async fn init_db(db_state: State<'_, DatabaseConnection>) -> Result<String, String> {
    let db = Surreal::new::<Db>("file://database.db")
        .await
        .map_err(|e| e.to_string())?;

    // Use the 'test' namespace and database
    db.use_ns("test")
        .use_db("test")
        .await
        .map_err(|e| e.to_string())?;

    // Store the database connection
    *db_state.0.lock().unwrap() = Some(db);

    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
async fn create_record(
    db_state: State<'_, DatabaseConnection>,
    table: String,
    data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let db = db_state.0.lock().unwrap();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let created: serde_json::Value = db
        .create((&table,))
        .content(data)
        .await
        .map_err(|e| e.to_string())?;

    Ok(created)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DatabaseConnection(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
