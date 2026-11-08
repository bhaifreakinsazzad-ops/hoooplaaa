-- ==============================================================================
-- HOOOPLAAA INCORPORATED — V7.2R SECURITY HARDENING (INCREMENTAL, IDEMPOTENT)
-- Migration: 20261110000000_v7_2r_security_hardening.sql
--
-- Safe on BOTH paths:
--   * fresh install  (runs after 20261108 canonical + 20261109 incremental)
--   * upgrade        (database already initialised by an earlier migration)
-- It only CREATE OR REPLACEs functions / policies and adds new objects. It never
-- drops customer data. The one column it removes (quotes.claim_token_hash) is
-- first migrated into the new quote_claims table.
--
-- Fixes:
--   1. Guest quote claim capability moved to a service_role-only table
--      (quote_claims) with expiry + single use. Plaintext tokens scrubbed from
--      quotes.payload_json. Guest quotes are no longer world-readable via RLS.
--   2. All SECURITY DEFINER functions pin search_path; authorization is by GRANT
--      (service_role only) — NOT by request.jwt.claim.* GUC values or by
--      user-controllable finance/admin claims.
--   3. RLS policies no longer reference request.jwt.claim.role; direct staff
--      UPDATE policies on orders/payments removed (server-authoritative writes).
--   4. Settlement is one atomic function that records the provider-validation
--      evidence, the replay-protection event, the payment and the order together.
--   5. Configurable Asia/Dhaka business calendar for SLA targets.
--   6. Partial unique indexes: one open attempt / one verified payment per order.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Baseline schema privileges (explicit, not reliant on platform defaults)
-- ------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1. Auth helper functions (read-only, caller's own role/org only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role_enum
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_org_id() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Guest quote claim capability table (server-only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_claims (
    quote_id UUID PRIMARY KEY REFERENCES public.quotes(id) ON DELETE CASCADE,
    token_hash TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    claimed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.quote_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quote_claims TO service_role;
DROP POLICY IF EXISTS quote_claims_service_only ON public.quote_claims;
CREATE POLICY quote_claims_service_only ON public.quote_claims
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Migrate any hash created by the earlier V7.2 column, scrub plaintext secrets, drop column.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'claim_token_hash'
    ) THEN
        INSERT INTO public.quote_claims (quote_id, token_hash, expires_at)
        SELECT id, claim_token_hash, LEAST(expires_at, timezone('utc', now()) + INTERVAL '30 minutes')
        FROM public.quotes
        WHERE claim_token_hash IS NOT NULL AND customer_id IS NULL
        ON CONFLICT (quote_id) DO NOTHING;
        ALTER TABLE public.quotes DROP COLUMN claim_token_hash;
    END IF;
END $$;

UPDATE public.quotes
SET payload_json = payload_json - 'claimToken' - 'claimTokenHash'
WHERE payload_json ? 'claimToken' OR payload_json ? 'claimTokenHash';

-- ------------------------------------------------------------------------------
-- 3. RLS policies — no JWT-claim GUC checks; no direct staff writes
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes
    FOR SELECT TO authenticated USING (
        (customer_id IS NOT NULL AND customer_id = auth.uid())
        OR (organization_id IS NOT NULL AND organization_id = public.get_auth_org_id())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

DROP POLICY IF EXISTS orders_customer_select ON public.orders;
CREATE POLICY orders_customer_select ON public.orders
    FOR SELECT TO authenticated USING (
        organization_id = public.get_auth_org_id()
        OR customer_id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

DROP POLICY IF EXISTS orders_staff_update ON public.orders;

DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
    FOR SELECT TO authenticated USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

DROP POLICY IF EXISTS payments_finance_update ON public.payments;

DROP POLICY IF EXISTS payment_events_staff_all ON public.payment_events;
DROP POLICY IF EXISTS payment_events_staff_select ON public.payment_events;
CREATE POLICY payment_events_staff_select ON public.payment_events
    FOR SELECT TO authenticated USING (public.get_auth_role() IN ('finance', 'admin'));
DROP POLICY IF EXISTS payment_events_service_mutate ON public.payment_events;
CREATE POLICY payment_events_service_mutate ON public.payment_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs
    FOR SELECT TO authenticated USING (public.get_auth_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS audit_requests_insert ON public.audit_requests;
CREATE POLICY audit_requests_insert ON public.audit_requests
    FOR INSERT TO anon, authenticated WITH CHECK (customer_id IS NULL OR customer_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 4. Table privileges: anon is read-catalog + submit-audit-request only;
--    authenticated cannot mutate server-authoritative tables.
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT ON public.service_catalog TO anon;
GRANT INSERT ON public.audit_requests TO anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.quotes, public.orders, public.payments,
    public.payment_events, public.audit_logs, public.quote_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.quote_claims FROM authenticated;
GRANT SELECT ON public.quotes, public.orders, public.payments, public.payment_events, public.audit_logs TO authenticated;
GRANT ALL ON public.quotes, public.orders, public.payments, public.payment_events, public.audit_logs,
    public.quote_claims TO service_role;

-- ------------------------------------------------------------------------------
-- 5. Payment integrity indexes
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_verified_per_order
    ON public.payments (order_id) WHERE payment_status = 'verified';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_open_attempt
    ON public.payments (order_id, payment_method) WHERE payment_status IN ('initiated', 'pending_verification');

-- ------------------------------------------------------------------------------
-- 5b. Platform flags (DB-enforced switches; only the database owner can change them)
--     allow_simulated_payments MUST stay false in staging/production. The local test
--     harness flips it on its disposable PGlite database only.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_flags (
    flag_key TEXT PRIMARY KEY,
    bool_value BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
INSERT INTO public.platform_flags (flag_key, bool_value) VALUES ('allow_simulated_payments', false)
ON CONFLICT (flag_key) DO NOTHING;
ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_flags FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.platform_flags TO service_role;
DROP POLICY IF EXISTS platform_flags_read ON public.platform_flags;
CREATE POLICY platform_flags_read ON public.platform_flags FOR SELECT TO service_role USING (true);

-- ------------------------------------------------------------------------------
-- 6. Business calendar (configurable; weekend/holiday policy is an OWNER decision)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_calendar_policy (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    weekend_days SMALLINT[] NOT NULL DEFAULT ARRAY[5, 6]::SMALLINT[],   -- 0=Sun .. 6=Sat
    opens_time TIME NOT NULL DEFAULT '09:00',
    cutoff_time TIME NOT NULL DEFAULT '17:00',
    policy_status TEXT NOT NULL DEFAULT 'PROVISIONAL_UNAPPROVED',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
INSERT INTO public.business_calendar_policy (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_holidays (
    holiday_date DATE PRIMARY KEY,
    label TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.business_calendar_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_calendar_policy, public.business_holidays FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_calendar_policy, public.business_holidays TO service_role;
DROP POLICY IF EXISTS business_calendar_service_only ON public.business_calendar_policy;
CREATE POLICY business_calendar_service_only ON public.business_calendar_policy
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS business_holidays_service_only ON public.business_holidays;
CREATE POLICY business_holidays_service_only ON public.business_holidays
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.is_business_day(p_day DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
    SELECT NOT (EXTRACT(DOW FROM p_day)::SMALLINT = ANY (p.weekend_days))
       AND NOT EXISTS (SELECT 1 FROM public.business_holidays h WHERE h.holiday_date = p_day)
    FROM public.business_calendar_policy p WHERE p.singleton;
$$;

-- Adds N business days (policy calendar, Asia/Dhaka by default), keeping time of day.
-- If the start instant is on a non-business day, or at/after the cutoff, the clock is
-- deemed to start at opening time of the next business day. Before opening on a
-- business day it starts at opening time.
CREATE OR REPLACE FUNCTION public.add_business_days(start_date TIMESTAMPTZ, num_days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    pol public.business_calendar_policy%ROWTYPE;
    v_local TIMESTAMP;
    v_day DATE;
    v_added INT := 0;
BEGIN
    SELECT * INTO pol FROM public.business_calendar_policy WHERE singleton;
    v_local := start_date AT TIME ZONE pol.timezone;
    v_day := v_local::DATE;

    IF NOT public.is_business_day(v_day) OR v_local::TIME >= pol.cutoff_time THEN
        LOOP
            v_day := v_day + 1;
            EXIT WHEN public.is_business_day(v_day);
        END LOOP;
        v_local := v_day + pol.opens_time;
    ELSIF v_local::TIME < pol.opens_time THEN
        v_local := v_day + pol.opens_time;
    END IF;

    WHILE v_added < GREATEST(num_days, 0) LOOP
        v_day := v_day + 1;
        IF public.is_business_day(v_day) THEN
            v_added := v_added + 1;
        END IF;
    END LOOP;

    RETURN (v_day + v_local::TIME) AT TIME ZONE pol.timezone;
END;
$$;

REVOKE ALL ON FUNCTION public.is_business_day(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_business_days(TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_day(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_business_days(TIMESTAMPTZ, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. claim_guest_quote — single-use, expiring, hash-compared capability
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_guest_quote(
    p_quote_id TEXT,
    p_customer_id UUID,
    p_organization_id UUID,
    p_claim_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_quote_uuid UUID;
    v_quote public.quotes%ROWTYPE;
    v_claim public.quote_claims%ROWTYPE;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_json JSONB;
BEGIN
    IF p_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_quote_uuid := p_quote_id::UUID;
    ELSE
        SELECT id INTO v_quote_uuid FROM public.quotes WHERE quote_code = p_quote_id;
    END IF;
    IF v_quote_uuid IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    SELECT * INTO v_quote FROM public.quotes WHERE id = v_quote_uuid FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;
    IF v_quote.expires_at < v_now THEN
        RAISE EXCEPTION 'Quote has expired';
    END IF;

    IF v_quote.customer_id IS NOT NULL THEN
        IF v_quote.customer_id = p_customer_id THEN
            RETURN jsonb_build_object('success', true, 'alreadyOwned', true, 'quote', v_quote.payload_json);
        END IF;
        RAISE EXCEPTION 'Cross-tenant violation: Quote already belongs to another customer';
    END IF;

    SELECT * INTO v_claim FROM public.quote_claims WHERE quote_id = v_quote_uuid FOR UPDATE;
    IF NOT FOUND OR v_claim.claimed_at IS NOT NULL OR v_claim.token_hash IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: guest quote claim is not available';
    END IF;
    IF v_claim.expires_at < v_now THEN
        RAISE EXCEPTION 'Unauthorized: guest quote claim has expired';
    END IF;
    IF p_claim_token IS NULL
       OR encode(sha256(convert_to(p_claim_token, 'UTF8')), 'hex') <> v_claim.token_hash THEN
        RAISE EXCEPTION 'Unauthorized: invalid guest quote claim';
    END IF;

    v_json := jsonb_set(
        jsonb_set(v_quote.payload_json - 'claimToken' - 'claimTokenHash',
                  '{customerId}', to_jsonb(p_customer_id::TEXT)),
        '{organizationId}', to_jsonb(p_organization_id::TEXT));

    UPDATE public.quotes
    SET customer_id = p_customer_id, organization_id = p_organization_id, payload_json = v_json
    WHERE id = v_quote_uuid;

    UPDATE public.quote_claims
    SET claimed_at = v_now, claimed_by = p_customer_id, token_hash = NULL
    WHERE quote_id = v_quote_uuid;

    RETURN jsonb_build_object('success', true, 'alreadyOwned', false, 'quote', v_json);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. convert_quote_to_active_order — claim (if guest) + one active order per quote
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_quote_to_active_order(
    p_order_id UUID,
    p_quote_id TEXT,
    p_customer_id UUID,
    p_organization_id UUID,
    p_order_code TEXT,
    p_order_number TEXT,
    p_payload_json JSONB,
    p_claim_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_quote_uuid UUID;
    v_quote public.quotes%ROWTYPE;
    v_existing public.orders%ROWTYPE;
    v_created public.orders%ROWTYPE;
    v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
    IF p_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_quote_uuid := p_quote_id::UUID;
    ELSE
        SELECT id INTO v_quote_uuid FROM public.quotes WHERE quote_code = p_quote_id;
    END IF;
    IF v_quote_uuid IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    SELECT * INTO v_quote FROM public.quotes WHERE id = v_quote_uuid FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;
    IF v_quote.expires_at < v_now THEN
        RAISE EXCEPTION 'Cannot convert quote: Quote has expired';
    END IF;

    IF v_quote.customer_id IS NULL THEN
        PERFORM public.claim_guest_quote(v_quote_uuid::TEXT, p_customer_id, p_organization_id, p_claim_token);
    ELSIF v_quote.customer_id <> p_customer_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Quote belongs to another customer';
    END IF;

    SELECT * INTO v_existing FROM public.orders
    WHERE quote_id = v_quote_uuid AND order_status NOT IN ('cancelled', 'refunded') LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'existing', true, 'order', v_existing.payload_json);
    END IF;

    BEGIN
        INSERT INTO public.orders (
            id, order_code, order_number, organization_id, customer_id, quote_id,
            order_status, financial_status, intake_status, total_minor, currency,
            quote_snapshot, payload_json, created_at, updated_at
        ) VALUES (
            p_order_id, p_order_code, p_order_number, p_organization_id, p_customer_id, v_quote_uuid,
            'awaiting_payment', 'unpaid', 'not_started', v_quote.total_minor, v_quote.currency,
            v_quote.selected_items, p_payload_json, v_now, v_now
        ) RETURNING * INTO v_created;
        RETURN jsonb_build_object('success', true, 'existing', false, 'order', v_created.payload_json);
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing FROM public.orders
        WHERE quote_id = v_quote_uuid AND order_status NOT IN ('cancelled', 'refunded') LIMIT 1;
        IF NOT FOUND THEN
            RAISE;
        END IF;
        RETURN jsonb_build_object('success', true, 'existing', true, 'order', v_existing.payload_json);
    END;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. settle_order_payment_paid — ONE atomic financial truth
--    Settlement sources:
--      sslcommerz_s2s_validated : caller (trusted Next.js server) has already completed the
--                                 SSLCOMMERZ server-to-server Order Validation API; the normalized
--                                 evidence is verified again here (status, tran_id, amount, currency).
--      finance_manual           : a finance/admin user (verified against user_profiles, never against
--                                 JWT claims) approves a PENDING manual_mfs attempt that carries a
--                                 customer-submitted transaction reference.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.settle_order_payment_paid(
    p_order_id TEXT,
    p_payment_attempt_code TEXT,
    p_settlement_source TEXT,
    p_staff_id TEXT DEFAULT NULL,
    p_provider_val_id TEXT DEFAULT NULL,
    p_evidence_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_uuid UUID;
    v_order public.orders%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_staff_uuid UUID := NULL;
    v_staff_role public.user_role_enum;
    v_has_intake BOOLEAN;
    v_new_status public.order_status_enum;
    v_turnaround INT;
    v_sla_started TIMESTAMPTZ := NULL;
    v_sla_deadline TIMESTAMPTZ := NULL;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_json JSONB;
    v_event_key TEXT;
    v_inserted INT;
    v_uuid_re CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
    IF p_settlement_source IS NULL OR p_settlement_source NOT IN ('sslcommerz_s2s_validated', 'local_simulator', 'finance_manual') THEN
        RAISE EXCEPTION 'Invalid settlement source';
    END IF;

    IF p_order_id ~* v_uuid_re THEN
        v_order_uuid := p_order_id::UUID;
    ELSE
        SELECT id INTO v_order_uuid FROM public.orders WHERE order_code = p_order_id OR order_number = p_order_id;
    END IF;
    IF v_order_uuid IS NULL THEN
        RAISE EXCEPTION 'Order % not found for payment settlement', p_order_id;
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_order_uuid FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found under lock', p_order_id;
    END IF;

    SELECT * INTO v_payment FROM public.payments
    WHERE order_id = v_order_uuid AND (attempt_code = p_payment_attempt_code OR id::TEXT = p_payment_attempt_code)
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Matching payment attempt % not found for order %', p_payment_attempt_code, p_order_id;
    END IF;

    -- Amount / currency integrity against the authoritative order
    IF v_payment.amount_minor <> v_order.total_minor THEN
        RAISE EXCEPTION 'Payment amount mismatch: payment % vs order % poisha', v_payment.amount_minor, v_order.total_minor;
    END IF;
    IF v_payment.currency <> v_order.currency THEN
        RAISE EXCEPTION 'Payment currency mismatch: payment %, order %', v_payment.currency, v_order.currency;
    END IF;

    -- Idempotent replay of an already-settled payment
    IF v_payment.payment_status = 'verified' AND v_order.financial_status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true,
            'order', v_order.payload_json, 'payment', to_jsonb(v_payment));
    END IF;
    IF v_order.financial_status = 'paid' THEN
        RAISE EXCEPTION 'Order % has already been settled by another payment attempt', p_order_id;
    END IF;
    IF v_payment.payment_status NOT IN ('initiated', 'pending_verification') THEN
        RAISE EXCEPTION 'Payment attempt is in state % and cannot be settled', v_payment.payment_status;
    END IF;

    -- Source-specific evidence rules
    IF p_settlement_source IN ('sslcommerz_s2s_validated', 'local_simulator') THEN
        IF v_payment.payment_method::TEXT NOT IN ('sslcommerz', 'sslcommerz_sandbox', 'sslcommerz_live') THEN
            RAISE EXCEPTION 'Gateway settlement requires an SSLCOMMERZ payment attempt';
        END IF;
        IF p_provider_val_id IS NULL OR length(p_provider_val_id) = 0 THEN
            RAISE EXCEPTION 'Gateway settlement requires a provider validation id';
        END IF;
        IF p_settlement_source = 'local_simulator' THEN
            IF NOT COALESCE((SELECT bool_value FROM public.platform_flags WHERE flag_key = 'allow_simulated_payments'), false) THEN
                RAISE EXCEPTION 'Simulated payment settlement is disabled on this database';
            END IF;
        ELSIF COALESCE(p_evidence_payload->>'providerValidated', 'false') <> 'true' THEN
            RAISE EXCEPTION 'Gateway settlement requires provider server-to-server validation evidence';
        END IF;
        IF COALESCE(p_evidence_payload->>'status', '') NOT IN ('VALID', 'VALIDATED')
           OR (p_evidence_payload->>'tranId') IS DISTINCT FROM v_payment.attempt_code
           OR (p_evidence_payload->>'valId') IS DISTINCT FROM p_provider_val_id
           OR (p_evidence_payload->>'amountMinor') IS DISTINCT FROM v_order.total_minor::TEXT
           OR (p_evidence_payload->>'currency') IS DISTINCT FROM v_order.currency THEN
            RAISE EXCEPTION 'Provider validation evidence does not match payment attempt, amount or currency';
        END IF;
        v_event_key := 'settle:sslcommerz:' || p_provider_val_id;
    ELSE
        IF p_staff_id IS NULL OR p_staff_id !~* v_uuid_re THEN
            RAISE EXCEPTION 'Manual settlement requires a finance/admin staff id';
        END IF;
        v_staff_uuid := p_staff_id::UUID;
        SELECT role INTO v_staff_role FROM public.user_profiles WHERE id = v_staff_uuid;
        IF v_staff_role IS NULL OR v_staff_role NOT IN ('finance', 'admin') THEN
            RAISE EXCEPTION 'Manual settlement staff member is not authorised';
        END IF;
        IF v_payment.payment_method::TEXT <> 'manual_mfs'
           OR v_payment.payment_status <> 'pending_verification'
           OR v_payment.manual_trx_reference IS NULL
           OR length(trim(v_payment.manual_trx_reference)) = 0 THEN
            RAISE EXCEPTION 'Manual approval requires a pending manual_mfs attempt with a submitted transaction reference';
        END IF;
        v_event_key := 'settle:manual:' || v_payment.attempt_code;
    END IF;

    -- Replay protection event (same transaction as the settlement)
    INSERT INTO public.payment_events (
        event_key, order_id, payment_id, provider, provider_val_id, status,
        amount_minor, currency, evidence_payload, created_at
    ) VALUES (
        v_event_key, v_order_uuid, v_payment.id, v_payment.payment_method::TEXT,
        CASE WHEN p_settlement_source IN ('sslcommerz_s2s_validated', 'local_simulator') THEN p_provider_val_id ELSE NULL END,
        'verified', v_payment.amount_minor, v_payment.currency,
        jsonb_build_object('source', p_settlement_source, 'staffId', p_staff_id, 'evidence', p_evidence_payload),
        v_now
    ) ON CONFLICT (event_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
        RAISE EXCEPTION 'Replay detected: this payment event was already processed';
    END IF;

    -- Service-specific SLA: longest per-SKU business-day target in the purchased bundle
    SELECT COALESCE(MAX(sc.turnaround_days), 2) INTO v_turnaround
    FROM jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(v_order.quote_snapshot) = 'array' THEN v_order.quote_snapshot
            WHEN jsonb_typeof(v_order.quote_snapshot->'items') = 'array' THEN v_order.quote_snapshot->'items'
            ELSE '[]'::jsonb
        END
    ) AS elem
    JOIN public.service_catalog sc ON sc.sku = elem->>'sku';
    IF v_turnaround IS NULL OR v_turnaround < 1 THEN
        v_turnaround := 2;
    END IF;

    -- SLA starts only when payment is verified AND required intake is complete
    SELECT EXISTS (SELECT 1 FROM public.order_intakes WHERE order_id = v_order_uuid) INTO v_has_intake;
    IF v_has_intake AND v_order.intake_status = 'completed' THEN
        v_new_status := 'ready_for_fulfillment';
        v_sla_started := v_now;
        v_sla_deadline := public.add_business_days(v_now, v_turnaround);
    ELSE
        v_new_status := 'awaiting_requirements';
    END IF;

    v_json := jsonb_set(jsonb_set(jsonb_set(v_order.payload_json,
        '{status}', to_jsonb(v_new_status::TEXT)),
        '{financialStatus}', '"paid"'::jsonb),
        '{paidAt}', to_jsonb(to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    IF v_sla_started IS NOT NULL THEN
        v_json := jsonb_set(jsonb_set(jsonb_set(v_json,
            '{slaStartedAt}', to_jsonb(to_char(v_sla_started, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
            '{deliveryTargetDate}', to_jsonb(to_char(v_sla_deadline, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
            '{turnaroundBusinessDays}', to_jsonb(v_turnaround));
    END IF;

    UPDATE public.orders
    SET order_status = v_new_status, financial_status = 'paid',
        sla_started_at = v_sla_started, sla_deadline_at = v_sla_deadline,
        payload_json = v_json, updated_at = v_now
    WHERE id = v_order_uuid;

    UPDATE public.payments
    SET payment_status = 'verified',
        provider_val_id = COALESCE(p_provider_val_id, provider_val_id),
        verified_by_finance_id = v_staff_uuid,
        verified_at = v_now,
        gateway_raw_payload = gateway_raw_payload || jsonb_build_object('settlement', jsonb_build_object(
            'source', p_settlement_source, 'settledAt', v_now, 'evidence', p_evidence_payload))
    WHERE id = v_payment.id;

    INSERT INTO public.audit_logs (log_code, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at)
    VALUES (
        'log_settle_' || v_order_uuid::TEXT || '_' || gen_random_uuid()::TEXT,
        v_staff_uuid,
        CASE WHEN v_staff_uuid IS NOT NULL THEN v_staff_role::TEXT ELSE 'system' END,
        'PAYMENT_SETTLED_ORDER_PAID', 'order', v_order_uuid::TEXT,
        jsonb_build_object('paymentAttemptCode', v_payment.attempt_code, 'source', p_settlement_source,
            'amountMinor', v_payment.amount_minor, 'currency', v_payment.currency,
            'orderStatus', v_new_status::TEXT, 'verifiedByStaffId', p_staff_id),
        v_now
    );

    SELECT * INTO v_payment FROM public.payments WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', true, 'idempotent', false, 'order', v_json, 'payment', to_jsonb(v_payment));
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. EXECUTE grants: privileged functions are service_role ONLY.
--     Finance/admin permissions are verified in the Next.js API before the
--     trusted backend invokes these; they are never an RPC-level bypass.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) TO service_role;
