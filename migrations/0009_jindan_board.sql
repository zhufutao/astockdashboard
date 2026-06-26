CREATE TABLE IF NOT EXISTS jindan_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'index', 'etf', 'crypto', 'commodity', 'other')),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'A股',
  data_source TEXT NOT NULL CHECK (data_source IN ('tushare_daily', 'tushare_index_daily', 'tushare_fund_daily', 'binance_daily')),
  enabled INTEGER NOT NULL DEFAULT 1,
  highlighted INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, market)
);

CREATE TABLE IF NOT EXISTS jindan_daily_bars (
  asset_id TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  close REAL NOT NULL,
  pre_close REAL,
  pct_chg REAL,
  volume REAL,
  amount REAL,
  source TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(asset_id, trade_date)
);

CREATE TABLE IF NOT EXISTS jindan_snapshots (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_date)
);

CREATE TABLE IF NOT EXISTS jindan_snapshot_rows (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  rank INTEGER,
  previous_rank INTEGER,
  rank_change INTEGER,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  highlighted INTEGER NOT NULL DEFAULT 0,
  pct_chg REAL,
  close REAL,
  ma20 REAL,
  deviation_pct REAL,
  volume_ratio REAL,
  trend_state TEXT NOT NULL CHECK (trend_state IN ('strong', 'weak', 'unknown')),
  state_changed_at TEXT,
  interval_pct REAL,
  actual_trade_date TEXT,
  source_status TEXT NOT NULL CHECK (source_status IN ('ok', 'failed', 'insufficient')),
  source_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_jindan_assets_enabled ON jindan_assets(enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_jindan_bars_asset_date ON jindan_daily_bars(asset_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_jindan_snapshots_report_date ON jindan_snapshots(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_jindan_rows_snapshot_rank ON jindan_snapshot_rows(snapshot_id, rank);
