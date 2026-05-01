/*
  # Add AI Evolution and Strategy Drift Tracking

  1. New Tables
    - `ai_drift_log`
      - `id` (uuid, primary key) - unique drift log entry
      - `user_id` (uuid, references auth.users) - owning user
      - `strategy_id` (text) - which strategy the AI was using
      - `symbol` (text) - symbol being analyzed
      - `ai_action` (text) - action the AI chose
      - `base_action` (text) - action the base strategy rules would choose
      - `is_aligned` (boolean) - whether AI matched base rules
      - `odds_score` (numeric) - score at time of decision
      - `created_at` (timestamptz) - when decision was made

    - `ai_evolution_state`
      - `id` (uuid, primary key) - unique state record
      - `user_id` (uuid, unique, references auth.users) - owning user
      - `evolution_permitted` (boolean) - whether user granted evolution permission
      - `permitted_at` (timestamptz) - when permission was granted
      - `ai_name` (text) - name the AI earns when it proves consistent edge
      - `ai_named_at` (timestamptz) - when AI earned its name
      - `ai_performance_at_naming` (jsonb) - performance snapshot at naming
      - `is_ai_active` (boolean) - whether the evolved AI identity is active
      - `created_at` (timestamptz) - record creation time
      - `updated_at` (timestamptz) - last update time

    - `ai_evolution_notifications`
      - `id` (uuid, primary key) - unique notification
      - `user_id` (uuid, references auth.users) - owning user
      - `notification_type` (text) - type: drift_detected, outperformance, ready_to_evolve, ai_naming
      - `title` (text) - notification title
      - `message` (text) - detailed message
      - `metrics` (jsonb) - performance metrics at time of notification
      - `is_acknowledged` (boolean) - whether user has seen/acknowledged
      - `created_at` (timestamptz) - when notification was created

  2. Security
    - Enable RLS on all tables
    - Users can only read/write their own drift logs, evolution state, and notifications

  3. Indexes
    - Index on ai_drift_log (user_id, strategy_id) for drift calculations
    - Index on ai_evolution_notifications (user_id, is_acknowledged) for unread queries

  4. Notes
    - ai_drift_log tracks every AI decision vs base strategy for drift analysis
    - ai_evolution_state is one record per user, tracks whether AI has permission to evolve
    - ai_evolution_notifications alerts user when AI milestones are reached
*/

CREATE TABLE IF NOT EXISTS ai_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy_id text NOT NULL,
  symbol text NOT NULL,
  ai_action text NOT NULL,
  base_action text NOT NULL,
  is_aligned boolean DEFAULT false NOT NULL,
  odds_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ai_drift_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drift logs"
  ON ai_drift_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drift logs"
  ON ai_drift_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_drift_log_user_strategy
  ON ai_drift_log (user_id, strategy_id);

CREATE TABLE IF NOT EXISTS ai_evolution_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  evolution_permitted boolean DEFAULT false NOT NULL,
  permitted_at timestamptz,
  ai_name text,
  ai_named_at timestamptz,
  ai_performance_at_naming jsonb,
  is_ai_active boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ai_evolution_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution state"
  ON ai_evolution_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evolution state"
  ON ai_evolution_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evolution state"
  ON ai_evolution_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_evolution_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_acknowledged boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ai_evolution_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution notifications"
  ON ai_evolution_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evolution notifications"
  ON ai_evolution_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evolution notifications"
  ON ai_evolution_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_evolution_notifications_unread
  ON ai_evolution_notifications (user_id, is_acknowledged);
