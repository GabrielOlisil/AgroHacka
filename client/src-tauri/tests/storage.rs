use app_lib::storage::{
    Statement, apply_transaction, backup_database, prune_daily_backups, restore_database,
    safe_backup_name,
};
use serde_json::json;
use sqlx::{Row, sqlite::SqlitePoolOptions};

#[tokio::test]
async fn batch_is_atomic_and_preserves_bound_values() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../migrations/001_offline.sql"))
        .execute(&pool)
        .await
        .unwrap();
    let statements = vec![
        Statement {
            sql: "INSERT INTO app_config(key,value) VALUES (?,?)".into(),
            values: vec![json!("name"), json!("O'Brien; DROP TABLE products;")],
        },
        Statement {
            sql: "INSERT INTO missing_table VALUES (?)".into(),
            values: vec![json!(1)],
        },
    ];
    assert!(apply_transaction(&pool, statements).await.is_err());
    let count: i64 = sqlx::query("SELECT COUNT(*) FROM app_config")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}

#[tokio::test]
async fn sqlite_backup_restores_data_and_keeps_a_recovery_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("live.db");
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&path)
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../migrations/001_offline.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO app_config(key,value) VALUES ('test','original')")
        .execute(&pool)
        .await
        .unwrap();
    let backup = dir.path().join("backup-2026-10-16.db");
    backup_database(&pool, &backup).await.unwrap();
    sqlx::query("UPDATE app_config SET value='changed' WHERE key='test'")
        .execute(&pool)
        .await
        .unwrap();
    let recovery = dir.path().join("pre-restore-1.db");
    restore_database(&pool, &backup, &recovery).await.unwrap();
    let value: String = sqlx::query("SELECT value FROM app_config WHERE key='test'")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(value, "original");
    assert!(recovery.exists());
}

#[test]
fn backup_names_cannot_escape_the_app_directory() {
    for name in [
        "../live.db",
        "C:\\live.db",
        "",
        "backup-evil/other.db",
        "live.db",
        "backup-test.txt",
    ] {
        assert!(!safe_backup_name(name));
    }
    assert!(safe_backup_name("backup-2026-10-16.db"));
    assert!(safe_backup_name("pre-restore-1792200000.db"));
}

#[test]
fn retention_removes_only_daily_backups_older_than_the_cutoff() {
    let directory = tempfile::tempdir().unwrap();
    for name in [
        "backup-2026-10-08.db",
        "backup-2026-10-09.db",
        "backup-2026-10-10.db",
        "backup-2026-10-16.db",
        "unrelated.db",
        "pre-restore-123.db",
    ] {
        std::fs::write(directory.path().join(name), b"test fixture").unwrap();
    }
    prune_daily_backups(directory.path(), "2026-10-10").unwrap();
    assert!(!directory.path().join("backup-2026-10-08.db").exists());
    assert!(!directory.path().join("backup-2026-10-09.db").exists());
    for name in [
        "backup-2026-10-10.db",
        "backup-2026-10-16.db",
        "unrelated.db",
        "pre-restore-123.db",
    ] {
        assert!(directory.path().join(name).exists());
    }
}

#[tokio::test]
async fn incompatible_backup_does_not_replace_live_data() {
    let dir = tempfile::tempdir().unwrap();
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../migrations/001_offline.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO app_config(key,value) VALUES ('test','original')")
        .execute(&pool)
        .await
        .unwrap();
    let source = dir.path().join("backup-2026-10-16.db");
    let invalid = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&source)
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::query("CREATE TABLE unrelated(id TEXT)")
        .execute(&invalid)
        .await
        .unwrap();
    invalid.close().await;
    assert!(
        restore_database(&pool, &source, &dir.path().join("pre-restore-1.db"))
            .await
            .is_err()
    );
    let value: String = sqlx::query("SELECT value FROM app_config WHERE key='test'")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(value, "original");
}
