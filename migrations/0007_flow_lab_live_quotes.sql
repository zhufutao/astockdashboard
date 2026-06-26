CREATE TABLE IF NOT EXISTS flow_lab_live_quotes (
  code TEXT PRIMARY KEY,
  price REAL,
  pre_close REAL,
  pct_chg REAL,
  quote_time TEXT,
  trade_date TEXT,
  source TEXT NOT NULL DEFAULT 'ths',
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flow_lab_live_quotes_updated
  ON flow_lab_live_quotes(updated_at DESC);
