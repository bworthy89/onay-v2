-- 002-segment-status.sql
-- Add status column for approve/reject workflow

ALTER TABLE segments ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected'));

CREATE INDEX idx_segments_status ON segments(status);
