-- ==============================================================================
-- HOOOPLAAA INCORPORATED — CANONICAL PRODUCTION SCHEMA & RLS MIGRATION (V6.0)
-- Target Supabase Project: aqmyqezuoscpgqwtvblu (https://aqmyqezuoscpgqwtvblu.supabase.co)
-- Pure Supabase PostgreSQL DDL: Does NOT override Supabase-managed auth.users,
-- auth.uid(), or managed database roles (anon, authenticated, service_role).
-- ==============================================================================

-- 1. CUSTOM ENUM TYPES
DO $$ BEGIN
    CREATE TYPE public.user_role_enum AS ENUM ('customer', 'finance', 'engineer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status_enum AS ENUM (
        'created',
        'draft_quote',
        'quote_issued',
        'awaiting_payment',
        'payment_under_review',
        'paid',
        'awaiting_requirements',
        'intake_pending',
        'intake_submitted',
        'ready_for_fulfillment',
        'in_progress',
        'qa_review',
        'in_qa',
        'delivered',
        'revision_requested',
        'accepted',
        'completed',
        'closed',
        'blocked_waiting_customer',
        'blocked_external_platform',
        'cancelled',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method_enum AS ENUM (
        'sslcommerz',
        'sslcommerz_sandbox',
        'sslcommerz_live',
        'manual_mfs',
        'bkash_direct',
        'bkash_merchant_direct',
        'nagad_merchant_direct',
        'bank_transfer',
        'manual_bank_wire'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status_enum AS ENUM (
        'unpaid',
        'initiated',
        'pending_verification',
        'verified',
        'paid',
        'failed',
        'refund_pending',
        'refunded',
        'disputed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website_url TEXT NOT NULL DEFAULT '',
    industry TEXT NOT NULL DEFAULT 'Digital Commerce',
    country_code VARCHAR(2) NOT NULL DEFAULT 'BD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. USER PROFILES (LINKED TO SUPABASE MANAGED auth.users; NO PASSWORD HASHES STORED HERE)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role public.user_role_enum NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. SERVICE CATALOG (IMMUTABLE OWNER-CONFIRMED PRICING & DELIVERY TARGETS)
CREATE TABLE IF NOT EXISTS public.service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_bn TEXT,
    short_description TEXT NOT NULL,
    category TEXT NOT NULL,
    base_price_minor BIGINT NOT NULL,
    base_price_bdt NUMERIC(10, 2) NOT NULL,
    base_price_usd NUMERIC(10, 2) NOT NULL,
    original_price_bdt NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_base_package BOOLEAN NOT NULL DEFAULT true,
    checkout_enabled BOOLEAN NOT NULL DEFAULT true,
    owner_confirmed_price BOOLEAN NOT NULL DEFAULT true,
    turnaround_days INT NOT NULL DEFAULT 2,
    delivery_target TEXT NOT NULL DEFAULT '1–2 business days',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.service_catalog (
    sku, slug, title, title_bn, short_description, category,
    base_price_minor, base_price_bdt, base_price_usd, original_price_bdt,
    is_base_package, checkout_enabled, owner_confirmed_price, turnaround_days, delivery_target
) VALUES
    ('HI-SET-META', 'meta-business-setup', 'Meta Business Setup', 'মেটা বিজনেস সেটআপ (ফেসবুক ও ইনস্টাগ্রাম)', 'Professional Meta Business Portfolio creation, Facebook Page optimization, Instagram linking, asset security, and delegated ownership handover.', 'Paid Social Foundation', 150000, 1500.00, 14.00, NULL, true, true, true, 2, '1–2 business days'),
    ('HI-SET-GOOGLE', 'google-business-setup', 'Google Business Profile Setup', 'গুগল বিজনেস প্রোফাইল সেটআপ', 'Complete Google Business Profile setup for eligible local storefronts and service-area businesses, category optimization, and verification roadmap.', 'Local & Search Presence', 150000, 1500.00, 14.00, NULL, true, true, true, 2, '1–2 days submission'),
    ('HI-SET-LINKEDIN', 'linkedin-company-page-setup', 'LinkedIn Company Page Setup', 'লিঙ্কডইন কোম্পানি পেজ সেটআপ', 'Corporate LinkedIn Company Page establishment, banner/logo optimization, headline positioning, and company administrator assignment.', 'B2B Social Infrastructure', 150000, 1500.00, 14.00, NULL, true, true, true, 1, '1 business day'),
    ('HI-BUNDLE-3', 'complete-3-platform-business-setup', 'Complete 3-Platform Business Setup (Hero Offer)', 'কমপ্লিট ৩-প্ল্যাটফর্ম বিজনেস সেটআপ (হিরো অফার)', 'Unified omni-channel infrastructure across Meta (Facebook + IG), Google Business, and LinkedIn. Save ৳1,500 compared to individual setups.', 'Omnichannel Suite', 300000, 3000.00, 28.00, 4500.00, true, true, true, 4, '2–4 business days'),
    ('HI-ADD-WA', 'whatsapp-automation-setup', 'WhatsApp Automation Setup', 'হোয়াটসঅ্যাপ অটোমেশন সেটআপ', 'Turn inquiries into instant conversations with automated welcome, away messages, interactive catalog routing, and quick replies.', 'Conversational Add-on', 169000, 1690.00, 16.00, NULL, false, true, true, 2, '2 business days'),
    ('HI-ADD-PIXEL', 'meta-pixel-tracking-setup', 'Meta Pixel Tracking Setup', 'মেটা পিক্সেল ট্র্যাকিং সেটআপ', 'Standard event tracking for your website to measure visitors, page views, leads, and purchases for high-ROI ad attribution.', 'Technical Tracking Add-on', 150000, 1500.00, 14.00, NULL, false, true, true, 2, 'Scope dependent (1–2 business days standard)'),
    ('HI-ADD-CREATIVE', 'professional-ad-creative-basic-static', 'Professional Ad Creative (Basic Static)', 'প্রফেশনাল অ্যাড ক্রিয়েটিভ (স্ট্যাটিক ব্যানার)', 'High-converting, bespoke static ad creative designed to stop the scroll and drive clicks on Facebook, Instagram, and LinkedIn.', 'Creative Add-on', 99000, 990.00, 9.00, NULL, false, true, true, 2, '1–2 business days')
ON CONFLICT (sku) DO UPDATE SET
    base_price_minor = EXCLUDED.base_price_minor,
    base_price_bdt = EXCLUDED.base_price_bdt,
    turnaround_days = EXCLUDED.turnaround_days,
    delivery_target = EXCLUDED.delivery_target;

-- 5. AUTHORITATIVE QUOTATIONS
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_code TEXT UNIQUE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    selected_items JSONB NOT NULL,
    subtotal_minor BIGINT NOT NULL,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    eligibility_snapshot JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'priced',
    quote_hash TEXT NOT NULL,
    claim_token_hash TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. ORDERS (LIFECYCLE & SLA ENGINE)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
    assigned_engineer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_specialist_name TEXT,
    order_status public.order_status_enum NOT NULL DEFAULT 'awaiting_payment',
    financial_status public.payment_status_enum NOT NULL DEFAULT 'unpaid',
    intake_status TEXT NOT NULL DEFAULT 'not_started',
    total_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    quote_snapshot JSONB NOT NULL,
    sla_started_at TIMESTAMPTZ,
    sla_deadline_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. PAYMENTS & SETTLEMENT ATTEMPTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_code TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    payment_method public.payment_method_enum NOT NULL,
    payment_status public.payment_status_enum NOT NULL DEFAULT 'initiated',
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    idempotency_key TEXT UNIQUE NOT NULL,
    provider_session_key TEXT,
    provider_trx_id TEXT,
    provider_val_id TEXT UNIQUE,
    manual_sender_phone TEXT,
    manual_trx_reference TEXT,
    verified_by_finance_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    gateway_raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. IMMUTABLE PAYMENT EVENTS (CONCURRENCY-SAFE IDEMPOTENCY & REPLAY DEFENSE)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    provider_val_id TEXT UNIQUE,
    status TEXT NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    evidence_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. ORDER INTAKE REQUIREMENTS (ZERO-PASSWORD DELEGATION)
CREATE TABLE IF NOT EXISTS public.order_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    business_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_whatsapp TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    brand_colors TEXT,
    existing_page_links TEXT,
    partner_invite_status TEXT NOT NULL,
    notes TEXT,
    payload_json JSONB NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. PRIVATE FILE STORAGE METADATA (BACKED BY SUPABASE STORAGE BUCKET 'order-assets')
CREATE TABLE IF NOT EXISTS public.order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_code TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'order-assets',
    storage_path TEXT UNIQUE NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT true,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 11. DELIVERABLES & REVISIONS
CREATE TABLE IF NOT EXISTS public.order_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deliverable_code TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    storage_bucket_path TEXT NOT NULL,
    verification_notes TEXT NOT NULL,
    qa_checklist_passed BOOLEAN NOT NULL DEFAULT false,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.order_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_code TEXT UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    revision_notes TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 12. PRE-SALE & POST-SALE AUDIT REQUESTS
CREATE TABLE IF NOT EXISTS public.audit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    audit_type TEXT NOT NULL DEFAULT 'pre_sale_initial',
    business_name TEXT NOT NULL,
    website_or_page_url TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL DEFAULT '',
    primary_goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    payload_json JSONB NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 13. IMMUTABLE AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_code TEXT UNIQUE NOT NULL,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 14. SUPABASE STORAGE PRIVATE BUCKET PROVISIONING (WHEN storage SCHEMA IS PRESENT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'order-assets',
            'order-assets',
            false,
            26214400,
            ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/zip', 'application/x-zip-compressed']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 26214400;
    END IF;
END $$;

-- 15. ROW LEVEL SECURITY (RLS) POLICIES — STRICT MULTI-TENANT & RBAC ENFORCEMENT
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_intakes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliverables FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_revisions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Security Definer Helper Functions (Read caller's authoritative role & org from user_profiles)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role_enum AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID AS $$
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Service Catalog: Public read-only for active items; Admin full control
CREATE POLICY catalog_public_select ON public.service_catalog
    FOR SELECT USING (is_active = true);

CREATE POLICY catalog_admin_all ON public.service_catalog
    FOR ALL USING (public.get_auth_role() = 'admin')
    WITH CHECK (public.get_auth_role() = 'admin');

-- Organizations: Users see only their own organization; Staff see all
CREATE POLICY organizations_select ON public.organizations
    FOR SELECT USING (
        id = public.get_auth_org_id()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

-- User Profiles: Self read, Staff read all; Self update CANNOT alter role or organization_id
CREATE POLICY profiles_self_select ON public.user_profiles
    FOR SELECT USING (
        id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY profiles_self_update ON public.user_profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = public.get_auth_role()
        AND organization_id = public.get_auth_org_id()
    );

-- Quotes: Accessible by quote owner organization or Staff
CREATE POLICY quotes_select ON public.quotes
    FOR SELECT USING (
        organization_id IS NULL
        OR organization_id = public.get_auth_org_id()
        OR customer_id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    );

CREATE POLICY quotes_service_mutate ON public.quotes
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Orders: Strict tenant isolation (Customers see only their own; Staff see/update all; Mutations through service_role)
CREATE POLICY orders_customer_select ON public.orders
    FOR SELECT USING (
        organization_id = public.get_auth_org_id()
        OR customer_id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    );

CREATE POLICY orders_service_mutate ON public.orders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY orders_staff_update ON public.orders
    FOR UPDATE USING (
        public.get_auth_role() IN ('admin', 'finance', 'engineer')
    )
    WITH CHECK (
        public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

-- Payments: Customers view own order payments only; Mutation strictly restricted to service_role; Staff can update
CREATE POLICY payments_select ON public.payments
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    );

CREATE POLICY payments_service_mutate ON public.payments
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY payments_finance_update ON public.payments
    FOR UPDATE USING (public.get_auth_role() IN ('finance', 'admin'))
    WITH CHECK (public.get_auth_role() IN ('finance', 'admin'));

-- Payment Events: Finance, Admin & service_role only
CREATE POLICY payment_events_staff_all ON public.payment_events
    FOR ALL USING (
        public.get_auth_role() IN ('finance', 'admin') 
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    )
    WITH CHECK (
        public.get_auth_role() IN ('finance', 'admin') 
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    );

-- Order Intakes: Customers view/submit only for their own order; Staff view all
CREATE POLICY intakes_select ON public.order_intakes
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY intakes_insert ON public.order_intakes
    FOR INSERT WITH CHECK (
        submitted_by = auth.uid()
        AND order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid() OR organization_id = public.get_auth_org_id())
    );

-- Order Files: Customers view/upload only for their own order; Staff view/upload all
CREATE POLICY files_select ON public.order_files
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY files_insert ON public.order_files
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND (
            order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid() OR organization_id = public.get_auth_org_id())
            OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
        )
    );

-- Deliverables & Revisions: Order owner & Staff
CREATE POLICY deliverables_select ON public.order_deliverables
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY deliverables_staff_insert ON public.order_deliverables
    FOR INSERT WITH CHECK (public.get_auth_role() IN ('admin', 'engineer'));

CREATE POLICY revisions_select ON public.order_revisions
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY revisions_customer_insert ON public.order_revisions
    FOR INSERT WITH CHECK (
        requested_by = auth.uid()
        AND order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid() OR organization_id = public.get_auth_org_id())
    );

-- Audit Requests: Confidential GET restricted to Staff or owner; public/authenticated INSERT allowed
CREATE POLICY audit_requests_select ON public.audit_requests
    FOR SELECT USING (
        customer_id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY audit_requests_insert ON public.audit_requests
    FOR INSERT WITH CHECK (true);

-- Audit Logs: Strictly append-only; read-only for Admin, Finance & service_role; Insert restricted to service_role
CREATE POLICY audit_select ON public.audit_logs
    FOR SELECT USING (
        public.get_auth_role() IN ('admin', 'finance') 
        OR COALESCE(current_setting('request.jwt.claim.role', true), 'anon') = 'service_role'
    );

CREATE POLICY audit_service_mutate ON public.audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 16. TRANSACTIONAL INTEGRITY, CONCURRENCY CONTROL & RPC STORED FUNCTIONS (V7.1)
-- ==============================================================================

-- Priority 1: Prevent duplicate active orders for the same quote snapshot
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_quote 
ON public.orders (quote_id) 
WHERE order_status NOT IN ('cancelled', 'refunded');

-- Unique attempt code per order to guarantee payment deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_attempt 
ON public.payments (order_id, attempt_code);

-- Helper Function: Calculate Business Days Delivery Target (Excludes Weekends)
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

-- RPC 1: Atomic Payment & Order Settlement Function
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
    IF COALESCE(current_setting('request.jwt.claim.role', true), 'anon') <> 'service_role' 
       AND (public.get_auth_role() NOT IN ('finance', 'admin')) THEN
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
        -- If settled with this exact payment attempt, return idempotent success
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

-- RPC 2: Transactional Quote to Active Order Conversion Function
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
    IF COALESCE(current_setting('request.jwt.claim.role', true), 'anon') <> 'service_role' 
       AND (public.get_auth_role() NOT IN ('admin', 'finance')) THEN
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

-- RPC 3: Guest Quote Claiming Function
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
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' 
       AND COALESCE(auth.role(), '') <> 'service_role' 
       AND (public.get_auth_role() NOT IN ('finance', 'admin')) THEN
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

-- ==============================================================================
-- 17. DATABASE SECURITY, PRIVILEGED RPC HARDENING & ACCESS CONTROL (V7.2)
-- ==============================================================================

-- Revoke execution of SECURITY DEFINER stored procedures from public/unauthenticated/client roles
REVOKE EXECUTE ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_order_payment_paid(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_active_order(UUID, TEXT, UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_quote(TEXT, UUID, UUID, TEXT) TO service_role;

-- Revoke mutation rights on authoritative financial tables from anonymous and ordinary customer clients
REVOKE INSERT, UPDATE, DELETE ON public.quotes FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM PUBLIC, anon, authenticated;

-- Grant trusted mutation privileges exclusively to service_role (authoritative server backend)
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

-- Grant read privileges to authenticated users (governed by RLS policies)
GRANT SELECT ON public.quotes TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.payment_events TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
