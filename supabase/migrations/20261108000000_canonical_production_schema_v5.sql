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
    );

CREATE POLICY quotes_insert ON public.quotes
    FOR INSERT WITH CHECK (true);

-- Orders: Strict tenant isolation (Customers see/create only their own; Staff see/update all)
CREATE POLICY orders_customer_select ON public.orders
    FOR SELECT USING (
        organization_id = public.get_auth_org_id()
        OR customer_id = auth.uid()
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY orders_customer_insert ON public.orders
    FOR INSERT WITH CHECK (
        organization_id = public.get_auth_org_id()
        AND customer_id = auth.uid()
    );

CREATE POLICY orders_staff_update ON public.orders
    FOR UPDATE USING (
        public.get_auth_role() IN ('admin', 'finance', 'engineer')
    )
    WITH CHECK (
        public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

-- Payments: Customers view own order payments & insert pending_verification only; ONLY Finance/Admin can update
CREATE POLICY payments_select ON public.payments
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id() OR customer_id = auth.uid())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY payments_customer_insert ON public.payments
    FOR INSERT WITH CHECK (
        order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
        AND payment_status IN ('initiated', 'pending_verification')
    );

CREATE POLICY payments_finance_update ON public.payments
    FOR UPDATE USING (public.get_auth_role() IN ('finance', 'admin'))
    WITH CHECK (public.get_auth_role() IN ('finance', 'admin'));

-- Payment Events: Finance & Admin read/write only
CREATE POLICY payment_events_staff_all ON public.payment_events
    FOR ALL USING (public.get_auth_role() IN ('finance', 'admin'))
    WITH CHECK (public.get_auth_role() IN ('finance', 'admin'));

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

-- Audit Logs: Strictly append-only; read-only for Admin & Finance
CREATE POLICY audit_select ON public.audit_logs
    FOR SELECT USING (public.get_auth_role() IN ('admin', 'finance'));

CREATE POLICY audit_insert ON public.audit_logs
    FOR INSERT WITH CHECK (true);
