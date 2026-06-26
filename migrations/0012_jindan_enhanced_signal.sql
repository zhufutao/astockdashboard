ALTER TABLE jindan_daily_bars ADD COLUMN open REAL;
ALTER TABLE jindan_daily_bars ADD COLUMN high REAL;
ALTER TABLE jindan_daily_bars ADD COLUMN low REAL;

ALTER TABLE jindan_snapshot_rows ADD COLUMN ma60 REAL;
ALTER TABLE jindan_snapshot_rows ADD COLUMN ma20_slope_pct REAL;
ALTER TABLE jindan_snapshot_rows ADD COLUMN atr20 REAL;
ALTER TABLE jindan_snapshot_rows ADD COLUMN enhanced_signal TEXT;
ALTER TABLE jindan_snapshot_rows ADD COLUMN enhanced_label TEXT;
ALTER TABLE jindan_snapshot_rows ADD COLUMN suggested_position REAL;
ALTER TABLE jindan_snapshot_rows ADD COLUMN suggested_action TEXT;
ALTER TABLE jindan_snapshot_rows ADD COLUMN filter_flags_json TEXT;
ALTER TABLE jindan_snapshot_rows ADD COLUMN filter_summary TEXT;
