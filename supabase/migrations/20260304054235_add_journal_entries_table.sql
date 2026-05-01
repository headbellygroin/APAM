/*
  # Add Journal Entries Table
  
  ## Overview
  This migration adds a journal_entries table for users to document their trades,
  emotions, and lessons learned independently of the simulated trades system.
  
  ## New Tables
  
  ### journal_entries
  - `id` (uuid, PK) - Journal entry identifier
  - `user_id` (uuid, FK) - User who created the entry
  - `symbol` (text, nullable) - Stock symbol if applicable
  - `trade_date` (date) - Date of the trade or journal entry
  - `trade_type` (text, nullable) - 'long' or 'short'
  - `entry_price` (decimal, nullable) - Entry price
  - `exit_price` (decimal, nullable) - Exit price
  - `profit_loss` (decimal, nullable) - Calculated P&L
  - `notes` (text, nullable) - General notes about the trade
  - `emotions` (text, nullable) - Emotional state during/after trade
  - `lessons_learned` (text, nullable) - Key takeaways from the trade
  - `created_at` (timestamptz) - When entry was created
  
  ## Security
  - Enable RLS on journal_entries table
  - Users can only access their own journal entries
*/

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol text,
  trade_date date NOT NULL DEFAULT CURRENT_DATE,
  trade_type text CHECK (trade_type IN ('long', 'short')),
  entry_price decimal(12,4),
  exit_price decimal(12,4),
  profit_loss decimal(12,2),
  notes text,
  emotions text,
  lessons_learned text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_trade_date ON journal_entries(trade_date DESC);