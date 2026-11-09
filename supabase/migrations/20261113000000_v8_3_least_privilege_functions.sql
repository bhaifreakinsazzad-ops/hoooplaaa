-- ==============================================================================
-- V8.3 LEAST-PRIVILEGE FIX FOR V8.2 FUNCTIONS
-- Supabase's default privileges grant EXECUTE on every new public function to anon and authenticated.
-- The V8.2 trigger functions and the checklist helper are internal: clients must not be able to call them.
-- (PostgreSQL checks EXECUTE on a trigger function only when the trigger is created, so revoking it from
-- client roles does not stop the guards from firing for any writer.)
-- Additive and idempotent. Apply to the ISOLATED staging project first; never to production without owner approval.
-- ==============================================================================

REVOKE ALL ON FUNCTION public.guard_order_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_file() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_qa_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_deliverable() FROM PUBLIC, anon, authenticated;

-- Called at runtime by guard_qa_review() under the writer's role (service_role).
REVOKE ALL ON FUNCTION public.qa_required_checklist_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_required_checklist_items() TO service_role;

-- Re-assert (idempotent) the privileged delivery RPC grant.
REVOKE ALL ON FUNCTION public.deliver_order_with_qa_approval(TEXT, BIGINT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_order_with_qa_approval(TEXT, BIGINT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
    TO service_role;
