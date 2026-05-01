/*
  # Auto-create profile on user signup

  1. New Function
    - `handle_new_user()` - trigger function that inserts a row into `profiles`
      whenever a new user is created in `auth.users`
    - Extracts `email` from the new auth user
    - Extracts `full_name` from `raw_user_meta_data` if available

  2. New Trigger
    - `on_auth_user_created` - fires after insert on `auth.users`
    - Calls `handle_new_user()` to ensure a profile always exists

  3. Backfill
    - Inserts profiles for any existing auth users that don't have one yet

  4. Important Notes
    - This fixes the foreign key violation on `watchlists`, `trade_plans`,
      `trades`, `simulated_trades`, and all other tables that reference `profiles`
    - Without this trigger, no user could insert data into any of those tables
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', ''),
  u.created_at,
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
