-- ==============================================================================
-- V8.2 RELEASE INTEGRITY
--   1. orders.row_version + BEFORE UPDATE guard: compare-and-swap concurrency, legal transitions only,
--      no regression of payment / intake / SLA / delivery / acceptance state, paid only with settlement evidence.
--   2. order_files.file_category (column, not just JSON) + ownership/path/immutability guard.
--   3. order_qa_reviews: persisted, immutable QA evidence bound to one deliverable file and its SHA-256.
--   4. order_deliverables bound to a verified file + approved QA review (DB-enforced).
--   5. deliver_order_with_qa_approval(): one atomic, version-checked delivery transaction.
-- Additive and idempotent. Apply to the ISOLATED staging project first; never to production without owner approval.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ORDER ROW VERSION + TRANSITION GUARD
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old TEXT := OLD.order_status::TEXT;
    v_new TEXT := NEW.order_status::TEXT;
    v_allowed TEXT[];
    v_last_revision TIMESTAMPTZ;
BEGIN
    -- Every successful write bumps the version, including writes made by SQL functions (settlement),
    -- so any application writer holding an older version is detected as stale.
    NEW.row_version := OLD.row_version + 1;

    -- Identity and price are immutable once the order exists (authoritative integer-poisha pricing).
    IF NEW.order_code IS DISTINCT FROM OLD.order_code
       OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
        RAISE EXCEPTION 'ORDER_IMMUTABLE_FIELD: order identity, quote and total cannot change' USING ERRCODE = '23514';
    END IF;

    -- Payment can never regress once paid (refund/dispute flows are the only exits).
    IF OLD.financial_status = 'paid'
       AND NEW.financial_status NOT IN ('paid', 'refund_pending', 'refunded', 'disputed') THEN
        RAISE EXCEPTION 'ORDER_STATE_REGRESSION: financial status cannot leave paid (% -> %)',
            OLD.financial_status, NEW.financial_status USING ERRCODE = '23514';
    END IF;

    -- Becoming paid requires a verified settlement event recorded in the same transaction or earlier.
    IF NEW.financial_status = 'paid' AND OLD.financial_status <> 'paid' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.payment_events e WHERE e.order_id = NEW.id AND e.status = 'verified'
        ) THEN
            RAISE EXCEPTION 'ORDER_PAYMENT_EVIDENCE_REQUIRED: an order becomes paid only through settlement'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Intake completion, SLA start and acceptance are one-way facts.
    IF OLD.intake_status = 'completed' AND NEW.intake_status <> 'completed' THEN
        RAISE EXCEPTION 'ORDER_STATE_REGRESSION: intake cannot revert from completed' USING ERRCODE = '23514';
    END IF;
    IF OLD.sla_started_at IS NOT NULL AND NEW.sla_started_at IS DISTINCT FROM OLD.sla_started_at THEN
        RAISE EXCEPTION 'ORDER_STATE_REGRESSION: SLA start is immutable once set' USING ERRCODE = '23514';
    END IF;
    IF OLD.sla_started_at IS NULL AND NEW.sla_started_at IS NOT NULL
       AND NOT (NEW.financial_status = 'paid' AND NEW.intake_status = 'completed') THEN
        RAISE EXCEPTION 'ORDER_SLA_PRECONDITION: SLA starts only when paid AND intake complete' USING ERRCODE = '23514';
    END IF;
    IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
        RAISE EXCEPTION 'ORDER_STATE_REGRESSION: acceptance is immutable once recorded' USING ERRCODE = '23514';
    END IF;

    IF v_new <> v_old THEN
        v_allowed := CASE v_old
            WHEN 'awaiting_payment' THEN ARRAY['payment_under_review', 'awaiting_requirements', 'ready_for_fulfillment', 'cancelled']
            WHEN 'payment_under_review' THEN ARRAY['awaiting_payment', 'awaiting_requirements', 'ready_for_fulfillment', 'cancelled']
            WHEN 'awaiting_requirements' THEN ARRAY['ready_for_fulfillment', 'cancelled']
            WHEN 'ready_for_fulfillment' THEN ARRAY['in_progress', 'cancelled']
            WHEN 'in_progress' THEN ARRAY['qa_review', 'cancelled']
            WHEN 'qa_review' THEN ARRAY['delivered', 'in_progress', 'cancelled']
            WHEN 'delivered' THEN ARRAY['in_progress', 'accepted']
            WHEN 'accepted' THEN ARRAY['completed', 'closed']
            WHEN 'completed' THEN ARRAY['closed']
            WHEN 'closed' THEN ARRAY[]::TEXT[]
            WHEN 'cancelled' THEN ARRAY['refunded']
            WHEN 'refunded' THEN ARRAY[]::TEXT[]
            ELSE NULL -- legacy pre-v7 statuses: governed by the invariants below only
        END;
        IF v_allowed IS NOT NULL AND NOT (v_new = ANY (v_allowed)) THEN
            RAISE EXCEPTION 'ORDER_ILLEGAL_TRANSITION: % -> %', v_old, v_new USING ERRCODE = '23514';
        END IF;

        IF v_new IN ('ready_for_fulfillment', 'in_progress', 'qa_review', 'delivered', 'accepted', 'completed')
           AND NEW.financial_status <> 'paid' THEN
            RAISE EXCEPTION 'ORDER_UNPAID: % requires a paid order', v_new USING ERRCODE = '23514';
        END IF;
        IF v_new IN ('ready_for_fulfillment', 'in_progress', 'qa_review', 'delivered', 'accepted')
           AND NEW.intake_status <> 'completed' THEN
            RAISE EXCEPTION 'ORDER_INTAKE_INCOMPLETE: % requires completed intake', v_new USING ERRCODE = '23514';
        END IF;

        IF v_new = 'delivered' THEN
            SELECT max(r.created_at) INTO v_last_revision FROM public.order_revisions r WHERE r.order_id = NEW.id;
            IF NOT EXISTS (
                SELECT 1
                FROM public.order_deliverables d
                JOIN public.order_qa_reviews q ON q.id = d.qa_review_id
                WHERE d.order_id = NEW.id
                  AND q.decision = 'approved'
                  AND q.created_at > COALESCE(v_last_revision, '-infinity'::TIMESTAMPTZ)
            ) THEN
                RAISE EXCEPTION 'ORDER_QA_APPROVAL_REQUIRED: delivery requires a persisted, approved QA review of a verified deliverable'
                    USING ERRCODE = '23514';
            END IF;
            IF NEW.delivered_at IS NULL THEN
                RAISE EXCEPTION 'ORDER_DELIVERY_TIMESTAMP_REQUIRED' USING ERRCODE = '23514';
            END IF;
        END IF;

        IF v_new = 'accepted' AND NEW.accepted_at IS NULL THEN
            RAISE EXCEPTION 'ORDER_ACCEPTANCE_TIMESTAMP_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_transition ON public.orders;
