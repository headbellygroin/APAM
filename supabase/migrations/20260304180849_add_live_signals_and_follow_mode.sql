/*
  # Live Signals, Follow Mode, and Signal Track Record

  1. New Tables
    - `signal_queue`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `symbol` (text) - ticker symbol
      - `action` (text) - long or short
      - `confidence_score` (numeric) - AI confidence at time of signal
      - `odds_score` (numeric) - raw odds score
      - `entry_price` (numeric) - recommended entry
      - `stop_loss` (numeric) - recommended stop
      - `target_price` (numeric) - recommended target
      - `pattern_key` (text) - curve-trend-zone pattern identifier
      - `strength_tier` (text) - strong_edge, developing_edge, or experimental
      - `reasoning` (jsonb) - full AI analysis reasoning
      - `strategy_id` (text) - which strategy generated this
      - `status` (text) - active, expired, executed, or closed
      - `expired_at` (timestamptz) - when the signal expires
      - `executed_at` (timestamptz) - when the signal was paper-traded
      - `trade_id` (uuid) - link to simulated_trades if executed
      - `exit_price` (numeric) - final exit price after trade closes
      - `profit_loss` (numeric) - net P/L after trade closes
      - `exit_reason` (text) - target, stop, manual, time
      - `auto_executed` (boolean) - whether follow mode triggered this
      - `created_at` (timestamptz)

    - `signal_track_record`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `pattern_key` (text) - curve-trend-zone pattern identifier
      - `total_signals` (integer) - how many times this pattern fired
      - `total_executed` (integer) - how many were taken
      - `wins` (integer)
      - `losses` (integer)
      - `total_profit` (numeric) - sum of winning P/L
      - `total_loss` (numeric) - sum of losing P/L (absolute)
      - `avg_win` (numeric)
      - `avg_loss` (numeric)
      - `best_win` (numeric)
      - `worst_loss` (numeric)
      - `avg_confidence_at_entry` (numeric)
      - `last_signal_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `follow_mode_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users, unique)
      - `enabled` (boolean) - master toggle
      - `min_strength_tier` (text) - minimum tier to auto-copy (strong_edge, developing_edge, experimental)
      - `paper_account_id` (uuid) - which paper account to use
      - `risk_percent` (numeric) - position sizing risk %
      - `max_daily_trades` (integer) - max auto trades per day
      - `trades_today` (integer) - counter reset daily
      - `last_trade_date` (date) - for daily reset logic
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Users can only access their own data
    - Separate policies for SELECT, INSERT, UPDATE, DELETE

  3. Important Notes
    - signal_queue stores every AI signal whether acted on or not
    - signal_track_record aggregates per-pattern performance over time
    - follow_mode_settings controls the auto-copy behavior per user
    - strength_tier is computed from pattern win rate and sample size
*/

CREATE TABLE IF NOT EXISTS signal_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol text NOT NULL,
  action text NOT NULL DEFAULT '',
  confidence_score numeric NOT NULL DEFAULT 0,
  odds_score numeric NOT NULL DEFAULT 0,
  entry_price numeric NOT NULL DEFAULT 0,
  stop_loss numeric NOT NULL DEFAULT 0,
  target_price numeric NOT NULL DEFAULT 0,
  pattern_key text NOT NULL DEFAULT '',
  strength_tier text NOT NULL DEFAULT 'experimental',
  reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  expired_at timestamptz,
  executed_at timestamptz,
  trade_id uuid,
  exit_price numeric,
  profit_loss numeric,
  exit_reason text,
  auto_executed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signal_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
  ON signal_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
  ON signal_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
  ON signal_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own signals"
  ON signal_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS signal_track_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  pattern_key text NOT NULL,
  total_signals integer NOT NULL DEFAULT 0,
  total_executed integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  total_loss numeric NOT NULL DEFAULT 0,
  avg_win numeric NOT NULL DEFAULT 0,
  avg_loss numeric NOT NULL DEFAULT 0,
  best_win numeric NOT NULL DEFAULT 0,
  worst_loss numeric NOT NULL DEFAULT 0,
  avg_confidence_at_entry numeric NOT NULL DEFAULT 0,
  last_signal_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pattern_key)
);

ALTER TABLE signal_track_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own track records"
  ON signal_track_record FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own track records"
  ON signal_track_record FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own track records"
  ON signal_track_record FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own track records"
  ON signal_track_record FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS follow_mode_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  min_strength_tier text NOT NULL DEFAULT 'strong_edge',
  paper_account_id uuid,
  risk_percent numeric NOT NULL DEFAULT 1,
  max_daily_trades integer NOT NULL DEFAULT 5,
  trades_today integer NOT NULL DEFAULT 0,
  last_trade_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE follow_mode_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own follow settings"
  ON follow_mode_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follow settings"
  ON follow_mode_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow settings"
  ON follow_mode_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own follow settings"
  ON follow_mode_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_signal_queue_user_status ON signal_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_signal_queue_user_created ON signal_queue(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_queue_pattern ON signal_queue(user_id, pattern_key);
CREATE INDEX IF NOT EXISTS idx_signal_track_record_user ON signal_track_record(user_id);
