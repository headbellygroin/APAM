/*
  # Historical Fleet Backtesting System

  Enables running AI training accounts against historical market data at accelerated
  speeds. Historical accounts use the same rulesets, drift engines, and pattern
  discovery as live accounts, but operate on known past data so results can be
  validated against actual outcomes.

  1. New Tables
    - `historical_simulation_runs`
      - `id` (uuid, primary key) - unique run identifier
      - `user_id` (uuid, FK to auth.users) - owner
      - `name` (text) - descriptive name like "APAM 2008 Crisis Test"
      - `description` (text) - what this run is testing
      - `start_date` (date) - historical start date for the simulation
      - `end_date` (date) - historical end date for the simulation
      - `current_sim_date` (date) - where the sim has progressed to
      - `speed_multiplier` (int) - how many historical days per real tick (e.g. 5 = 5 days per tick)
      - `status` (text) - 'pending', 'running', 'paused', 'completed', 'failed'
      - `symbols` (text[]) - list of symbols to simulate against
      - `ruleset_snapshot` (jsonb) - frozen copy of the ruleset used at start
      - `results_summary` (jsonb) - aggregated results after completion
      - `total_trading_days` (int) - count of days processed so far
      - `errors` (text[]) - any errors encountered
      - `started_at` (timestamptz) - when the run began executing
      - `completed_at` (timestamptz) - when the run finished
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `historical_fleet_accounts`
      - `id` (uuid, primary key) - unique account identifier
      - `user_id` (uuid, FK to auth.users) - owner
      - `run_id` (uuid, FK to historical_simulation_runs) - which run this belongs to
      - `name` (text) - account name like "Strict APAM Control - 2008"
      - `account_type` (text) - 'control' (strict rules) or 'experimental' (drift-enabled)
      - `strategy_id` (text) - which strategy ruleset to follow
      - `mode` (text) - 'strict' or 'adaptive'
      - `starting_capital` (numeric) - starting balance
      - `current_capital` (numeric) - current balance
      - `risk_per_trade` (numeric) - % risk per trade
      - `max_positions` (int) - max concurrent positions
      - `total_trades` (int) - count of closed trades
      - `winning_trades` (int) - count of winning trades
      - `total_profit_loss` (numeric) - cumulative P&L
      - `win_rate` (numeric) - calculated win rate
      - `profit_factor` (numeric) - gross profit / gross loss
      - `max_drawdown` (numeric) - peak-to-trough decline
      - `learned_weights` (jsonb) - drift engine weights
      - `threshold_adjustments` (jsonb) - drift engine thresholds
      - `pattern_overrides` (jsonb) - drift engine patterns
      - `drift_decisions` (int) - drifted decision count
      - `total_decisions` (int) - total decisions made
      - `is_drifting` (boolean) - currently drifting
      - `equity_curve` (jsonb) - array of {date, equity} for charting
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `historical_fleet_trades`
      - `id` (uuid, primary key)
      - `account_id` (uuid, FK to historical_fleet_accounts)
      - `run_id` (uuid, FK to historical_simulation_runs)
      - `user_id` (uuid, FK to auth.users)
      - `sim_date` (date) - the simulated date this trade occurred
      - `symbol` (text) - ticker
      - `trade_type` (text) - 'long' or 'short'
      - `entry_price` (numeric)
      - `exit_price` (numeric)
      - `stop_loss` (numeric)
      - `target_price` (numeric)
      - `position_size` (numeric)
      - `profit_loss` (numeric) - net P&L
      - `status` (text) - 'open', 'closed'
      - `exit_reason` (text) - 'target', 'stop', 'manual', 'time'
      - `odds_score` (numeric)
      - `pattern_key` (text)
      - `was_drift_decision` (boolean)
      - `drift_reason` (text)
      - `entry_time` (timestamptz) - simulated entry timestamp
      - `exit_time` (timestamptz) - simulated exit timestamp
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all 3 tables
    - Users can only manage their own historical simulation data
*/

CREATE TABLE IF NOT EXISTS historical_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  current_sim_date date,
  speed_multiplier int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  symbols text[] NOT NULL DEFAULT '{}',
  ruleset_snapshot jsonb DEFAULT '{}',
  results_summary jsonb DEFAULT '{}',
  total_trading_days int NOT NULL DEFAULT 0,
  errors text[] NOT NULL DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE historical_simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historical runs"
  ON historical_simulation_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own historical runs"
  ON historical_simulation_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own historical runs"
  ON historical_simulation_runs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own historical runs"
  ON historical_simulation_runs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS historical_fleet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  run_id uuid NOT NULL REFERENCES historical_simulation_runs(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'control' CHECK (account_type IN ('control', 'experimental')),
  strategy_id text NOT NULL DEFAULT 'trade-surge',
  mode text NOT NULL DEFAULT 'strict' CHECK (mode IN ('strict', 'adaptive')),
  starting_capital numeric NOT NULL DEFAULT 25000,
  current_capital numeric NOT NULL DEFAULT 25000,
  risk_per_trade numeric NOT NULL DEFAULT 1.0,
  max_positions int NOT NULL DEFAULT 3,
  total_trades int NOT NULL DEFAULT 0,
  winning_trades int NOT NULL DEFAULT 0,
  total_profit_loss numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  profit_factor numeric NOT NULL DEFAULT 0,
  max_drawdown numeric NOT NULL DEFAULT 0,
  learned_weights jsonb DEFAULT '{"strengthScore":1,"timeScore":1,"freshnessScore":1,"trendScore":1,"curveScore":1,"profitZoneScore":1}',
  threshold_adjustments jsonb DEFAULT '{"minOddsScore":0,"minRiskReward":0,"confidenceFloor":0}',
  pattern_overrides jsonb DEFAULT '{}',
  drift_decisions int NOT NULL DEFAULT 0,
  total_decisions int NOT NULL DEFAULT 0,
  is_drifting boolean NOT NULL DEFAULT false,
  equity_curve jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE historical_fleet_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historical fleet accounts"
  ON historical_fleet_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own historical fleet accounts"
  ON historical_fleet_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own historical fleet accounts"
  ON historical_fleet_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own historical fleet accounts"
  ON historical_fleet_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS historical_fleet_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES historical_fleet_accounts(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES historical_simulation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  sim_date date NOT NULL,
  symbol text NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('long', 'short')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric NOT NULL,
  target_price numeric NOT NULL,
  position_size numeric NOT NULL,
  profit_loss numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  exit_reason text CHECK (exit_reason IN ('target', 'stop', 'manual', 'time')),
  odds_score numeric,
  pattern_key text,
  was_drift_decision boolean NOT NULL DEFAULT false,
  drift_reason text,
  entry_time timestamptz,
  exit_time timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE historical_fleet_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historical fleet trades"
  ON historical_fleet_trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own historical fleet trades"
  ON historical_fleet_trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own historical fleet trades"
  ON historical_fleet_trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own historical fleet trades"
  ON historical_fleet_trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_historical_runs_user ON historical_simulation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_historical_runs_status ON historical_simulation_runs(status);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_accounts_run ON historical_fleet_accounts(run_id);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_accounts_user ON historical_fleet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_trades_account ON historical_fleet_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_trades_run ON historical_fleet_trades(run_id);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_trades_user ON historical_fleet_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_historical_fleet_trades_sim_date ON historical_fleet_trades(sim_date);
