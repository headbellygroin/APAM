/*
  # Add Trading Fee Simulation Columns

  1. Modified Tables
    - `simulated_trades`
      - `entry_fees` (decimal) - Fees paid at trade entry (commission + ECN)
      - `exit_fees` (decimal) - Fees paid at trade exit (commission + SEC + TAF + ECN)
      - `total_fees` (decimal) - Combined entry + exit fees
      - `gross_profit_loss` (decimal) - P/L before fees
      - `fee_breakdown` (jsonb) - Detailed breakdown of entry fees

    - `user_settings`
      - `fee_schedule` (jsonb) - Custom fee schedule overrides per user

  2. Notes
    - profit_loss column now represents NET P/L (after all fees)
    - gross_profit_loss stores the raw P/L before fee deduction
    - Default fee schedule models typical broker costs:
      commission, SEC fee, TAF fee, ECN fees
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulated_trades' AND column_name = 'entry_fees'
  ) THEN
    ALTER TABLE simulated_trades ADD COLUMN entry_fees decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulated_trades' AND column_name = 'exit_fees'
  ) THEN
    ALTER TABLE simulated_trades ADD COLUMN exit_fees decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulated_trades' AND column_name = 'total_fees'
  ) THEN
    ALTER TABLE simulated_trades ADD COLUMN total_fees decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulated_trades' AND column_name = 'gross_profit_loss'
  ) THEN
    ALTER TABLE simulated_trades ADD COLUMN gross_profit_loss decimal(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulated_trades' AND column_name = 'fee_breakdown'
  ) THEN
    ALTER TABLE simulated_trades ADD COLUMN fee_breakdown jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'fee_schedule'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN fee_schedule jsonb DEFAULT NULL;
  END IF;
END $$;