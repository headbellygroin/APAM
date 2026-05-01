/*
  # Evolved Rulesets - Drift-to-Strategy Pipeline

  When a spawned training account drifts consistently and outperforms its base
  strategy, the drift pattern can be codified into a new named ruleset. This
  table stores those evolved rulesets.

  1. New Tables
    - `evolved_rulesets`
      - `id` (uuid, primary key) - unique ruleset
      - `user_id` (uuid, FK to auth.users) - owner
      - `name` (text) - the earned name of this evolved strategy
      - `parent_strategy_id` (text) - which base strategy it evolved from (e.g. 'apam')
      - `source_account_id` (uuid) - the training account whose drift produced it
      - `generation` (int) - how many evolutions deep (1 = first drift, 2 = drift of drift, etc.)
      - `learned_weights` (jsonb) - the finalized weight adjustments
      - `threshold_adjustments` (jsonb) - the finalized threshold adjustments
      - `pattern_overrides` (jsonb) - codified pattern overrides
      - `performance_at_creation` (jsonb) - snapshot of performance when codified
      - `min_trades_observed` (int) - how many trades informed this ruleset
      - `drift_percentage` (numeric) - how far it drifted from the parent
      - `outperformance_pct` (numeric) - how much it outperformed the parent
      - `status` (text) - 'candidate', 'active', 'retired', 'superseded'
      - `is_registered` (boolean) - whether it has been registered in the strategy registry
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `ai_training_accounts` - add column:
      - `evolved_ruleset_id` (uuid) - if this account is running an evolved ruleset

  3. Security
    - Enable RLS on evolved_rulesets
    - Users can only access their own evolved rulesets
*/

CREATE TABLE IF NOT EXISTS evolved_rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  parent_strategy_id text NOT NULL DEFAULT '',
  source_account_id uuid REFERENCES ai_training_accounts(id),
  generation int NOT NULL DEFAULT 1,
  learned_weights jsonb NOT NULL DEFAULT '{}',
  threshold_adjustments jsonb NOT NULL DEFAULT '{}',
  pattern_overrides jsonb NOT NULL DEFAULT '{}',
  performance_at_creation jsonb NOT NULL DEFAULT '{}',
  min_trades_observed int NOT NULL DEFAULT 0,
  drift_percentage numeric NOT NULL DEFAULT 0,
  outperformance_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'retired', 'superseded')),
  is_registered boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE evolved_rulesets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolved rulesets"
  ON evolved_rulesets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own evolved rulesets"
  ON evolved_rulesets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evolved rulesets"
  ON evolved_rulesets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'evolved_ruleset_id'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN evolved_ruleset_id uuid REFERENCES evolved_rulesets(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evolved_rulesets_user ON evolved_rulesets(user_id);
CREATE INDEX IF NOT EXISTS idx_evolved_rulesets_status ON evolved_rulesets(status);
CREATE INDEX IF NOT EXISTS idx_evolved_rulesets_parent ON evolved_rulesets(parent_strategy_id);
