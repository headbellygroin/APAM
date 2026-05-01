/*
  # AI Personality System and Bankruptcy Protection

  1. New Columns for AI Training Accounts
    - Personality Traits (1-10 scale)
      - `risk_appetite` - How much risk the AI is willing to take
      - `trade_frequency` - How often the AI wants to trade
      - `adaptation_speed` - How quickly the AI learns and adapts
    - Balance Thresholds
      - `starting_balance` - Initial balance for reference
      - `critical_threshold` - Balance level that triggers extreme caution
      - `warning_threshold` - Balance level that triggers increased caution
    - Status Tracking
      - `is_bankrupt` - Whether AI has hit critical threshold
      - `bankrupt_at` - When bankruptcy occurred
      - `risk_tier` - Current risk tier (bankrupt, critical, warning, comfortable)
    - Performance Metadata
      - `personality_name` - Human-readable personality description
      - `trades_while_critical` - Count of trades made in critical state

  2. Updates
    - Add personality traits to existing accounts with random values
    - Calculate current risk tier based on current_capital
    - Set starting_balance to starting_capital for existing accounts

  3. Security
    - Maintain existing RLS policies
    - No changes to access control
*/

-- Add personality and bankruptcy protection columns
DO $$
BEGIN
  -- Personality traits (1-10 scale)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'risk_appetite'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN risk_appetite integer DEFAULT 5 CHECK (risk_appetite >= 1 AND risk_appetite <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'trade_frequency'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN trade_frequency integer DEFAULT 5 CHECK (trade_frequency >= 1 AND trade_frequency <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'adaptation_speed'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN adaptation_speed integer DEFAULT 5 CHECK (adaptation_speed >= 1 AND adaptation_speed <= 10);
  END IF;

  -- Balance thresholds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'starting_balance'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN starting_balance numeric DEFAULT 100000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'critical_threshold'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN critical_threshold numeric DEFAULT 20000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'warning_threshold'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN warning_threshold numeric DEFAULT 50000;
  END IF;

  -- Status tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'is_bankrupt'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN is_bankrupt boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'bankrupt_at'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN bankrupt_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'risk_tier'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN risk_tier text DEFAULT 'comfortable' CHECK (risk_tier IN ('bankrupt', 'critical', 'warning', 'comfortable'));
  END IF;

  -- Performance metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'personality_name'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN personality_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_accounts' AND column_name = 'trades_while_critical'
  ) THEN
    ALTER TABLE ai_training_accounts ADD COLUMN trades_while_critical integer DEFAULT 0;
  END IF;
END $$;

-- Update existing accounts with random personalities and set starting balance
UPDATE ai_training_accounts
SET
  risk_appetite = (random() * 9 + 1)::integer,
  trade_frequency = (random() * 9 + 1)::integer,
  adaptation_speed = (random() * 9 + 1)::integer,
  starting_balance = starting_capital,
  critical_threshold = starting_capital * 0.2,
  warning_threshold = starting_capital * 0.5
WHERE risk_appetite IS NULL;

-- Function to calculate risk tier based on balance
CREATE OR REPLACE FUNCTION calculate_risk_tier(
  current_balance numeric,
  critical numeric,
  warning numeric
) RETURNS text AS $$
BEGIN
  IF current_balance < critical THEN
    RETURN 'bankrupt';
  ELSIF current_balance < warning THEN
    RETURN 'critical';
  ELSIF current_balance < (warning * 1.6) THEN
    RETURN 'warning';
  ELSE
    RETURN 'comfortable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate personality name
CREATE OR REPLACE FUNCTION generate_personality_name(
  risk integer,
  frequency integer,
  adaptation integer
) RETURNS text AS $$
BEGIN
  IF risk <= 3 AND frequency <= 3 THEN
    RETURN 'The Sniper';
  ELSIF risk >= 8 AND frequency >= 8 THEN
    RETURN 'The Gambler';
  ELSIF risk >= 8 AND adaptation <= 4 THEN
    RETURN 'The Cowboy';
  ELSIF risk <= 4 AND adaptation >= 7 THEN
    RETURN 'The Scholar';
  ELSIF risk >= 7 AND adaptation >= 7 THEN
    RETURN 'The Maverick';
  ELSIF risk <= 3 AND adaptation <= 3 THEN
    RETURN 'The Guardian';
  ELSIF frequency >= 8 AND adaptation >= 7 THEN
    RETURN 'The Dynamo';
  ELSIF frequency <= 3 AND adaptation >= 7 THEN
    RETURN 'The Strategist';
  ELSE
    RETURN 'The Professor';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update personality names for existing accounts
UPDATE ai_training_accounts
SET personality_name = generate_personality_name(risk_appetite, trade_frequency, adaptation_speed)
WHERE personality_name IS NULL;

-- Create index for quick bankruptcy checks
CREATE INDEX IF NOT EXISTS idx_training_accounts_risk_tier ON ai_training_accounts(risk_tier);
CREATE INDEX IF NOT EXISTS idx_training_accounts_bankrupt ON ai_training_accounts(is_bankrupt) WHERE is_bankrupt = true;

-- Create table to track bankruptcy events
CREATE TABLE IF NOT EXISTS ai_bankruptcy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ai_training_accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('bankrupt', 'recovered', 'tier_change')),
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  previous_tier text,
  new_tier text,
  triggered_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE ai_bankruptcy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bankruptcy events for their accounts"
  ON ai_bankruptcy_events FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM ai_training_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all bankruptcy events"
  ON ai_bankruptcy_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert bankruptcy events"
  ON ai_bankruptcy_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for bankruptcy event queries
CREATE INDEX IF NOT EXISTS idx_bankruptcy_events_account ON ai_bankruptcy_events(account_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_bankruptcy_events_type ON ai_bankruptcy_events(event_type, triggered_at DESC);