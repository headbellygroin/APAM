/*
  # Add LLM Analysis Tables

  1. New Tables
    - `llm_trade_analyses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `symbol` (text) - Ticker symbol analyzed
      - `analysis_type` (text) - Type: trade_analysis, journal_insight, strategy_generation, eod_review
      - `input_data` (jsonb) - Data sent to the LLM
      - `llm_response` (jsonb) - Full response from the LLM
      - `summary` (text) - Human-readable summary
      - `confidence` (numeric) - Confidence score 0-100
      - `created_at` (timestamptz)

    - `llm_journal_insights`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `analysis_period_start` (date)
      - `analysis_period_end` (date)
      - `entries_analyzed` (integer)
      - `patterns_found` (jsonb) - Behavioral patterns detected
      - `emotional_trends` (jsonb) - Emotional analysis
      - `recommendations` (text[]) - Actionable recommendations
      - `summary` (text)
      - `created_at` (timestamptz)

    - `llm_strategy_proposals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `proposal_name` (text)
      - `based_on_fleet_data` (jsonb) - Performance data used
      - `proposed_weights` (jsonb) - Suggested weight changes
      - `proposed_thresholds` (jsonb) - Suggested threshold changes
      - `proposed_patterns` (jsonb) - Suggested pattern overrides
      - `reasoning` (text) - LLM reasoning for changes
      - `expected_improvement` (text)
      - `status` (text) - pending, applied, rejected
      - `created_at` (timestamptz)

    - `llm_eod_narratives`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `review_date` (date)
      - `eod_review_data` (jsonb) - Raw EOD review data
      - `narrative` (text) - LLM-generated narrative
      - `spawn_reasoning` (text) - LLM reasoning for spawn/retire
      - `risk_assessment` (text) - Overall risk narrative
      - `next_day_strategy` (text) - LLM-suggested next day approach
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only read/write their own data
*/

CREATE TABLE IF NOT EXISTS llm_trade_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol text NOT NULL DEFAULT '',
  analysis_type text NOT NULL DEFAULT 'trade_analysis',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  llm_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_trade_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trade analyses"
  ON llm_trade_analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trade analyses"
  ON llm_trade_analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS llm_journal_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  analysis_period_start date NOT NULL DEFAULT CURRENT_DATE,
  analysis_period_end date NOT NULL DEFAULT CURRENT_DATE,
  entries_analyzed integer NOT NULL DEFAULT 0,
  patterns_found jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotional_trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_journal_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own journal insights"
  ON llm_journal_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal insights"
  ON llm_journal_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS llm_strategy_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  proposal_name text NOT NULL DEFAULT '',
  based_on_fleet_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning text NOT NULL DEFAULT '',
  expected_improvement text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_strategy_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own strategy proposals"
  ON llm_strategy_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategy proposals"
  ON llm_strategy_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy proposals"
  ON llm_strategy_proposals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS llm_eod_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  eod_review_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text NOT NULL DEFAULT '',
  spawn_reasoning text NOT NULL DEFAULT '',
  risk_assessment text NOT NULL DEFAULT '',
  next_day_strategy text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_eod_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own eod narratives"
  ON llm_eod_narratives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own eod narratives"
  ON llm_eod_narratives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_llm_trade_analyses_user ON llm_trade_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_journal_insights_user ON llm_journal_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_strategy_proposals_user ON llm_strategy_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_llm_eod_narratives_user ON llm_eod_narratives(user_id, review_date DESC);
