/*
  # Macro Signal Correlations and Shared External Data

  ## Summary
  Supports the AI's ability to discover non-obvious multi-variable correlations across
  external macro datasets and market outcomes. This is the "A + B + C were always present
  when D happened" engine.

  ## Key Design Decisions

  1. External data sources are now GLOBAL (shared across all users/AIs) — uploaded once,
     usable by every historical simulation and every training account.

  2. A new `macro_signal_correlations` table stores discovered multi-variable patterns
     where combinations of external data conditions correlate with specific market outcomes.
     These are discovered automatically during simulation analysis.

  3. `macro_condition_snapshots` stores the daily/weekly state of all external data sources,
     indexed by date, so the simulation engine can look up "what were ALL the macro variables
     on 2008-07-14" in a single query.

  4. `macro_pattern_triggers` stores confirmed multi-variable precursor patterns with
     occurrence tracking — enabling the AI to say "9 out of 11 times X, Y, Z were present
     and the market did D".

  ## New Tables

  ### macro_condition_snapshots
  - Pre-computed daily snapshot of all external data source values
  - One row per date, JSON column with source_id -> value map
  - Enables fast "give me all macro context for date X" lookups

  ### macro_signal_correlations
  - AI-discovered correlations between external data conditions and outcomes
  - Stores the conditions (what values/ranges triggered), the outcome observed,
    hit rate, sample count, and significance score
  - Tagged with which stocks/sectors this correlation applies to

  ### macro_pattern_triggers
  - Confirmed multi-variable precursor patterns ("when A+B+C, then D")
  - Stores the full condition set, historical occurrence list, outcome stats
  - Used by all AIs as a shared knowledge base

  ## Modified Tables
  - external_data_sources: Add is_global flag so admin-loaded data is shared
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_data_sources' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE external_data_sources
      ADD COLUMN is_global boolean DEFAULT false,
      ADD COLUMN loaded_by_admin boolean DEFAULT false,
      ADD COLUMN last_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS macro_condition_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  conditions jsonb NOT NULL DEFAULT '{}',
  source_ids uuid[] DEFAULT '{}',
  computed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_snapshots_date ON macro_condition_snapshots(snapshot_date);

ALTER TABLE macro_condition_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view macro snapshots"
  ON macro_condition_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert macro snapshots"
  ON macro_condition_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update macro snapshots"
  ON macro_condition_snapshots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS macro_signal_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_by_account_id uuid,
  discovered_by_run_id uuid,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  condition_sources uuid[] DEFAULT '{}',
  conditions jsonb NOT NULL DEFAULT '[]',
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'price_up', 'price_down', 'volatility_spike', 'volume_surge',
    'trend_continuation', 'trend_reversal', 'sector_rotation', 'custom'
  )),
  outcome_description text DEFAULT '',
  applicable_symbols text[] DEFAULT '{}',
  applicable_sectors text[] DEFAULT '{}',
  hit_count integer DEFAULT 0,
  miss_count integer DEFAULT 0,
  hit_rate numeric(5, 4) DEFAULT 0,
  avg_outcome_magnitude numeric(10, 4) DEFAULT 0,
  significance_score numeric(5, 4) DEFAULT 0,
  first_observed_date date,
  last_observed_date date,
  observation_dates date[] DEFAULT '{}',
  status text DEFAULT 'candidate' CHECK (status IN ('candidate', 'validated', 'rejected', 'monitoring')),
  promoted_to_ruleset boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_correlations_status ON macro_signal_correlations(status);
CREATE INDEX IF NOT EXISTS idx_macro_correlations_outcome ON macro_signal_correlations(outcome_type);
CREATE INDEX IF NOT EXISTS idx_macro_correlations_hit_rate ON macro_signal_correlations(hit_rate DESC);

ALTER TABLE macro_signal_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view macro correlations"
  ON macro_signal_correlations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert macro correlations"
  ON macro_signal_correlations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update macro correlations"
  ON macro_signal_correlations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS macro_pattern_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid REFERENCES macro_signal_correlations(id) ON DELETE CASCADE,
  pattern_name text NOT NULL,
  description text DEFAULT '',
  condition_set jsonb NOT NULL DEFAULT '[]',
  confirmed_occurrences jsonb NOT NULL DEFAULT '[]',
  occurrence_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  success_rate numeric(5, 4) DEFAULT 0,
  avg_days_to_outcome integer DEFAULT 0,
  avg_outcome_pct numeric(10, 4) DEFAULT 0,
  worst_outcome_pct numeric(10, 4) DEFAULT 0,
  best_outcome_pct numeric(10, 4) DEFAULT 0,
  applicable_symbols text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  confidence_level text DEFAULT 'low' CHECK (confidence_level IN ('low', 'medium', 'high', 'very_high')),
  minimum_samples_required integer DEFAULT 5,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_triggers_active ON macro_pattern_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_macro_triggers_success ON macro_pattern_triggers(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_macro_triggers_confidence ON macro_pattern_triggers(confidence_level);

ALTER TABLE macro_pattern_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view macro triggers"
  ON macro_pattern_triggers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert macro triggers"
  ON macro_pattern_triggers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update macro triggers"
  ON macro_pattern_triggers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
