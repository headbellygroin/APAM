/*
  # Add name_status to AI evolution state

  1. Modified Tables
    - `ai_evolution_state`
      - Add `name_status` (text) - tracks current name lifecycle: unearned, earned, warning, revoked
      - Default: 'unearned'

  2. Notes
    - Supports the AI goal/reward system where the AI earns a name at 65% win rate over 100+ trades
    - Name can be revoked if rolling 50-trade performance drops below floor thresholds
    - Warning state gives the AI a chance to recover before revocation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_evolution_state' AND column_name = 'name_status'
  ) THEN
    ALTER TABLE ai_evolution_state ADD COLUMN name_status text DEFAULT 'unearned' NOT NULL;
  END IF;
END $$;
