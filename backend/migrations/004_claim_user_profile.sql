SET search_path TO archive1863, public;

CREATE OR REPLACE FUNCTION public.claim_user_profile()
RETURNS TABLE(
  auth_user_id UUID,
  email TEXT,
  role TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt()->>'email', ''));
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  -- Keep the existing profile role; only reconcile ownership to the active auth user.
  UPDATE archive1863.user_profiles up
  SET auth_user_id = v_uid,
      updated_at = NOW()
  WHERE lower(up.email) = v_email
    AND up.auth_user_id <> v_uid;

  IF NOT EXISTS (
    SELECT 1 FROM archive1863.user_profiles up WHERE up.auth_user_id = v_uid
  ) THEN
    INSERT INTO archive1863.user_profiles (auth_user_id, email, display_name, role, is_active)
    VALUES (v_uid, v_email, v_email, 'public', TRUE)
    ON CONFLICT (auth_user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
  END IF;

  RETURN QUERY
  SELECT up.auth_user_id, up.email, up.role, up.is_active
  FROM archive1863.user_profiles up
  WHERE up.auth_user_id = v_uid
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_user_profile() TO authenticated;
