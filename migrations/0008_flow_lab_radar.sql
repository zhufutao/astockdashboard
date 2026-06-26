-- Early-session radar: one THS individual-fund snapshot per minute.
ALTER TABLE flow_lab_runs ADD COLUMN trade_date TEXT;
ALTER TABLE flow_lab_candidates ADD COLUMN rank INTEGER;
ALTER TABLE flow_lab_candidates ADD COLUMN pct_chg REAL;

CREATE INDEX IF NOT EXISTS idx_flow_lab_runs_trade_date
  ON flow_lab_runs(trade_date, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_flow_lab_candidates_code
  ON flow_lab_candidates(code, run_id);
