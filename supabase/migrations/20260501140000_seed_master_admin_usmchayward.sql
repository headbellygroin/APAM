-- Grant admin_users row for master email when that auth user already exists.
-- Needed so public.is_admin() and RLS policies match the app’s master-admin gate.
INSERT INTO public.admin_users (user_id, granted_by)
SELECT u.id, u.id
FROM auth.users u
WHERE lower(trim(u.email)) = 'usmchayward@yahoo.com'
ON CONFLICT (user_id) DO NOTHING;
