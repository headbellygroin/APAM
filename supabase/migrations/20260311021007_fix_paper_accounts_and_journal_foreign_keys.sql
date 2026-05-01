/*
  # Fix Foreign Key Constraints

  1. Changes
    - Drop existing foreign key constraints on paper_accounts and journal_entries
    - Recreate them to reference auth.users instead of profiles table
    - This fixes the FK violation errors when creating accounts/entries

  2. Security
    - Maintains existing RLS policies
    - No changes to access control
*/

-- Fix paper_accounts foreign key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'paper_accounts_user_id_fkey' 
    AND table_name = 'paper_accounts'
  ) THEN
    ALTER TABLE paper_accounts DROP CONSTRAINT paper_accounts_user_id_fkey;
  END IF;
END $$;

ALTER TABLE paper_accounts 
ADD CONSTRAINT paper_accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix journal_entries foreign key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'journal_entries_user_id_fkey' 
    AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE journal_entries DROP CONSTRAINT journal_entries_user_id_fkey;
  END IF;
END $$;

ALTER TABLE journal_entries 
ADD CONSTRAINT journal_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;