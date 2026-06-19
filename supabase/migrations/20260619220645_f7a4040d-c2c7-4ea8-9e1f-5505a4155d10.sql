-- ai_response_cache is a server-side cache; deny client access explicitly
REVOKE ALL ON public.ai_response_cache FROM authenticated, anon;
CREATE POLICY "deny client access" ON public.ai_response_cache FOR ALL TO authenticated USING (false) WITH CHECK (false);
