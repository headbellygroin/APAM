/*
  # Add AI Drift Rollbacks Table

  Tracks when the AI walks back drifted rules because they stopped performing.
  This is the safety net that prevents the AI from "hallucinating" bad rules.

  1. New Tables
    - `ai_drift_rollbacks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `rollback_type` (text) - pattern_override, weight_reset, or threshold_reset
      - `reason` (text) - human-readable explanation of why rollback happened
      - `rolled_back_from` (jsonb) - state before rollback
      - `rolled_back_to` (jsonb) - state after rollback
      - `trigger_metric` (text) - the specific metric that triggered rollback
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `ai_drift_rollbacks` table
    - Add policies for authenticated users to manage their own rollback data
*/

CREATE TABLE IF NOT EXISTS ai_drift_rollbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  rollback_type text NOT NULL,
  reason text NOT NULL,
  rolled_back_from jsonb DEFAULT '{}'::jsonb,
  rolled_back_to jsonb DEFAULT '{}'::jsonb,
  trigger_metric text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_drift_rollbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drift rollbacks"
  ON ai_drift_rollbacks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drift rollbacks"
  ON ai_drift_rollbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own drift rollbacks"
  ON ai_drift_rollbacks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);