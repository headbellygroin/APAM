/*
  # Add promotion tracking for hybrid-to-base-fleet upgrades

  When a Master AI hybrid account outperforms a user's base drift account,
  the hybrid can be "promoted" into the base fleet, replacing the weaker
  account. This frees a spawned slot for the Master to build better hybrids.

  1. Modified Tables
    - `ai_training_accounts` - add columns:
      - `promoted_from_spawned` (boolean) - marks this was once a spawned account promoted to base
      - `replaced_account_id` (uuid) - which base account this replaced
    - `master_ai_spawn_log` - update action constraint to include 'promote'

  2. Important Notes
    - Only drift-enabled (adaptive) base accounts are eligible for replacement
    - Strict control accounts are never replaced
    - Promotion stops the replaced account and converts the hybrid to base fleet
    - Trade history is preserved on both accounts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'promoted_from_spawned'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN promoted_from_spawned boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'replaced_account_id'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN replaced_account_id uuid REFERENCES ai_training_accounts(id);
  END IF;
END $$;

ALTER TABLE master_ai_spawn_log DROP CONSTRAINT IF EXISTS master_ai_spawn_log_action_check;

ALTER TABLE master_ai_spawn_log ADD CONSTRAINT master_ai_spawn_log_action_check
  CHECK (action IN ('spawn', 'retire', 'absorb', 'evolve', 'promote'));
