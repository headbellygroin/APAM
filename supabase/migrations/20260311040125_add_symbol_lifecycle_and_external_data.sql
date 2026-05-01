/*
  # Symbol Lifecycle and External Data Sources

  ## Summary
  Addresses two real-world historical simulation problems:

  1. **Symbol Lifecycle** — Stocks get listed, de-listed, go bankrupt, merge, or change tickers.
     The simulator needs to know when a symbol was active so it can skip it silently if a
     simulation date falls outside the symbol's trading window.

  2. **External Data Sources** — Macro context data (corn prices, oil futures, CPI, interest
     rates, etc.) that the AI can use as supplemental signal inputs. Users can upload or
     reference external datasets here.

  ## New Tables

  ### symbol_lifecycle
  - Tracks each symbol's listed date, de-listed date, and reason for removal
  - Used by the simulation engine to skip symbols that don't exist on a given date
  - Populated manually by admin or via import

  ### external_data_sources
  - Catalog of macro/alternative data sources available to the AI
  - Examples: corn futures, oil futures, CPI, fed funds rate, VIX, unemployment
  - Stores source type, data provider, description, and date range covered
  - Links to external URLs or upload identifiers

  ### external_data_series
  - The actual data points for each external data source
  - date + value pairs (e.g., 2008-01-03 = $96.12/barrel for crude oil)
  - Indexed for fast date-range queries during simulation

  ### market_index_components
  - Tracks which symbols were IN a given index on a given date range
  - Enables "run against the entire S&P 500 as it existed in 2003" mode
  - Also tracks index weight at time of inclusion

  ## Security
  - RLS enabled on all tables
  - Admins can write, all authenticated users can read
*/

CREATE TABLE IF NOT EXISTS symbol_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  name text DEFAULT '',
  exchange text DEFAULT '',
  sector text DEFAULT '',
  industry text DEFAULT '',
  listed_date date,
  delisted_date date,
  delist_reason text DEFAULT '' CHECK (delist_reason IN ('', 'bankruptcy', 'merger', 'acquisition', 'voluntarily_delisted', 'regulatory', 'unknown')),
  merged_into text DEFAULT '',
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_lifecycle_symbol ON symbol_lifecycle(symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_lifecycle_active ON symbol_lifecycle(is_active);
CREATE INDEX IF NOT EXISTS idx_symbol_lifecycle_dates ON symbol_lifecycle(listed_date, delisted_date);
CREATE INDEX IF NOT EXISTS idx_symbol_lifecycle_sector ON symbol_lifecycle(sector);

ALTER TABLE symbol_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view symbol lifecycle"
  ON symbol_lifecycle FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert symbol lifecycle"
  ON symbol_lifecycle FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update symbol lifecycle"
  ON symbol_lifecycle FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS external_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL CHECK (category IN (
    'commodity', 'energy', 'agricultural', 'macro_economic', 'interest_rates',
    'currency', 'volatility', 'sentiment', 'weather', 'custom'
  )),
  source_provider text DEFAULT '',
  ticker_or_code text DEFAULT '',
  unit text DEFAULT '',
  frequency text DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
  date_range_start date,
  date_range_end date,
  data_points_count integer DEFAULT 0,
  source_url text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_data_sources_user ON external_data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_data_sources_category ON external_data_sources(category);

ALTER TABLE external_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all external data sources"
  ON external_data_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert external data sources"
  ON external_data_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own external data sources"
  ON external_data_sources FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own external data sources"
  ON external_data_sources FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS external_data_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES external_data_sources(id) ON DELETE CASCADE NOT NULL,
  series_date date NOT NULL,
  value numeric(20, 6) NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_data_series_source ON external_data_series(source_id);
CREATE INDEX IF NOT EXISTS idx_ext_data_series_date ON external_data_series(series_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_data_series_source_date ON external_data_series(source_id, series_date);

ALTER TABLE external_data_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all data series"
  ON external_data_series FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert data series"
  ON external_data_series FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM external_data_sources
      WHERE id = source_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own data series"
  ON external_data_series FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM external_data_sources
      WHERE id = source_id AND user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS market_index_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name text NOT NULL CHECK (index_name IN ('SP500', 'NASDAQ100', 'DOW30', 'RUSSELL2000', 'SP400', 'SP600', 'custom')),
  symbol text NOT NULL,
  company_name text DEFAULT '',
  sector text DEFAULT '',
  added_date date NOT NULL,
  removed_date date,
  weight_pct numeric(8,4) DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_index_symbol ON market_index_components(symbol);
CREATE INDEX IF NOT EXISTS idx_market_index_name ON market_index_components(index_name);
CREATE INDEX IF NOT EXISTS idx_market_index_dates ON market_index_components(added_date, removed_date);

ALTER TABLE market_index_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view index components"
  ON market_index_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage index components"
  ON market_index_components FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update index components"
  ON market_index_components FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'historical_simulation_runs' AND column_name = 'symbol_mode'
  ) THEN
    ALTER TABLE historical_simulation_runs
      ADD COLUMN symbol_mode text DEFAULT 'manual' CHECK (symbol_mode IN ('manual', 'index', 'sector', 'whole_market')),
      ADD COLUMN index_name text DEFAULT '',
      ADD COLUMN sector_filter text DEFAULT '',
      ADD COLUMN external_data_source_ids uuid[] DEFAULT '{}';
  END IF;
END $$;
