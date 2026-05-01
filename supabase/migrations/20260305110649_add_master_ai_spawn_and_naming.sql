/*
  # Master AI Spawn Control & Tiered Naming System

  1. New Tables
    - `master_ai_spawn_log`
      - `id` (uuid, primary key) - unique log entry
      - `user_id` (uuid, FK to auth.users) - admin who owns the Master AI
      - `action` (text) - 'spawn', 'retire', 'absorb'
      - `source_account_ids` (jsonb) - which training accounts contributed
      - `spawned_account_id` (uuid) - the account created (if spawn)
      - `retired_account_id` (uuid) - the account retired (if retire)
      - `hybrid_config` (jsonb) - the blended configuration used
      - `reason` (text) - why this action was taken
      - `created_at` (timestamptz)

    - `master_ai_eod_reviews`
      - `id` (uuid, primary key) - unique review
      - `user_id` (uuid, FK to auth.users) - admin
      - `review_date` (date) - the trading day reviewed
      - `account_rankings` (jsonb) - ranked list of all accounts
      - `top_performers` (jsonb) - top 3 configs
      - `bottom_performers` (jsonb) - bottom 3 configs
      - `actions_taken` (jsonb) - what the Master decided
      - `spawn_recommendation` (jsonb) - suggested hybrid if applicable
      - `retire_recommendation` (jsonb) - suggested retirement if applicable
      - `next_day_notes` (text) - prep notes for next trading day
      - `master_name_tier` (int) - Master's current naming tier
      - `master_name` (text) - Master's earned name at time of review
      - `created_at` (timestamptz)

  2. Modified Tables
    - `ai_training_accounts` - add columns:
      - `spawned_by_master` (boolean) - whether Master AI created this
      - `parent_account_ids` (jsonb) - source accounts for hybrid
      - `generation` (int) - spawn generation (0 = user-created)

  3. Security
    - Enable RLS on both new tables
    - Users can only access their own spawn logs and reviews
*/

CREATE TABLE IF NOT EXISTS master_ai_spawn_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('spawn', 'retire', 'absorb')),
  source_account_ids jsonb DEFAULT '[]',
  spawned_account_id uuid REFERENCES ai_training_accounts(id),
  retired_account_id uuid REFERENCES ai_training_accounts(id),
  hybrid_config jsonb DEFAULT '{}',
  reason text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE master_ai_spawn_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spawn logs"
  ON master_ai_spawn_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own spawn logs"
  ON master_ai_spawn_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS master_ai_eod_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  review_date date NOT NULL,
  account_rankings jsonb DEFAULT '[]',
  top_performers jsonb DEFAULT '[]',
  bottom_performers jsonb DEFAULT '[]',
  actions_taken jsonb DEFAULT '[]',
  spawn_recommendation jsonb,
  retire_recommendation jsonb,
  next_day_notes text DEFAULT '',
  master_name_tier int NOT NULL DEFAULT 0,
  master_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE master_ai_eod_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own eod reviews"
  ON master_ai_eod_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own eod reviews"
  ON master_ai_eod_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own eod reviews"
  ON master_ai_eod_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'spawned_by_master'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN spawned_by_master boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'parent_account_ids'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN parent_account_ids jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'generation'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN generation int NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spawn_log_user ON master_ai_spawn_log(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reviews_user ON master_ai_eod_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reviews_date ON master_ai_eod_reviews(review_date);
