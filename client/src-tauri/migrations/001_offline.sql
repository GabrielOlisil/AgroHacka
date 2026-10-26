CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY (farm_id, id)
);
CREATE TABLE IF NOT EXISTS movements (
  id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY (farm_id, id),
  FOREIGN KEY (farm_id, product_id) REFERENCES products(farm_id, id)
);
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (farm_id, id),
  FOREIGN KEY (farm_id, id) REFERENCES movements(farm_id, id)
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY (farm_id, id)
);
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(farm_id, product_id);
CREATE INDEX IF NOT EXISTS idx_outbox_farm ON sync_outbox(farm_id, created_at);
