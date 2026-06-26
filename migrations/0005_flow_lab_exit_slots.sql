ALTER TABLE flow_lab_paper_positions ADD COLUMN exit_slot TEXT NOT NULL DEFAULT '09:45';

CREATE INDEX IF NOT EXISTS idx_flow_lab_positions_exit_slot
  ON flow_lab_paper_positions(exit_slot, status, entry_at DESC);
