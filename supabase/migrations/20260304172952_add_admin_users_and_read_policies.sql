/*
  # Add Admin Users Table and Read-Only Admin Policies

  1. New Tables
    - `admin_users`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `granted_by` (uuid, nullable)
      - `created_at` (timestamptz)
    
  2. Security
    - RLS enabled on `admin_users`
    - `is_admin()` helper function for policy checks
    - Admin SELECT policies on all key tables (view-only)

  3. Tables with admin read policies
    - paper_accounts, simulated_trades, ai_recommendations,
      ai_learning_history, ai_evolution_state, ai_evolution_notifications,
      ai_learned_adjustments, ai_drift_rollbacks, ai_drift_log,
      user_settings, profiles
*/

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

CREATE POLICY "Admins can view admin list"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all paper accounts"
  ON public.paper_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all simulated trades"
  ON public.simulated_trades
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai recommendations"
  ON public.ai_recommendations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai learning history"
  ON public.ai_learning_history
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai evolution state"
  ON public.ai_evolution_state
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai evolution notifications"
  ON public.ai_evolution_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai learned adjustments"
  ON public.ai_learned_adjustments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai drift rollbacks"
  ON public.ai_drift_rollbacks
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all ai drift log"
  ON public.ai_drift_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can view all user settings"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Some deployments don't use a `profiles` table. Only add this policy if it exists.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    CREATE POLICY "Admins can view all profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;
