/*
  # Daily Candles Archive

  ## Summary
  Adds persistent storage for end-of-day OHLCV candle data so that live API data
  is archived daily and historical backtests can read from the database instead of
  calling the Tradier API repeatedly.

  ## New Tables

  ### daily_candles
  - Stores one row per symbol per trading date with full OHLCV data
  - Indexed on (symbol, trade_date) with a unique constraint to prevent duplicates
  - source column tracks whether data came from live archival or a manual backfill
  - Shared across all users (global market data, not user-specific)

  ## Security
  - RLS enabled: all authenticated users can read candles
  - Inserts and updates allowed for authenticated users (data is global market data)
  - No delete policy — candle data should never be destroyed

  ## Notes
  1. The (symbol, trade_date) unique constraint ensures upsert operations are safe
  2. volume is stored as bigint since daily volume can exceed int range for liquid stocks
  3. source values: 'tradier_live' = end-of-day archive, 'tradier_backfill' = historical pull,
     'csv_import' = manual CSV upload
*/

CREATE TABLE IF NOT EXISTS daily_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  trade_date date NOT NULL,
  open numeric(12, 4) NOT NULL,
  high numeric(12, 4) NOT NULL,
  low numeric(12, 4) NOT NULL,
  close numeric(12, 4) NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'tradier_backfill' CHECK (source IN ('tradier_live', 'tradier_backfill', 'csv_import')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT daily_candles_symbol_date_unique UNIQUE (symbol, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_candles_symbol ON daily_candles(symbol);
CREATE INDEX IF NOT EXISTS idx_daily_candles_trade_date ON daily_candles(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_candles_symbol_date ON daily_candles(symbol, trade_date DESC);

ALTER TABLE daily_candles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read candles"
  ON daily_candles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert candles"
  ON daily_candles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update candles"
  ON daily_candles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
