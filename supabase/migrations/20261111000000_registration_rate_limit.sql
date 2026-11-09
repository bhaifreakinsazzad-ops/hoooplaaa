-- Shared, serverless-safe fixed-window rate limiter for self-service registration.
-- Keys are caller-supplied SHA-256 hashes (client IP / email), never raw identifiers.
-- Service-role only: clients (anon/authenticated) can neither read nor call it.
-- Idempotent and additive; touches no existing table. Apply to the ISOLATED staging project only until reviewed.

CREATE TABLE IF NOT EXISTS public.registration_rate_limits (
  key_hash     text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hit_count    integer NOT NULL DEFAULT 1
);

-- RLS on with no policies = deny-all for clients. FORCE is deliberately not used so the SECURITY DEFINER function
-- (owned by the migration role) can still write; clients hold no table privileges at all.
ALTER TABLE public.registration_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_rate_limits FROM PUBLIC, anon, authenticated;

-- Returns 0 when the call is allowed, otherwise the number of seconds until the window resets.
CREATE OR REPLACE FUNCTION public.hit_registration_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_max integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window interval;
  v_start timestamptz;
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) < 16 OR length(p_key_hash) > 128 THEN
    RAISE EXCEPTION 'invalid rate limit key' USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400
     OR p_max IS NULL OR p_max < 1 OR p_max > 10000 THEN
    RAISE EXCEPTION 'invalid rate limit parameters' USING ERRCODE = '22023';
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  -- Opportunistic cleanup of long-expired buckets (bounded).
  DELETE FROM public.registration_rate_limits
   WHERE key_hash IN (
     SELECT key_hash FROM public.registration_rate_limits
      WHERE window_start < now() - interval '1 day' LIMIT 50
   );

  -- Atomic upsert: a single statement increments, or restarts the window when it has expired.
  INSERT INTO public.registration_rate_limits AS t (key_hash, window_start, hit_count)
  VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE
    SET window_start = CASE WHEN t.window_start <= now() - v_window THEN now() ELSE t.window_start END,
        hit_count    = CASE WHEN t.window_start <= now() - v_window THEN 1 ELSE t.hit_count + 1 END
  RETURNING t.window_start, t.hit_count INTO v_start, v_count;

  IF v_count > p_max THEN
    RETURN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_start + v_window - now())))::integer);
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_registration_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_registration_rate_limit(text, integer, integer) TO service_role;
