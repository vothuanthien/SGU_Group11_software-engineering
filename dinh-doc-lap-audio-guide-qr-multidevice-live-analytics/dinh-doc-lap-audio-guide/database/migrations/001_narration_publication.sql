-- Apply to an existing database created before narration publication control was added.
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS narration_published BOOLEAN NOT NULL DEFAULT TRUE;
