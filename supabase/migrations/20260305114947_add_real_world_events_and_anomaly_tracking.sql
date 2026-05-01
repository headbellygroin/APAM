/*
  # Real World Events & User Trade Anomaly Tracking

  1. New Tables
    - `user_trade_anomalies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `detected_by` (uuid, references auth.users) - admin who reviews
      - `symbol` (text) - ticker involved
      - `anomaly_type` (text) - type: unexplained_cluster, counter_signal, timing_anomaly, volume_spike
      - `description` (text) - auto-generated description of what the AI noticed
      - `user_trades` (jsonb) - the actual trades that triggered the anomaly
      - `ai_signal_at_time` (jsonb) - what the AI was recommending at the time
      - `confidence_gap` (numeric) - how far off the AI's signal was from user action
      - `outcome` (text) - win/loss/pending after the fact
      - `profit_loss` (numeric) - combined P/L of the anomalous trades
      - `status` (text) - detected, investigating, resolved, dismissed
      - `resolved_event_id` (uuid) - links to the real_world_event once identified
      - `review_notes` (text) - admin notes during investigation
      - `detected_at` (timestamptz)
      - `resolved_at` (timestamptz)

    - `real_world_events`
      - `id` (uuid, primary key)
      - `created_by` (uuid, references auth.users) - admin who logged it
      - `event_type` (text) - category: earnings, fda, geopolitical, social_media, insider, macro, sector_rotation, news_catalyst, other
      - `title` (text) - short title
      - `description` (text) - detailed description
      - `symbols_affected` (jsonb) - array of tickers affected
      - `event_date` (date) - when the event occurred
      - `impact_direction` (text) - bullish, bearish, neutral
      - `impact_magnitude` (text) - minor, moderate, major, extreme
      - `source_url` (text) - where the info came from
      - `discovery_method` (text) - how it was found: user_anomaly, manual, news_scan
      - `anomaly_ids` (jsonb) - which anomalies led to this discovery
      - `tags` (jsonb) - array of tags for categorization
      - `is_predictive` (boolean) - can this type of event be predicted?
      - `predictive_signals` (jsonb) - what signals preceded this event
      - `similar_past_events` (jsonb) - references to similar events
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `event_pattern_catalog`
      - `id` (uuid, primary key)
      - `event_type` (text) - matches real_world_events.event_type
      - `pattern_name` (text) - name for this pattern
      - `description` (text)
      - `avg_impact_pct` (numeric) - average price impact
      - `avg_duration_hours` (numeric) - how long the impact lasts
      - `occurrence_count` (integer) - times observed
      - `win_rate_when_traded` (numeric) - success rate trading this pattern
      - `best_entry_timing` (text) - when to enter relative to event
      - `typical_symbols` (jsonb) - symbols commonly affected
      - `precursor_signals` (jsonb) - signals that tend to appear before
      - `last_occurred_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Anomalies: admin can read all, system can insert
    - Real world events: admin can CRUD
    - Event pattern catalog: admin can CRUD, authenticated users can read
*/

CREATE TABLE IF NOT EXISTS user_trade_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  detected_by uuid REFERENCES auth.users(id),
  symbol text NOT NULL DEFAULT '',
  anomaly_type text NOT NULL DEFAULT 'unexplained_cluster',
  description text NOT NULL DEFAULT '',
  user_trades jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_signal_at_time jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_gap numeric NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'pending',
  profit_loss numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'detected',
  resolved_event_id uuid,
  review_notes text NOT NULL DEFAULT '',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_trade_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all anomalies"
  ON user_trade_anomalies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert anomalies"
  ON user_trade_anomalies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update anomalies"
  ON user_trade_anomalies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS real_world_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL DEFAULT 'other',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  symbols_affected jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  impact_direction text NOT NULL DEFAULT 'neutral',
  impact_magnitude text NOT NULL DEFAULT 'moderate',
  source_url text NOT NULL DEFAULT '',
  discovery_method text NOT NULL DEFAULT 'manual',
  anomaly_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_predictive boolean NOT NULL DEFAULT false,
  predictive_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  similar_past_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE real_world_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all events"
  ON real_world_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert events"
  ON real_world_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update events"
  ON real_world_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete events"
  ON real_world_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS event_pattern_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT '',
  pattern_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  avg_impact_pct numeric NOT NULL DEFAULT 0,
  avg_duration_hours numeric NOT NULL DEFAULT 0,
  occurrence_count integer NOT NULL DEFAULT 0,
  win_rate_when_traded numeric NOT NULL DEFAULT 0,
  best_entry_timing text NOT NULL DEFAULT '',
  typical_symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  precursor_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_pattern_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event catalog"
  ON event_pattern_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert catalog entries"
  ON event_pattern_catalog FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update catalog entries"
  ON event_pattern_catalog FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete catalog entries"
  ON event_pattern_catalog FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

ALTER TABLE user_trade_anomalies ADD CONSTRAINT fk_anomaly_resolved_event
  FOREIGN KEY (resolved_event_id) REFERENCES real_world_events(id);

CREATE INDEX IF NOT EXISTS idx_anomalies_status ON user_trade_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_symbol ON user_trade_anomalies(symbol);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at ON user_trade_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON real_world_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON real_world_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_event_type ON event_pattern_catalog(event_type);
