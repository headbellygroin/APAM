/*
  # Multi-Account AI Training System

  1. New Tables
    - `ai_training_accounts`
      - `id` (uuid, primary key) - unique account identifier
      - `user_id` (uuid, FK to auth.users) - owner of the training account
      - `name` (text) - display name like "Strict APAM #1"
      - `strategy_id` (text) - which strategy ruleset to follow
      - `mode` (text) - 'strict' (no drift) or 'adaptive' (drift enabled)
      - `starting_capital` (numeric) - simulated starting balance
      - `current_capital` (numeric) - current simulated balance
      - `risk_per_trade` (numeric) - % risk per trade (default 1%)
      - `max_positions` (int) - max concurrent open positions
      - `scan_interval_seconds` (int) - how often to scan (for sim speed)
      - `status` (text) - 'active', 'paused', 'stopped'
      - `total_trades` (int) - count of completed trades
      - `winning_trades` (int) - count of winning trades
      - `total_profit_loss` (numeric) - cumulative P&L
      - `win_rate` (numeric) - calculated win rate
      - `profit_factor` (numeric) - gross profit / gross loss
      - `expectancy` (numeric) - expected value per trade
      - `max_drawdown` (numeric) - worst peak-to-trough decline
      - `learned_weights` (jsonb) - drift engine weights (adaptive only)
      - `threshold_adjustments` (jsonb) - drift engine thresholds (adaptive only)
      - `pattern_overrides` (jsonb) - drift engine patterns (adaptive only)
      - `drift_decisions` (int) - count of drifted decisions
      - `total_decisions` (int) - total decisions made
      - `is_drifting` (boolean) - whether currently drifting from base rules
      - `promoted_to_master` (boolean) - whether Master AI absorbed this config
      - `promoted_at` (timestamptz) - when it was promoted
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ai_training_trades`
      - `id` (uuid, primary key)
      - `account_id` (uuid, FK to ai_training_accounts)
      - `user_id` (uuid, FK to auth.users)
      - `symbol` (text) - ticker symbol
      - `trade_type` (text) - 'long' or 'short'
      - `entry_price` (numeric)
      - `exit_price` (numeric)
      - `stop_loss` (numeric)
      - `target_price` (numeric)
      - `position_size` (numeric) - number of shares
      - `profit_loss` (numeric) - net P&L after fees
      - `gross_profit_loss` (numeric) - P&L before fees
      - `total_fees` (numeric) - simulated fees
      - `status` (text) - 'open', 'closed', 'cancelled'
      - `exit_reason` (text) - 'target', 'stop', 'manual', 'time'
      - `odds_score` (numeric)
      - `confidence_score` (numeric)
      - `pattern_key` (text)
      - `was_drift_decision` (boolean) - whether drift engine overrode
      - `drift_reason` (text) - explanation if drifted
      - `entry_time` (timestamptz)
      - `exit_time` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only manage their own training accounts and trades
*/

CREATE TABLE IF NOT EXISTS ai_training_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  strategy_id text NOT NULL DEFAULT 'trade-surge',
  mode text NOT NULL DEFAULT 'adaptive' CHECK (mode IN ('strict', 'adaptive')),
  starting_capital numeric NOT NULL DEFAULT 25000,
  current_capital numeric NOT NULL DEFAULT 25000,
  risk_per_trade numeric NOT NULL DEFAULT 1.0,
  max_positions int NOT NULL DEFAULT 3,
  scan_interval_seconds int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'stopped')),
  total_trades int NOT NULL DEFAULT 0,
  winning_trades int NOT NULL DEFAULT 0,
  total_profit_loss numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  profit_factor numeric NOT NULL DEFAULT 0,
  expectancy numeric NOT NULL DEFAULT 0,
  max_drawdown numeric NOT NULL DEFAULT 0,
  learned_weights jsonb DEFAULT '{"strengthScore":1,"timeScore":1,"freshnessScore":1,"trendScore":1,"curveScore":1,"profitZoneScore":1}',
  threshold_adjustments jsonb DEFAULT '{"minOddsScore":0,"minRiskReward":0,"confidenceFloor":0}',
  pattern_overrides jsonb DEFAULT '{}',
  drift_decisions int NOT NULL DEFAULT 0,
  total_decisions int NOT NULL DEFAULT 0,
  is_drifting boolean NOT NULL DEFAULT false,
  promoted_to_master boolean NOT NULL DEFAULT false,
  promoted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_training_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training accounts"
  ON ai_training_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own training accounts"
  ON ai_training_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training accounts"
  ON ai_training_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own training accounts"
  ON ai_training_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_training_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ai_training_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol text NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('long', 'short')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric NOT NULL,
  target_price numeric NOT NULL,
  position_size numeric NOT NULL,
  profit_loss numeric,
  gross_profit_loss numeric,
  total_fees numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  exit_reason text CHECK (exit_reason IN ('target', 'stop', 'manual', 'time')),
  odds_score numeric,
  confidence_score numeric,
  pattern_key text,
  was_drift_decision boolean NOT NULL DEFAULT false,
  drift_reason text,
  entry_time timestamptz DEFAULT now(),
  exit_time timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_training_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training trades"
  ON ai_training_trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own training trades"
  ON ai_training_trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training trades"
  ON ai_training_trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own training trades"
  ON ai_training_trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_training_accounts_user ON ai_training_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_training_accounts_status ON ai_training_accounts(status);
CREATE INDEX IF NOT EXISTS idx_training_trades_account ON ai_training_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_training_trades_user ON ai_training_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_training_trades_status ON ai_training_trades(status);