CREATE TRIGGER trg_guard_order_transition
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.guard_order_transition();

-- ------------------------------------------------------------------------------
-- 2. ORDER FILES: CATEGORY COLUMN, OWNERSHIP, PATH AND IMMUTABILITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_files ADD COLUMN IF NOT EXISTS file_category TEXT;
UPDATE public.order_files
   SET file_category = CASE WHEN payload_json->>'category' = 'deliverable' THEN 'deliverable' ELSE 'client_asset' END
 WHERE file_category IS NULL;
ALTER TABLE public.order_files ALTER COLUMN file_category SET DEFAULT 'client_asset';
ALTER TABLE public.order_files ALTER COLUMN file_category SET NOT NULL;
ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_category_chk;
ALTER TABLE public.order_files
    ADD CONSTRAINT order_files_category_chk CHECK (file_category IN ('client_asset', 'deliverable'));
ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_sha256_format_chk;
ALTER TABLE public.order_files
    ADD CONSTRAINT order_files_sha256_format_chk CHECK (sha256_hash ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_size_chk;
ALTER TABLE public.order_files
    ADD CONSTRAINT order_files_size_chk CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_order_file()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_code TEXT;
    v_role public.user_role_enum;
    v_prefix TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.order_id IS DISTINCT FROM OLD.order_id
           OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
           OR NEW.sha256_hash IS DISTINCT FROM OLD.sha256_hash
           OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
           OR NEW.file_category IS DISTINCT FROM OLD.file_category
           OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
            RAISE EXCEPTION 'ORDER_FILE_IMMUTABLE: file binding, bytes digest and category cannot change' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.file_category IS NULL OR NEW.file_category NOT IN ('client_asset', 'deliverable') THEN
        RAISE EXCEPTION 'ORDER_FILE_CATEGORY_INVALID: %', NEW.file_category USING ERRCODE = '23514';
    END IF;

    SELECT order_code INTO v_order_code FROM public.orders WHERE id = NEW.order_id;
    IF v_order_code IS NULL THEN
        RAISE EXCEPTION 'ORDER_FILE_ORDER_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    v_prefix := 'orders/' || v_order_code || '/' ||
        CASE NEW.file_category WHEN 'deliverable' THEN 'deliverables/' ELSE 'client_assets/' END;
    IF left(NEW.storage_path, length(v_prefix)) <> v_prefix
       OR position('..' IN NEW.storage_path) > 0
       OR NEW.storage_path ~ '[[:cntrl:]]'
       OR strpos(NEW.storage_path, chr(92)) > 0 THEN
        RAISE EXCEPTION 'ORDER_FILE_PATH_INVALID: storage path must be under %', v_prefix USING ERRCODE = '23514';
    END IF;
    IF NEW.storage_bucket <> 'order-assets' OR NEW.is_private IS NOT TRUE THEN
        RAISE EXCEPTION 'ORDER_FILE_BUCKET_INVALID: files must live in the private order-assets bucket' USING ERRCODE = '23514';
    END IF;

    IF NEW.file_category = 'deliverable' THEN
        SELECT role INTO v_role FROM public.user_profiles WHERE id = NEW.uploaded_by;
        IF v_role IS NULL OR v_role NOT IN ('admin', 'engineer') THEN
            RAISE EXCEPTION 'ORDER_FILE_DELIVERABLE_UPLOADER: deliverables may only be uploaded by admin/engineer staff'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_file ON public.order_files;
CREATE TRIGGER trg_guard_order_file
    BEFORE INSERT OR UPDATE ON public.order_files
    FOR EACH ROW EXECUTE FUNCTION public.guard_order_file();

-- ------------------------------------------------------------------------------
-- 3. PERSISTED QA REVIEWS (IMMUTABLE EVIDENCE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_qa_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_code TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    deliverable_file_id UUID NOT NULL REFERENCES public.order_files(id) ON DELETE RESTRICT,
    file_sha256 TEXT NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
    reviewer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    reviewer_role public.user_role_enum NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    checklist JSONB NOT NULL CHECK (jsonb_typeof(checklist) = 'object'),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS order_qa_reviews_order_idx ON public.order_qa_reviews (order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.qa_required_checklist_items()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT ARRAY[
        'scope_matches_purchased_items',
        'delegated_access_via_official_partner_flow',
        'no_customer_credentials_collected',
        'deliverable_file_opened_and_verified',
        'customer_facing_notes_accurate'
    ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.guard_qa_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_file public.order_files%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_role public.user_role_enum;
    v_item TEXT;
BEGIN
    SELECT * INTO v_file FROM public.order_files WHERE id = NEW.deliverable_file_id;
    IF v_file.id IS NULL OR v_file.order_id <> NEW.order_id THEN
        RAISE EXCEPTION 'QA_FILE_NOT_OWNED_BY_ORDER' USING ERRCODE = '23514';
    END IF;
    IF v_file.file_category <> 'deliverable' THEN
        RAISE EXCEPTION 'QA_FILE_NOT_A_DELIVERABLE: customer intake assets cannot be QA-approved as deliverables' USING ERRCODE = '23514';
    END IF;
    IF v_file.sha256_hash <> NEW.file_sha256 THEN
        RAISE EXCEPTION 'QA_FILE_DIGEST_MISMATCH' USING ERRCODE = '23514';
    END IF;

    SELECT role INTO v_role FROM public.user_profiles WHERE id = NEW.reviewer_id;
    IF v_role IS NULL OR v_role NOT IN ('admin', 'engineer') OR v_role <> NEW.reviewer_role THEN
        RAISE EXCEPTION 'QA_REVIEWER_NOT_AUTHORISED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
    IF v_order.order_status <> 'qa_review' OR v_order.financial_status <> 'paid' OR v_order.intake_status <> 'completed' THEN
        RAISE EXCEPTION 'QA_ORDER_NOT_IN_REVIEW: order must be paid, intake complete and in qa_review' USING ERRCODE = '23514';
    END IF;

    IF NEW.decision = 'approved' THEN
        FOREACH v_item IN ARRAY public.qa_required_checklist_items() LOOP
            IF NOT COALESCE((NEW.checklist ->> v_item) = 'true', false) THEN
                RAISE EXCEPTION 'QA_CHECKLIST_INCOMPLETE: % must be confirmed', v_item USING ERRCODE = '23514';
            END IF;
        END LOOP;
    END IF;

    NEW.created_at := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_qa_review ON public.order_qa_reviews;
CREATE TRIGGER trg_guard_qa_review
    BEFORE INSERT ON public.order_qa_reviews
    FOR EACH ROW EXECUTE FUNCTION public.guard_qa_review();

ALTER TABLE public.order_qa_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_qa_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.order_qa_reviews TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.order_qa_reviews FROM service_role;

-- ------------------------------------------------------------------------------
-- 4. DELIVERABLES BOUND TO A VERIFIED FILE + APPROVED QA REVIEW
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_deliverables
    ADD COLUMN IF NOT EXISTS deliverable_file_id UUID REFERENCES public.order_files(id) ON DELETE RESTRICT;
ALTER TABLE public.order_deliverables
    ADD COLUMN IF NOT EXISTS qa_review_id UUID REFERENCES public.order_qa_reviews(id) ON DELETE RESTRICT;
ALTER TABLE public.order_deliverables ADD COLUMN IF NOT EXISTS file_sha256 TEXT;

CREATE OR REPLACE FUNCTION public.guard_order_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_file public.order_files%ROWTYPE;
    v_review public.order_qa_reviews%ROWTYPE;
BEGIN
    IF NEW.deliverable_file_id IS NULL OR NEW.qa_review_id IS NULL THEN
        RAISE EXCEPTION 'DELIVERABLE_UNBOUND: a deliverable must reference a verified file and an approved QA review'
            USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_file FROM public.order_files WHERE id = NEW.deliverable_file_id;
    SELECT * INTO v_review FROM public.order_qa_reviews WHERE id = NEW.qa_review_id;
    IF v_file.id IS NULL OR v_file.order_id <> NEW.order_id OR v_file.file_category <> 'deliverable' THEN
        RAISE EXCEPTION 'DELIVERABLE_FILE_NOT_OWNED_BY_ORDER' USING ERRCODE = '23514';
    END IF;
    IF v_review.id IS NULL OR v_review.decision <> 'approved'
       OR v_review.order_id <> NEW.order_id OR v_review.deliverable_file_id <> NEW.deliverable_file_id THEN
        RAISE EXCEPTION 'DELIVERABLE_QA_NOT_APPROVED' USING ERRCODE = '23514';
    END IF;
    IF v_review.file_sha256 <> v_file.sha256_hash THEN
        RAISE EXCEPTION 'DELIVERABLE_DIGEST_MISMATCH' USING ERRCODE = '23514';
    END IF;
    NEW.file_sha256 := v_file.sha256_hash;
    NEW.storage_bucket_path := v_file.storage_path;
    NEW.qa_checklist_passed := true;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_deliverable ON public.order_deliverables;
CREATE TRIGGER trg_guard_order_deliverable
    BEFORE INSERT ON public.order_deliverables
    FOR EACH ROW EXECUTE FUNCTION public.guard_order_deliverable();

REVOKE UPDATE, DELETE, TRUNCATE ON public.order_deliverables FROM service_role;

-- ------------------------------------------------------------------------------
-- 5. ATOMIC, VERSION-CHECKED DELIVERY
--    Authorisation (admin/engineer) is decided in the Next.js API; this function re-checks staff role on the
--    actor id supplied by the trusted backend and is EXECUTE-granted to service_role only.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deliver_order_with_qa_approval(
    p_order_code TEXT,
    p_expected_version BIGINT,
    p_file_code TEXT,
    p_qa_review_code TEXT,
    p_actor_id UUID,
    p_title TEXT,
    p_verification_notes TEXT,
    p_order_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_file public.order_files%ROWTYPE;
    v_review public.order_qa_reviews%ROWTYPE;
    v_latest_review_id UUID;
    v_role public.user_role_enum;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_now_txt TEXT := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_deliv_code TEXT := 'deliv_' || replace(gen_random_uuid()::TEXT, '-', '');
    v_payload JSONB;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE order_code = p_order_code FOR UPDATE;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_order.row_version <> p_expected_version THEN
        RAISE EXCEPTION 'ORDER_VERSION_CONFLICT: expected %, found %', p_expected_version, v_order.row_version
            USING ERRCODE = '40001';
    END IF;
    IF v_order.order_status <> 'qa_review' THEN
        RAISE EXCEPTION 'ORDER_ILLEGAL_TRANSITION: % -> delivered', v_order.order_status USING ERRCODE = '23514';
    END IF;

    SELECT role INTO v_role FROM public.user_profiles WHERE id = p_actor_id;
    IF v_role IS NULL OR v_role NOT IN ('admin', 'engineer') THEN
        RAISE EXCEPTION 'DELIVERY_ACTOR_NOT_AUTHORISED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.order_files WHERE file_code = p_file_code;
    IF v_file.id IS NULL OR v_file.order_id <> v_order.id THEN
        RAISE EXCEPTION 'DELIVERABLE_FILE_NOT_OWNED_BY_ORDER' USING ERRCODE = '23514';
    END IF;
    IF v_file.file_category <> 'deliverable' THEN
        RAISE EXCEPTION 'DELIVERABLE_FILE_NOT_A_DELIVERABLE' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_review FROM public.order_qa_reviews WHERE review_code = p_qa_review_code;
    IF v_review.id IS NULL OR v_review.order_id <> v_order.id OR v_review.deliverable_file_id <> v_file.id THEN
        RAISE EXCEPTION 'DELIVERY_QA_REVIEW_NOT_FOR_FILE' USING ERRCODE = '23514';
    END IF;
    IF v_review.decision <> 'approved' THEN
        RAISE EXCEPTION 'DELIVERY_QA_NOT_APPROVED' USING ERRCODE = '23514';
    END IF;
    SELECT id INTO v_latest_review_id FROM public.order_qa_reviews
     WHERE order_id = v_order.id ORDER BY created_at DESC, id DESC LIMIT 1;
    IF v_latest_review_id <> v_review.id THEN
        RAISE EXCEPTION 'DELIVERY_QA_SUPERSEDED: a newer QA review exists for this order' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.order_deliverables (
        deliverable_code, order_id, uploaded_by, title, storage_bucket_path, verification_notes,
        qa_checklist_passed, deliverable_file_id, qa_review_id, file_sha256, payload_json, created_at
    ) VALUES (
        v_deliv_code, v_order.id, p_actor_id, p_title, v_file.storage_path, p_verification_notes,
        true, v_file.id, v_review.id, v_file.sha256_hash,
        jsonb_build_object('fileCode', v_file.file_code, 'qaReviewCode', v_review.review_code), v_now
    );

    v_payload := jsonb_set(jsonb_set(jsonb_set(COALESCE(p_order_payload, v_order.payload_json),
        '{status}', '"delivered"'::jsonb),
        '{deliveredAt}', to_jsonb(v_now_txt)),
        '{updatedAt}', to_jsonb(v_now_txt));

    UPDATE public.orders
       SET order_status = 'delivered', delivered_at = v_now, payload_json = v_payload, updated_at = v_now
     WHERE id = v_order.id
    RETURNING * INTO v_order;

    INSERT INTO public.audit_logs (log_code, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at)
    VALUES (
        'log_deliver_' || v_order.id::TEXT || '_' || gen_random_uuid()::TEXT,
        p_actor_id, v_role::TEXT, 'ORDER_DELIVERED_WITH_QA_APPROVAL', 'order', v_order.order_code,
        jsonb_build_object('deliverableCode', v_deliv_code, 'fileCode', v_file.file_code,
            'fileSha256', v_file.sha256_hash, 'qaReviewCode', v_review.review_code,
            'qaReviewerId', v_review.reviewer_id, 'rowVersion', v_order.row_version),
        v_now
    );

    RETURN jsonb_build_object(
        'order', v_order.payload_json,
        'rowVersion', v_order.row_version,
        'deliverableCode', v_deliv_code
    );
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_order_with_qa_approval(TEXT, BIGINT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_order_with_qa_approval(TEXT, BIGINT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
    TO service_role;
