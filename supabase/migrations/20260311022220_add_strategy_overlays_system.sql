/*
  # Add Strategy Overlay System

  1. New Tables
    - `strategy_overlays`
      - `id` (uuid, primary key)
      - `training_account_id` (uuid, nullable) - Links to specific training account
      - `user_id` (uuid) - Links to user for personal AI overlays
      - `overlay_strategy_id` (text) - Strategy ID like 'fibonacci-or'
      - `implementation_weight` (integer 0-100) - How much influence this overlay has
      - `can_veto` (boolean) - Can this overlay block trades?
      - `enabled` (boolean) - Is this overlay active?
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Allows layered strategy system: Base strategy + multiple overlays
    - Each overlay has configurable weight (0-100%)
    - Overlays can confirm, conflict, or veto base strategy signals
    - Enables gradual testing of new patterns

  3. Security
    - Enable RLS on strategy_overlays table
    - Users can only manage their own overlays
    - Training account overlays visible to account owner

  4. Indexes
    - Index on training_account_id for fast lookups
    - Index on user_id for personal AI overlays
*/

CREATE TABLE IF NOT EXISTS strategy_overlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_account_id uuid REFERENCES ai_training_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overlay_strategy_id text NOT NULL,
  implementation_weight integer NOT NULL DEFAULT 50 CHECK (implementation_weight >= 0 AND implementation_weight <= 100),
  can_veto boolean DEFAULT false,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overlays_account ON strategy_overlays(training_account_id);
CREATE INDEX IF NOT EXISTS idx_overlays_user ON strategy_overlays(user_id);
CREATE INDEX IF NOT EXISTS idx_overlays_enabled ON strategy_overlays(enabled) WHERE enabled = true;

ALTER TABLE strategy_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategy overlays"
  ON strategy_overlays FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategy overlays"
  ON strategy_overlays FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy overlays"
  ON strategy_overlays FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategy overlays"
  ON strategy_overlays FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);