-- 002-segment-status.sql
-- Add status column for approve/reject workflow

ALTER TABLE segments ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX idx_segments_status ON segments(status);
