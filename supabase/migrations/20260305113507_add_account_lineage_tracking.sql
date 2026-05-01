/*
  # Add account lineage tracking for family tree history

  Tracks the full evolutionary history of AI accounts so you can trace
  which models merged into which to create each generation.

  1. New Tables
    - `ai_account_lineage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `account_id` (uuid, references ai_training_accounts) - the child account
      - `parent_account_id` (uuid, references ai_training_accounts) - one parent
      - `event_type` (text) - spawn, promote, evolve
      - `generation` (integer) - which generation this created
      - `blend_weight` (numeric) - how much this parent contributed (0-1)
      - `performance_snapshot` (jsonb) - parent's stats at time of event
      - `notes` (text) - description of what happened
      - `created_at` (timestamptz)

  2. Modified Tables
    - `ai_training_accounts` - add columns:
      - `lineage_name` (text) - earned name for the account lineage
      - `origin_type` (text) - 'user_created', 'master_spawned', 'promoted'

  3. Security
    - Enable RLS on `ai_account_lineage` table
    - Users can only see their own lineage data
*/

CREATE TABLE IF NOT EXISTS ai_account_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  account_id uuid NOT NULL REFERENCES ai_training_accounts(id),
  parent_account_id uuid REFERENCES ai_training_accounts(id),
  event_type text NOT NULL CHECK (event_type IN ('spawn', 'promote', 'evolve', 'create')),
  generation integer NOT NULL DEFAULT 0,
  blend_weight numeric NOT NULL DEFAULT 1.0,
  performance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_account_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lineage"
  ON ai_account_lineage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lineage"
  ON ai_account_lineage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'lineage_name'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN lineage_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'origin_type'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN origin_type text NOT NULL DEFAULT 'user_created'
      CHECK (origin_type IN ('user_created', 'master_spawned', 'promoted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lineage_account ON ai_account_lineage(account_id);
CREATE INDEX IF NOT EXISTS idx_lineage_parent ON ai_account_lineage(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_lineage_user ON ai_account_lineage(user_id);
