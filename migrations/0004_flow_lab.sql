CREATE TABLE IF NOT EXISTS flow_lab_runs (
  id TEXT PRIMARY KEY,
  strategy_version TEXT NOT NULL DEFAULT 'v1-paper',
  captured_at TEXT NOT NULL,
  market_state TEXT NOT NULL DEFAULT 'unknown',
  data_status TEXT NOT NULL DEFAULT 'pending',
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(captured_at)
);

CREATE TABLE IF NOT EXISTS flow_lab_candidates (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  board TEXT NOT NULL DEFAULT '主板',
  score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'watch',
  source_agreement INTEGER NOT NULL DEFAULT 0,
  price REAL,
  vwap REAL,
  industry TEXT,
  concept_cluster TEXT,
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id, code)
);

CREATE TABLE IF NOT EXISTS flow_lab_snapshots (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id, source, dataset)
);

CREATE INDEX IF NOT EXISTS idx_flow_lab_snapshots_run
  ON flow_lab_snapshots(run_id, source, dataset);

CREATE INDEX IF NOT EXISTS idx_flow_lab_candidates_run_score
  ON flow_lab_candidates(run_id, score DESC);

CREATE TABLE IF NOT EXISTS flow_lab_paper_positions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL DEFAULT 'v1-paper',
  board TEXT NOT NULL,
  entry_at TEXT NOT NULL,
  entry_price REAL NOT NULL,
  exit_at TEXT,
  exit_price REAL,
  position_weight REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  return_pct REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flow_lab_positions_status
  ON flow_lab_paper_positions(status, entry_at DESC);
