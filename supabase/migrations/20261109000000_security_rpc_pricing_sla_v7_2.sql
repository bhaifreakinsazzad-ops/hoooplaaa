-- ==============================================================================
-- HOOOPLAAA INCORPORATED — DIRECTIVE V7.2 INCREMENTAL SECURITY MIGRATION
-- Migration: 20261109000000_security_rpc_pricing_sla_v7_2.sql
-- Target Project: aqmyqezuoscpgqwtvblu (Supabase PostgreSQL 16)
-- Fixes:
--   1. Priority 0: Lock down SECURITY DEFINER RPC functions from public/client execution.
--   2. Priority 1: Revoke client-accessible table mutation grants on quotes, orders, payments, audit_logs.
--   3. Priority 2: Atomic transactional payment settlement with caller verification.
--   4. Priority 3: Single-use cryptographic capability token for guest quote claiming.
--   5. Priority 3: Dynamic service-specific business-day delivery SLA calculations.
-- ==============================================================================

-- 1. Add Single-Use Capability Claim Token Column to Quotes
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS claim_token_hash TEXT;

-- 2. Business Days Calculation Helper Function (Skipping Weekends)
CREATE OR REPLACE FUNCTION public.add_business_days(start_date TIMESTAMPTZ, num_days INT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    curr_date TIMESTAMPTZ := start_date;
    added INT := 0;
    dow INT;
BEGIN
    WHILE added < num_days LOOP
        curr_date := curr_date + INTERVAL '1 day';
        dow := EXTRACT(DOW FROM curr_date)::INT;
        IF dow NOT IN (0, 6) THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN curr_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Lock Down and Update RPC 1: settle_order_payment_paid
CREATE OR REPLACE FUNCTION public.settle_order_payment_paid(
    p_order_id TEXT,
    p_payment_attempt_code TEXT,
    p_staff_id TEXT DEFAULT NULL,
    p_provider_val_id TEXT DEFAULT NULL,
    p_evidence_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_uuid UUID;
    v_order RECORD;
    v_payment RECORD;
    v_staff_uuid UUID := NULL;
    v_intake RECORD;
    v_new_status public.order_status_enum;
    v_turnaround_days INT := 2;
    v_sla_started TIMESTAMPTZ := NULL;
    v_sla_deadline TIMESTAMPTZ := NULL;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_updated_order_json JSONB;
BEGIN
    -- Authorization check (service_role or finance/admin staff)
    IF COALESCE(current_setting('request.jwt.claim.role', true), 'anon') <> 'service_role' AND (public.get_auth_role() NOT IN ('finance', 'admin')) THEN
        RAISE EXCEPTION 'Permission denied: privileged function restricted to service_role or finance/admin staff';
    END IF;

    -- 1. Resolve order UUID
    IF p_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_order_uuid := p_order_id::uuid;
    ELSE
        SELECT id INTO v_order_uuid FROM public.orders WHERE order_code = p_order_id OR order_number = p_order_id;
    END IF;

    IF v_order_uuid IS NULL THEN
        RAISE EXCEPTION 'Order % not found for payment settlement', p_order_id;
    END IF;

    -- 2. Lock Order row FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_uuid FOR UPDATE;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order % not found under lock', p_order_id;
    END IF;

    -- 3. Resolve Staff UUID if provided
    IF p_staff_id IS NOT NULL AND p_staff_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_staff_uuid := p_staff_id::uuid;
    END IF;

    -- 4. Locate and lock matching payment record
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE (attempt_code = p_payment_attempt_code OR id::text = p_payment_attempt_code)
      AND order_id = v_order_uuid
    FOR UPDATE;

    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'Matching payment attempt % not found for order %', p_payment_attempt_code, p_order_id;
    END IF;

    -- 5. Amount & Currency Integrity Validation
    IF v_payment.amount_minor <> v_order.total_minor THEN
        RAISE EXCEPTION 'Payment amount mismatch: payment has % poisha, order requires % poisha', v_payment.amount_minor, v_order.total_minor;
    END IF;

    IF v_payment.currency <> v_order.currency THEN
        RAISE EXCEPTION 'Payment currency mismatch: payment has %, order requires %', v_payment.currency, v_order.currency;
    END IF;

    -- 6. Check if order is already settled
    IF v_order.financial_status = 'paid' THEN
        IF v_payment.payment_status = 'verified' OR v_payment.payment_status = 'paid' THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'order', v_order.payload_json,
                'payment', row_to_json(v_payment)::jsonb
            );
        ELSE
            RAISE EXCEPTION 'Order % has already been settled by another payment attempt', p_order_id;
        END IF;
    END IF;

    -- 7. Service-specific SLA calculation: Determine maximum turnaround business days from quote snapshot
    SELECT COALESCE(MAX(sc.turnaround_days), 2) INTO v_turnaround_days
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(v_order.quote_snapshot->'items') = 'array' THEN v_order.quote_snapshot->'items'
            WHEN jsonb_typeof(v_order.quote_snapshot) = 'array' THEN v_order.quote_snapshot
            ELSE '[]'::jsonb
        END
    ) AS elem
    JOIN public.service_catalog sc ON sc.sku = elem->>'sku';

    IF v_turnaround_days IS NULL OR v_turnaround_days < 1 THEN
        v_turnaround_days := 2;
    END IF;

    -- Check if intake was already completed before payment verification
    SELECT * INTO v_intake FROM public.order_intakes WHERE order_id = v_order_uuid;

    -- SLA starts only when payment is verified AND the order's intake is marked completed
    IF v_intake.id IS NOT NULL AND v_order.intake_status = 'completed' THEN
        v_new_status := 'ready_for_fulfillment'::public.order_status_enum;
        v_sla_started := v_now;
        v_sla_deadline := public.add_business_days(v_now, v_turnaround_days);
    ELSE
        v_new_status := 'awaiting_requirements'::public.order_status_enum;
        v_sla_started := NULL;
        v_sla_deadline := NULL;
    END IF;

    -- 8. Update Order
    v_updated_order_json := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_order.payload_json,
                '{status}',
                to_jsonb(v_new_status::text)
            ),
            '{financialStatus}',
            '"paid"'::jsonb
        ),
        '{paidAt}',
        to_jsonb(to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    IF v_sla_started IS NOT NULL THEN
        v_updated_order_json := jsonb_set(
            jsonb_set(
                v_updated_order_json,
                '{slaStartedAt}',
                to_jsonb(to_char(v_sla_started, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
            ),
            '{deliveryTargetDate}',
            to_jsonb(to_char(v_sla_deadline, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        );
    END IF;

    UPDATE public.orders
    SET order_status = v_new_status,
        financial_status = 'paid'::public.payment_status_enum,
        sla_started_at = v_sla_started,
        sla_deadline_at = v_sla_deadline,
        payload_json = v_updated_order_json,
        updated_at = v_now
    WHERE id = v_order_uuid;

    -- 9. Update Payment
    UPDATE public.payments
    SET payment_status = 'verified'::public.payment_status_enum,
        provider_val_id = COALESCE(p_provider_val_id, provider_val_id),
        verified_by_finance_id = v_staff_uuid,
        verified_at = v_now,
        gateway_raw_payload = gateway_raw_payload || COALESCE(p_evidence_payload, '{}'::jsonb)
    WHERE id = v_payment.id;

    -- 10. Record immutable payment event (replay protection)
    INSERT INTO public.payment_events (
        event_key, order_id, payment_id, provider, provider_val_id,
        status, amount_minor, currency, evidence_payload, created_at
    ) VALUES (
        'evt_settle_' || v_payment.attempt_code || '_' || extract(epoch from v_now)::text,
        v_order_uuid,
        v_payment.id,
        v_payment.payment_method::text,
        COALESCE(p_provider_val_id, v_payment.provider_val_id),
        'verified',
        v_payment.amount_minor,
        v_payment.currency,
        jsonb_build_object(
            'settledAt', v_now,
            'verifiedByStaffId', p_staff_id,
            'evidence', p_evidence_payload
        ),
        v_now
    )
    ON CONFLICT (event_key) DO NOTHING;

    -- 11. Append to Audit Logs
    INSERT INTO public.audit_logs (
        log_code, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at
    ) VALUES (
        'log_settle_' || v_order_uuid::text || '_' || extract(epoch from v_now)::text,
        v_staff_uuid,
        CASE WHEN v_staff_uuid IS NOT NULL THEN 'finance' ELSE 'customer' END,
        'PAYMENT_SETTLED_ORDER_PAID',
        'order',
        v_order_uuid::text,
        jsonb_build_object(
            'paymentAttemptCode', p_payment_attempt_code,
            'amountMinor', v_payment.amount_minor,
            'currency', v_payment.currency,
            'orderStatus', v_new_status::text,
            'financialStatus', 'paid',
            'verifiedByStaffId', p_staff_id
        ),
        v_now
    );

    SELECT * INTO v_payment FROM public.payments WHERE id = v_payment.id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'order', v_updated_order_json,
        'payment', row_to_json(v_payment)::jsonb
    );
END;
$$;

-- 4. Lock Down and Update RPC 2: convert_quote_to_active_order
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
AS $$
DECLARE
    v_quote_uuid UUID;
    v_quote RECORD;
    v_existing_order RECORD;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_created_order RECORD;
BEGIN
    -- Authorization check (service_role only)
    IF COALESCE(current_setting('request.jwt.claim.role', true), 'anon') <> 'service_role' AND (public.get_auth_role() NOT IN ('admin', 'finance')) THEN
        RAISE EXCEPTION 'Permission denied: privileged function restricted to service_role';
    END IF;

    -- 1. Resolve quote UUID
    IF p_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_quote_uuid := p_quote_id::uuid;
    ELSE
        SELECT id INTO v_quote_uuid FROM public.quotes WHERE quote_code = p_quote_id;
    END IF;

    IF v_quote_uuid IS NULL THEN
        RAISE EXCEPTION 'Quote % not found', p_quote_id;
    END IF;

    -- 2. Lock Quote row FOR UPDATE
    SELECT * INTO v_quote FROM public.quotes WHERE id = v_quote_uuid FOR UPDATE;
    IF v_quote.id IS NULL THEN
        RAISE EXCEPTION 'Quote % not found under lock', p_quote_id;
    END IF;

    -- 3. Expiration Check
    IF v_quote.expires_at < v_now THEN
        RAISE EXCEPTION 'Cannot convert quote: Quote has expired';
    END IF;

    -- 4. Guest Claiming (Single-use capability token check)
    IF v_quote.customer_id IS NULL THEN
        IF v_quote.claim_token_hash IS NOT NULL THEN
            IF p_claim_token IS NULL OR encode(sha256(p_claim_token::bytea), 'hex') <> v_quote.claim_token_hash THEN
                RAISE EXCEPTION 'Unauthorized: Valid claim token required to claim guest quote';
            END IF;
        END IF;

        UPDATE public.quotes 
        SET customer_id = p_customer_id, 
            organization_id = p_organization_id,
            claim_token_hash = NULL
        WHERE id = v_quote_uuid AND customer_id IS NULL;
    ELSIF v_quote.customer_id <> p_customer_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Quote belongs to another customer';
    END IF;

    -- 5. Check if active order already exists for this quote
    SELECT * INTO v_existing_order 
    FROM public.orders 
    WHERE quote_id = v_quote_uuid 
      AND order_status NOT IN ('cancelled', 'refunded')
    LIMIT 1;

    IF v_existing_order.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'existing', true,
            'order', v_existing_order.payload_json
        );
    END IF;

    -- 6. Insert new order with unique collision protection
    BEGIN
        INSERT INTO public.orders (
            id, order_code, order_number, organization_id, customer_id, quote_id,
            order_status, financial_status, intake_status, total_minor, currency,
            quote_snapshot, payload_json, created_at, updated_at
        ) VALUES (
            p_order_id,
            p_order_code,
            p_order_number,
            p_organization_id,
            p_customer_id,
            v_quote_uuid,
            'awaiting_payment'::public.order_status_enum,
            'unpaid'::public.payment_status_enum,
            'not_started',
            v_quote.total_minor,
            v_quote.currency,
            v_quote.selected_items,
            p_payload_json,
            v_now,
            v_now
        )
        RETURNING * INTO v_created_order;

        RETURN jsonb_build_object(
            'success', true,
            'existing', false,
            'order', v_created_order.payload_json
        );
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing_order 
        FROM public.orders 
        WHERE quote_id = v_quote_uuid 
          AND order_status NOT IN ('cancelled', 'refunded')
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'existing', true,
            'order', v_existing_order.payload_json
        );
    END;
END;
$$;

-- 5. Lock Down and Update RPC 3: claim_guest_quote
CREATE OR REPLACE FUNCTION public.claim_guest_quote(
    p_quote_id TEXT,
    p_customer_id UUID,
    p_organization_id UUID,
    p_claim_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_uuid UUID;
    v_quote RECORD;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_updated_quote_json JSONB;
BEGIN
    -- Authorization check (service_role only)
    IF COALESCE(current_setting('request.jwt.claim.role', true), 'anon') <> 'service_role' AND (public.get_auth_role() NOT IN ('finance', 'admin')) THEN
        RAISE EXCEPTION 'Permission denied: privileged function restricted to service_role';
    END IF;

    IF p_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_quote_uuid := p_quote_id::uuid;
    ELSE
        SELECT id INTO v_quote_uuid FROM public.quotes WHERE quote_code = p_quote_id;
    END IF;

    IF v_quote_uuid IS NULL THEN
        RAISE EXCEPTION 'Quote % not found', p_quote_id;
    END IF;

    SELECT * INTO v_quote FROM public.quotes WHERE id = v_quote_uuid FOR UPDATE;
    IF v_quote.id IS NULL THEN
        RAISE EXCEPTION 'Quote not found under lock';
    END IF;

    IF v_quote.expires_at < v_now THEN
        RAISE EXCEPTION 'Quote has expired';
    END IF;

    IF v_quote.customer_id IS NOT NULL AND v_quote.customer_id <> p_customer_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Quote already belongs to another customer';
    END IF;

    -- Validate single-use capability token
    IF v_quote.claim_token_hash IS NOT NULL THEN
        IF p_claim_token IS NULL OR encode(sha256(p_claim_token::bytea), 'hex') <> v_quote.claim_token_hash THEN
            RAISE EXCEPTION 'Unauthorized: Invalid or missing quote claim token';
        END IF;
    END IF;

    v_updated_quote_json := jsonb_set(
        jsonb_set(
            v_quote.payload_json,
            '{customerId}',
            to_jsonb(p_customer_id::text)
        ),
        '{organizationId}',
        to_jsonb(p_organization_id::text)
    );

    UPDATE public.quotes
    SET customer_id = p_customer_id,
        organization_id = p_organization_id,
        claim_token_hash = NULL,
        payload_json = v_updated_quote_json
    WHERE id = v_quote_uuid;

    RETURN jsonb_build_object(
        'success', true,
        'quote', v_updated_quote_json
    );
END;
$$;

-- 6. Explicit Function Revocation and Grants
REVOKE EXECUTE ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) TO service_role;

-- 7. Revoke Table Mutation Grants from Client Roles
REVOKE INSERT, UPDATE, DELETE ON public.quotes FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM PUBLIC, anon, authenticated;

-- Grant trusted mutation privileges exclusively to service_role
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

GRANT SELECT ON public.quotes TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.payment_events TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

-- 8. Replace Permissive RLS Policies with Service-Role Gated Policies
DROP POLICY IF EXISTS quotes_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_service_mutate ON public.quotes;
CREATE POLICY quotes_service_mutate ON public.quotes
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS orders_customer_insert ON public.orders;
DROP POLICY IF EXISTS orders_service_mutate ON public.orders;
CREATE POLICY orders_service_mutate ON public.orders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS payments_customer_insert ON public.payments;
DROP POLICY IF EXISTS payments_service_mutate ON public.payments;
CREATE POLICY payments_service_mutate ON public.payments
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_service_mutate ON public.audit_logs;
CREATE POLICY audit_service_mutate ON public.audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
