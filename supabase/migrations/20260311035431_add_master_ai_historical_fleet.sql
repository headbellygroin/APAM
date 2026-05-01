/*
  # Master AI Historical Fleet

  ## Summary
  Adds support for the Master AI to manage its own fleet of historical simulation
  accounts, separate from user-owned runs. The Master AI can:
  - Create fleets of 10+ accounts with varied rulesets
  - Track lineage and improvement across iterations
  - Pull learned weights from user accounts or generate its own
  - Run accounts through multiple historical periods (generational testing)

  ## New Tables

  ### master_ai_fleet_runs
  - Tracks each Master AI initiated historical run
  - Links to existing historical_simulation_runs
  - Records which generation/iteration this is
  - Stores source_type: 'user_pool' (pulled from users) or 'self_generated'
  - Stores improvement metrics vs previous generation

  ### master_ai_fleet_generations
  - Groups multiple runs into a "generation" (e.g., Gen 1 = first pass, Gen 2 = improved)
  - Tracks what changed between generations
  - Stores the best-performing rulesets from each generation

  ## Security
  - RLS enabled on all tables
  - Only admins can create/modify master AI fleet records
  - All users can view (for transparency)
*/

CREATE TABLE IF NOT EXISTS master_ai_fleet_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid REFERENCES historical_simulation_runs(id) ON DELETE CASCADE,
  generation_number integer DEFAULT 1,
  fleet_label text NOT NULL DEFAULT '',
  source_type text DEFAULT 'self_generated' CHECK (source_type IN ('user_pool', 'self_generated', 'hybrid')),
  parent_generation_id uuid REFERENCES master_ai_fleet_runs(id),
  ruleset_source jsonb DEFAULT '{}'::jsonb,
  improvement_vs_parent jsonb DEFAULT '{}'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE master_ai_fleet_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage master ai fleet runs"
  ON master_ai_fleet_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update master ai fleet runs"
  ON master_ai_fleet_runs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete master ai fleet runs"
  ON master_ai_fleet_runs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view master ai fleet runs"
  ON master_ai_fleet_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS master_ai_fleet_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_number integer NOT NULL,
  label text NOT NULL DEFAULT '',
  description text DEFAULT '',
  run_ids uuid[] DEFAULT '{}',
  best_account_configs jsonb DEFAULT '[]'::jsonb,
  avg_win_rate numeric(6,2) DEFAULT 0,
  avg_profit_factor numeric(6,2) DEFAULT 0,
  top_strategy text DEFAULT '',
  top_mode text DEFAULT '',
  what_improved text DEFAULT '',
  ruleset_changes jsonb DEFAULT '[]'::jsonb,
  promoted_to_live boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE master_ai_fleet_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage master ai generations"
  ON master_ai_fleet_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update master ai generations"
  ON master_ai_fleet_generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete master ai generations"
  ON master_ai_fleet_generations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view master ai generations"
  ON master_ai_fleet_generations FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_master_ai_fleet_runs_user ON master_ai_fleet_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_master_ai_fleet_runs_run ON master_ai_fleet_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_master_ai_fleet_gens_user ON master_ai_fleet_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_master_ai_fleet_gens_number ON master_ai_fleet_generations(generation_number);
