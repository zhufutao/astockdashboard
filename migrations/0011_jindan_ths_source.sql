ALTER TABLE jindan_assets RENAME TO jindan_assets_old;

CREATE TABLE IF NOT EXISTS jindan_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'index', 'etf', 'crypto', 'commodity', 'other')),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'A股',
  data_source TEXT NOT NULL CHECK (data_source IN ('tushare_daily', 'tushare_index_daily', 'tushare_fund_daily', 'ths_index_daily', 'binance_daily', 'yahoo_chart')),
  enabled INTEGER NOT NULL DEFAULT 1,
  highlighted INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, market)
);

INSERT INTO jindan_assets (
  id, asset_type, name, code, market, data_source, enabled, highlighted, sort_order, created_at, updated_at
)
SELECT id, asset_type, name, code, market, data_source, enabled, highlighted, sort_order, created_at, updated_at
FROM jindan_assets_old;

DROP TABLE jindan_assets_old;

CREATE INDEX IF NOT EXISTS idx_jindan_assets_enabled ON jindan_assets(enabled, sort_order, id);
