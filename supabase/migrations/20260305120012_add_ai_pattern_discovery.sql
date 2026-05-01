/*
  # AI Pattern Discovery System

  Allows AI training accounts to observe conditions that correlate with trade outcomes
  but are NOT part of any existing ruleset. These "candidate observations" get tracked,
  and if they prove statistically significant, they can be promoted to candidate rules
  for the admin to evaluate and potentially add to a ruleset.

  1. New Tables
    - `ai_pattern_observations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `account_id` (uuid, references ai_training_accounts)
      - `observation_key` (text) - unique identifier for the observed condition
      - `observation_type` (text) - category: timing, correlation, sequence, context, volume, multi_factor
      - `description` (text) - human-readable description of what was observed
      - `conditions` (jsonb) - the specific conditions that define this observation
      - `sample_size` (integer) - number of trades where this condition was present
      - `win_count` (integer) - wins when condition present
      - `loss_count` (integer) - losses when condition present
      - `win_rate` (numeric) - win rate when condition present
      - `avg_profit` (numeric) - average profit when condition present
      - `avg_loss` (numeric) - average loss when condition present
      - `baseline_win_rate` (numeric) - overall win rate for comparison
      - `significance_score` (numeric) - statistical significance 0-100
      - `edge_pct` (numeric) - percentage edge over baseline
      - `status` (text) - observed, candidate, promoted, rejected, expired
      - `strategy_id` (text) - which strategy this was observed under
      - `first_observed_at` (timestamptz)
      - `last_observed_at` (timestamptz)
      - `promoted_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ai_candidate_rules`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `observation_id` (uuid, references ai_pattern_observations)
      - `rule_name` (text) - admin-assigned name for the rule
      - `rule_description` (text) - what the rule does
      - `rule_type` (text) - entry_filter, exit_modifier, score_boost, score_penalty, new_signal
      - `conditions` (jsonb) - the conditions that trigger this rule
      - `action` (jsonb) - what the rule does when triggered
      - `source_strategy_id` (text) - strategy this was discovered under
      - `source_account_ids` (jsonb) - accounts that contributed to discovery
      - `sample_size` (integer) - trades observed
      - `win_rate` (numeric) - win rate
      - `edge_pct` (numeric) - edge over baseline
      - `confidence` (text) - low, medium, high, proven
      - `status` (text) - proposed, testing, accepted, rejected, retired
      - `target_ruleset_id` (uuid, nullable) - which evolved_rulesets this should join
      - `testing_account_id` (uuid, nullable) - account testing this rule
      - `test_results` (jsonb) - results from testing
      - `admin_notes` (text) - admin review notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS on both tables
    - Admins can read/write all
    - Users can read their own observations
*/

CREATE TABLE IF NOT EXISTS ai_pattern_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  account_id uuid NOT NULL REFERENCES ai_training_accounts(id),
  observation_key text NOT NULL DEFAULT '',
  observation_type text NOT NULL DEFAULT 'correlation',
  description text NOT NULL DEFAULT '',
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_size integer NOT NULL DEFAULT 0,
  win_count integer NOT NULL DEFAULT 0,
  loss_count integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  avg_profit numeric NOT NULL DEFAULT 0,
  avg_loss numeric NOT NULL DEFAULT 0,
  baseline_win_rate numeric NOT NULL DEFAULT 0.5,
  significance_score numeric NOT NULL DEFAULT 0,
  edge_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'observed',
  strategy_id text NOT NULL DEFAULT '',
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_pattern_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all observations"
  ON ai_pattern_observations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Admins can insert observations"
  ON ai_pattern_observations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Admins can update observations"
  ON ai_pattern_observations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
    OR auth.uid() = user_id
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
    OR auth.uid() = user_id
  );

CREATE TABLE IF NOT EXISTS ai_candidate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  observation_id uuid REFERENCES ai_pattern_observations(id),
  rule_name text NOT NULL DEFAULT '',
  rule_description text NOT NULL DEFAULT '',
  rule_type text NOT NULL DEFAULT 'score_boost',
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_strategy_id text NOT NULL DEFAULT '',
  source_account_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample_size integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  edge_pct numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'proposed',
  target_ruleset_id uuid,
  testing_account_id uuid,
  test_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_candidate_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all candidate rules"
  ON ai_candidate_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can insert candidate rules"
  ON ai_candidate_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can update candidate rules"
  ON ai_candidate_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can delete candidate rules"
  ON ai_candidate_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_observations_account ON ai_pattern_observations(account_id);
CREATE INDEX IF NOT EXISTS idx_observations_status ON ai_pattern_observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_significance ON ai_pattern_observations(significance_score DESC);
CREATE INDEX IF NOT EXISTS idx_observations_key ON ai_pattern_observations(observation_key);
CREATE INDEX IF NOT EXISTS idx_candidate_rules_status ON ai_candidate_rules(status);
CREATE INDEX IF NOT EXISTS idx_candidate_rules_observation ON ai_candidate_rules(observation_id);
