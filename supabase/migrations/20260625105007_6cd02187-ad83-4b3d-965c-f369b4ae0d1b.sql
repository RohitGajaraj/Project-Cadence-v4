CREATE OR REPLACE FUNCTION public.admin_set_interop_write_enabled(_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES ('interop_write_enabled', to_jsonb(_enabled), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value, updated_at = now(), updated_by = auth.uid();
  RETURN _enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_interop_write_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_interop_write_enabled(boolean) TO authenticated;