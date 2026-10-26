use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Row, SqlitePool};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Default)]
pub struct StorageLock(tokio::sync::Mutex<()>);

#[derive(Deserialize)]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub values: Vec<Value>,
}

pub async fn apply_transaction(
    pool: &SqlitePool,
    statements: Vec<Statement>,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.values {
            query = match value {
                Value::Null => query.bind(Option::<String>::None),
                Value::Bool(v) => query.bind(v),
                Value::String(v) => query.bind(v),
                Value::Number(v) if v.is_i64() => query.bind(v.as_i64().unwrap()),
                Value::Number(v) => query.bind(v.as_f64().ok_or("Número inválido")?),
                _ => return Err("Parâmetro SQL inválido".into()),
            };
        }
        query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}

async fn pool(instances: &DbInstances) -> Result<SqlitePool, String> {
    let instances = instances.0.read().await;
    match instances.get("sqlite:agrohacka.db") {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("Abra o SQLite antes de executar esta operação.".into()),
    }
}

#[tauri::command]
pub async fn execute_transaction(
    instances: State<'_, DbInstances>,
    lock: State<'_, StorageLock>,
    statements: Vec<Statement>,
) -> Result<(), String> {
    let _guard = lock.0.lock().await;
    apply_transaction(&pool(&instances).await?, statements).await
}

pub fn safe_backup_name(name: &str) -> bool {
    if let Some(date) = name
        .strip_prefix("backup-")
        .and_then(|s| s.strip_suffix(".db"))
    {
        return date.len() == 10
            && date.chars().enumerate().all(|(i, c)| {
                if i == 4 || i == 7 {
                    c == '-'
                } else {
                    c.is_ascii_digit()
                }
            });
    }
    if let Some(stamp) = name
        .strip_prefix("pre-restore-")
        .and_then(|s| s.strip_suffix(".db"))
    {
        return !stamp.is_empty() && stamp.chars().all(|c| c.is_ascii_digit());
    }
    false
}

pub async fn backup_database(pool: &SqlitePool, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        return Ok(());
    }
    sqlx::query("VACUUM main INTO ?")
        .bind(destination.to_string_lossy().as_ref())
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn restore_database(
    pool: &SqlitePool,
    source: &Path,
    recovery: &Path,
) -> Result<(), String> {
    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(source)
        .read_only(true);
    let check = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| e.to_string())?;
    let integrity: String = sqlx::query("PRAGMA quick_check")
        .fetch_one(&check)
        .await
        .map_err(|e| e.to_string())?
        .get(0);
    if integrity != "ok" {
        check.close().await;
        return Err("Backup corrompido.".into());
    }
    let mut statements = vec![];
    for table in ["sync_outbox", "movements", "alerts", "products"] {
        statements.push(Statement {
            sql: format!("DELETE FROM {table}"),
            values: vec![],
        });
    }
    statements.push(Statement {
        sql: "DELETE FROM app_config WHERE key <> 'session'".into(),
        values: vec![],
    });
    // Tables and columns are a fixed allowlist, never supplied by the webview.
    for (table, columns) in [
        ("products", vec!["id", "farm_id", "payload"]),
        ("movements", vec!["id", "farm_id", "product_id", "payload"]),
        (
            "sync_outbox",
            vec!["id", "farm_id", "payload", "created_at"],
        ),
        ("alerts", vec!["id", "farm_id", "payload"]),
        ("app_config", vec!["key", "value"]),
    ] {
        let filter = if table == "app_config" {
            " WHERE key <> 'session'"
        } else {
            ""
        };
        let select = format!("SELECT {} FROM {table}{filter}", columns.join(","));
        let rows = sqlx::query(&select)
            .fetch_all(&check)
            .await
            .map_err(|_| "Backup incompatível com esta versão do aplicativo.".to_string())?;
        for row in rows {
            let values = columns
                .iter()
                .map(|column| {
                    row.try_get::<String, _>(*column)
                        .map(Value::String)
                        .map_err(|e| e.to_string())
                })
                .collect::<Result<Vec<_>, _>>()?;
            let placeholders = vec!["?"; columns.len()].join(",");
            statements.push(Statement {
                sql: format!(
                    "INSERT INTO {table}({}) VALUES ({placeholders})",
                    columns.join(",")
                ),
                values,
            });
        }
    }
    check.close().await;
    backup_database(pool, recovery).await?;
    apply_transaction(pool, statements).await
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    directory.canonicalize().map_err(|e| e.to_string())
}

pub fn prune_daily_backups(directory: &Path, cutoff: &str) -> Result<(), String> {
    let root = directory.canonicalize().map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !safe_backup_name(&name) || !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        if name.starts_with("backup-") && &name[7..17] < cutoff {
            let target = entry.path().canonicalize().map_err(|e| e.to_string())?;
            if target.parent() != Some(root.as_path()) {
                return Err("Caminho de backup inválido.".into());
            }
            std::fs::remove_file(target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct BackupInfo {
    name: String,
    size: u64,
}

#[tauri::command]
pub async fn create_backup(
    app: tauri::AppHandle,
    instances: State<'_, DbInstances>,
    lock: State<'_, StorageLock>,
) -> Result<(), String> {
    let _guard = lock.0.lock().await;
    let pool = pool(&instances).await?;
    let today: String = sqlx::query("SELECT date('now','localtime')")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?
        .get(0);
    let directory = backup_dir(&app)?;
    backup_database(&pool, &directory.join(format!("backup-{today}.db"))).await?;
    let cutoff: String = sqlx::query("SELECT date('now','localtime','-6 days')")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?
        .get(0);
    prune_daily_backups(&directory, &cutoff)?;
    for entry in std::fs::read_dir(&directory).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !safe_backup_name(&name) || !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        let old_recovery = name.starts_with("pre-restore-")
            && entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| SystemTime::now().duration_since(t).ok())
                .is_some_and(|age| age.as_secs() >= 7 * 86_400);
        if old_recovery {
            let target = entry.path().canonicalize().map_err(|e| e.to_string())?;
            if target.parent() != Some(directory.as_path()) {
                return Err("Caminho de backup inválido.".into());
            }
            std::fs::remove_file(target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let mut result = vec![];
    for entry in std::fs::read_dir(backup_dir(&app)?).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if safe_backup_name(&name) && entry.file_type().map_err(|e| e.to_string())?.is_file() {
            result.push(BackupInfo {
                name,
                size: entry.metadata().map_err(|e| e.to_string())?.len(),
            });
        }
    }
    result.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(result)
}

#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    instances: State<'_, DbInstances>,
    lock: State<'_, StorageLock>,
    name: String,
) -> Result<(), String> {
    if !safe_backup_name(&name) {
        return Err("Nome de backup inválido.".into());
    }
    let _guard = lock.0.lock().await;
    let directory = backup_dir(&app)?;
    let source = directory
        .join(name)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if source.parent() != Some(directory.as_path()) {
        return Err("Caminho de backup inválido.".into());
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_micros();
    restore_database(
        &pool(&instances).await?,
        &source,
        &directory.join(format!("pre-restore-{stamp}.db")),
    )
    .await
}
