ALTER TABLE flow_lab_paper_positions ADD COLUMN code TEXT;
ALTER TABLE flow_lab_paper_positions ADD COLUMN entry_trade_date TEXT;
ALTER TABLE flow_lab_paper_positions ADD COLUMN data_mode TEXT NOT NULL DEFAULT 'unknown';

CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_lab_paper_unique_entry
  ON flow_lab_paper_positions(strategy_version, entry_trade_date, code, exit_slot);

CREATE INDEX IF NOT EXISTS idx_flow_lab_paper_grouping
  ON flow_lab_paper_positions(data_mode, board, exit_slot, status);
