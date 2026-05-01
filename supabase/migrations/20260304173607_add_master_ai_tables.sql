/*
  # Add Master AI Synthesis Tables

  1. New Tables
    - `master_ai_state`
      - `id` (uuid, primary key)
      - `synthesized_weights` (jsonb) - aggregated weights from all user AIs
      - `synthesized_thresholds` (jsonb) - aggregated threshold adjustments
      - `synthesized_patterns` (jsonb) - aggregated pattern overrides
      - `user_count` (integer) - number of users contributing
      - `total_trades_analyzed` (integer) - total trades across all users
      - `convergence_score` (numeric) - how much AIs agree (0-100)
      - `last_synthesis_at` (timestamptz)
      - `created_at` (timestamptz)

    - `master_ai_snapshots`
      - `id` (uuid, primary key)
      - `snapshot_data` (jsonb) - full snapshot of synthesized state
      - `user_contributions` (jsonb) - per-user stats at time of snapshot
      - `notes` (text) - admin notes
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Only admins can read master_ai_state
    - Only admins can read/insert master_ai_snapshots
*/

CREATE TABLE IF NOT EXISTS public.master_ai_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synthesized_weights jsonb DEFAULT '{}'::jsonb,
  synthesized_thresholds jsonb DEFAULT '{}'::jsonb,
  synthesized_patterns jsonb DEFAULT '{}'::jsonb,
  user_count integer DEFAULT 0,
  total_trades_analyzed integer DEFAULT 0,
  convergence_score numeric DEFAULT 0,
  last_synthesis_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.master_ai_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view master ai state"
  ON public.master_ai_state
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update master ai state"
  ON public.master_ai_state
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can insert master ai state"
  ON public.master_ai_state
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.master_ai_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_data jsonb DEFAULT '{}'::jsonb,
  user_contributions jsonb DEFAULT '{}'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.master_ai_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view master ai snapshots"
  ON public.master_ai_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert master ai snapshots"
  ON public.master_ai_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
