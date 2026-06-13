CREATE TABLE IF NOT EXISTS foundation_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'other')),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'A股',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  current_price REAL,
  price_source TEXT,
  price_status TEXT NOT NULL DEFAULT 'pending' CHECK (price_status IN ('pending', 'ok', 'failed', 'manual')),
  price_error TEXT,
  price_updated_at TEXT,
  no_chase_min REAL,
  observe_min REAL,
  observe_max REAL,
  reasonable_min REAL,
  reasonable_max REAL,
  safe_min REAL,
  safe_max REAL,
  bargain_min REAL,
  bargain_max REAL,
  stop_loss REAL,
  reduce_min REAL,
  reduce_max REAL,
  sell_min REAL,
  sell_max REAL,
  keep_min REAL,
  conclusion TEXT NOT NULL DEFAULT '只观察',
  analysis_markdown TEXT NOT NULL DEFAULT '',
  analysis_json TEXT NOT NULL DEFAULT '{}',
  analysis_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, market)
);

CREATE TABLE IF NOT EXISTS foundation_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO foundation_settings (key, value) VALUES ('refresh_seconds', '15');
