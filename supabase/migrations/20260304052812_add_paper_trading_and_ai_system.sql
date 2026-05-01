/*
  # Paper Trading and AI Recommendation System
  
  ## Overview
  This migration adds paper trading (virtual money) accounts and an AI-powered recommendation
  system that learns and improves through simulated trades.
  
  ## New Tables
  
  ### 1. paper_accounts
  - `id` (uuid, PK) - Account identifier
  - `user_id` (uuid, FK) - Account owner
  - `name` (text) - Account name (e.g., "Main Practice Account")
  - `starting_balance` (decimal) - Initial virtual balance
  - `current_balance` (decimal) - Current virtual balance
  - `total_profit_loss` (decimal) - Cumulative P&L
  - `is_active` (boolean) - Whether account is active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 2. simulated_trades
  - `id` (uuid, PK) - Trade identifier
  - `user_id` (uuid, FK) - User who owns the simulation
  - `paper_account_id` (uuid, FK) - Virtual account
  - `symbol` (text) - Asset symbol
  - `trade_type` (text) - 'long' or 'short'
  - `is_ai_recommended` (boolean) - Whether AI suggested this trade
  - `ai_confidence_score` (decimal) - AI confidence (0-10)
  - `odds_score` (decimal) - Odds enhancer score
  - `entry_price` (decimal) - Entry price
  - `stop_loss` (decimal) - Stop price
  - `target_price` (decimal) - Target price
  - `position_size` (decimal) - Number of shares
  - `risk_amount` (decimal) - Dollar risk
  - `reward_amount` (decimal) - Potential reward
  - `status` (text) - 'pending', 'open', 'closed', 'cancelled'
  - `entry_time` (timestamptz) - When entered
  - `exit_time` (timestamptz) - When exited
  - `exit_price` (decimal) - Exit price
  - `profit_loss` (decimal) - Actual P&L
  - `exit_reason` (text) - 'target', 'stop', 'manual', 'time'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 3. ai_recommendations
  - `id` (uuid, PK) - Recommendation identifier
  - `user_id` (uuid, FK) - User receiving recommendation
  - `symbol` (text) - Recommended symbol
  - `action` (text) - 'long', 'short', 'no_action'
  - `confidence_score` (decimal) - AI confidence (0-10)
  - `odds_score` (decimal) - Odds enhancer score
  - `entry_price` (decimal) - Suggested entry
  - `stop_loss` (decimal) - Suggested stop
  - `target_price` (decimal) - Suggested target
  - `reasoning` (jsonb) - Why AI made this recommendation
  - `was_taken` (boolean) - Whether user/system took the trade
  - `simulated_trade_id` (uuid, FK) - If executed as simulation
  - `outcome` (text) - 'win', 'loss', 'pending', 'ignored'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 4. ai_learning_history
  - `id` (uuid, PK) - Learning event identifier
  - `user_id` (uuid, FK) - User's AI instance
  - `event_type` (text) - 'trade_completed', 'parameter_adjusted', 'pattern_learned'
  - `performance_metric` (decimal) - Win rate, profit factor, etc.
  - `adjustments` (jsonb) - What was learned/changed
  - `created_at` (timestamptz)
  
  ### 5. market_scans
  - `id` (uuid, PK) - Scan identifier
  - `user_id` (uuid, FK) - User who ran the scan
  - `scan_type` (text) - 'high_probability', 'breakout', 'zone_test'
  - `timeframe` (text) - Chart timeframe
  - `min_score` (decimal) - Minimum odds score filter
  - `results` (jsonb) - Array of matching symbols and scores
  - `created_at` (timestamptz)
  
  ## Modified Tables
  
  - Add `paper_account_id` to existing `trades` table to link real trades to practice accounts
  
  ## Security
  - Enable RLS on all new tables
  - Users can only access their own paper accounts, simulations, and recommendations
*/

-- Create paper_accounts table
CREATE TABLE IF NOT EXISTS paper_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  starting_balance decimal(12,2) NOT NULL,
  current_balance decimal(12,2) NOT NULL,
  total_profit_loss decimal(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE paper_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paper accounts"
  ON paper_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper accounts"
  ON paper_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper accounts"
  ON paper_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper accounts"
  ON paper_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create simulated_trades table
CREATE TABLE IF NOT EXISTS simulated_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  paper_account_id uuid REFERENCES paper_accounts(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('long', 'short')),
  is_ai_recommended boolean DEFAULT false,
  ai_confidence_score decimal(4,2) DEFAULT 0,
  odds_score decimal(4,2) DEFAULT 0,
  entry_price decimal(12,4) NOT NULL,
  stop_loss decimal(12,4) NOT NULL,
  target_price decimal(12,4) NOT NULL,
  position_size decimal(12,4) NOT NULL,
  risk_amount decimal(12,2) DEFAULT 0,
  reward_amount decimal(12,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'closed', 'cancelled')),
  entry_time timestamptz,
  exit_time timestamptz,
  exit_price decimal(12,4),
  profit_loss decimal(12,2),
  exit_reason text CHECK (exit_reason IN ('target', 'stop', 'manual', 'time')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE simulated_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulated trades"
  ON simulated_trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own simulated trades"
  ON simulated_trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own simulated trades"
  ON simulated_trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own simulated trades"
  ON simulated_trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create ai_recommendations table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  action text NOT NULL CHECK (action IN ('long', 'short', 'no_action')),
  confidence_score decimal(4,2) DEFAULT 0,
  odds_score decimal(4,2) DEFAULT 0,
  entry_price decimal(12,4),
  stop_loss decimal(12,4),
  target_price decimal(12,4),
  reasoning jsonb DEFAULT '{}'::jsonb,
  was_taken boolean DEFAULT false,
  simulated_trade_id uuid REFERENCES simulated_trades(id) ON DELETE SET NULL,
  outcome text CHECK (outcome IN ('win', 'loss', 'pending', 'ignored')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai recommendations"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai recommendations"
  ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai recommendations"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai recommendations"
  ON ai_recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create ai_learning_history table
CREATE TABLE IF NOT EXISTS ai_learning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  performance_metric decimal(8,4),
  adjustments jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_learning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai learning history"
  ON ai_learning_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai learning history"
  ON ai_learning_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create market_scans table
CREATE TABLE IF NOT EXISTS market_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  scan_type text NOT NULL,
  timeframe text NOT NULL,
  min_score decimal(4,2) DEFAULT 7,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE market_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own market scans"
  ON market_scans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own market scans"
  ON market_scans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own market scans"
  ON market_scans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add paper_account_id to existing trades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'paper_account_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN paper_account_id uuid REFERENCES paper_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_paper_accounts_user_id ON paper_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_user_id ON simulated_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_paper_account_id ON simulated_trades(paper_account_id);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_status ON simulated_trades(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_was_taken ON ai_recommendations(was_taken);
CREATE INDEX IF NOT EXISTS idx_ai_learning_history_user_id ON ai_learning_history(user_id);
CREATE INDEX IF NOT EXISTS idx_market_scans_user_id ON market_scans(user_id);