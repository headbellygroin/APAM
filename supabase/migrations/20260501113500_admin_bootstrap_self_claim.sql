/*
  # Admin bootstrap: allow first admin self-claim

  Purpose:
  - In early deployments there may be no admin user yet, which hides Master AI pages.
  - This migration allows the **first** authenticated user to insert themselves into `public.admin_users`.
  - After at least one admin exists, only existing admins can grant admin access to others.

  Safety:
  - Non-admins can only insert a row where `user_id = auth.uid()`
    AND only when `admin_users` is empty.
*/

-- Allow first admin to self-claim (only if table is empty).
CREATE POLICY "Bootstrap first admin (self-claim)"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.admin_users)
  );

-- Allow existing admins to grant admin to others.
CREATE POLICY "Admins can grant admin"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

