/*
  # Add AI Learned Adjustments Table

  1. New Tables
    - `ai_learned_adjustments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `pattern_overrides` (jsonb) - Pattern-specific promote/demote decisions
      - `learned_weights` (jsonb) - Correlation-based scoring weight adjustments
      - `threshold_adjustments` (jsonb) - Evolved min score and R:R thresholds
      - `total_decisions` (integer) - Total drift evaluations performed
      - `drifted_decisions` (integer) - Decisions where drift was applied
      - `is_drifting` (boolean) - Whether the AI is currently in drift mode
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `ai_learned_adjustments` table
    - Add policy for authenticated users to manage their own drift data
*/

CREATE TABLE IF NOT EXISTS ai_learned_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  pattern_overrides jsonb DEFAULT '{}'::jsonb,
  learned_weights jsonb DEFAULT '{}'::jsonb,
  threshold_adjustments jsonb DEFAULT '{}'::jsonb,
  total_decisions integer DEFAULT 0,
  drifted_decisions integer DEFAULT 0,
  is_drifting boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_learned_adjustments_user_unique UNIQUE (user_id)
);

ALTER TABLE ai_learned_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own learned adjustments"
  ON ai_learned_adjustments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learned adjustments"
  ON ai_learned_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learned adjustments"
  ON ai_learned_adjustments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learned adjustments"
  ON ai_learned_adjustments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);