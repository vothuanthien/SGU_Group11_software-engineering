-- Idempotent analytics migration. Safe to run during every local Compose startup.
CREATE TABLE IF NOT EXISTS visitor_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('app_opened', 'qr_scan', 'place_opened', 'visit_marked', 'narration_started', 'narration_completed', 'screen_viewed', 'ui_interaction')),
  attraction_id TEXT REFERENCES attractions(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at ON visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_created ON visitor_events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_attraction_type ON visitor_events(attraction_id, event_type, created_at DESC);


-- Upgrade already-existing analytics tables without deleting collected events.
ALTER TABLE visitor_events ALTER COLUMN attraction_id DROP NOT NULL;
ALTER TABLE visitor_events
  DROP CONSTRAINT IF EXISTS visitor_events_event_type_check,
  ADD CONSTRAINT visitor_events_event_type_check
    CHECK (event_type IN ('app_opened', 'qr_scan', 'place_opened', 'visit_marked', 'narration_started', 'narration_completed', 'screen_viewed', 'ui_interaction'));
