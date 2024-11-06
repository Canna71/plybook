// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// https://surrealdb.com/docs/surrealdb/embedding/rust
use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use tokio::sync::Mutex;
use surrealdb::RecordId;
use surrealdb::Surreal;
use surrealdb::engine::local::RocksDb;


use tauri::State;

// Wrap database connection in a managed state
struct DatabaseConnection(Mutex<Option<Surreal<Db>>>);

#[tauri::command]
// #[tokio::main]
async fn init_db(db_state: State<'_, DatabaseConnection>) -> Result<String, String> {
    
    // Create database connection using RocksDB
    let db = Surreal::new::<RocksDb>("db").await
    .map_err(|e| e.to_string())?;
    
    

    // Use the 'test' namespace and database
    db.use_ns("test")
        .use_db("test")
        .await
        .map_err(|e| e.to_string())?;

    // Store the database connection
    *db_state.0.lock().await = Some(db);

    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
// #[tokio::main]
async fn create_record(
    db_state: State<'_, DatabaseConnection>,
    table: String,
    data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let created: serde_json::Value = db
        .create(table.as_str())
        .content(data)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Failed to create record")?;

    Ok(created)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DatabaseConnection(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, init_db, create_record])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
