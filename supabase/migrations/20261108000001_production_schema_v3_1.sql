-- ==============================================================================
-- HOOOPLAAA INCORPORATED — PRODUCTION DATABASE SCHEMA & RLS MIGRATIONS
-- Version: 3.1.0-PROD
-- Target: Supabase PostgreSQL 15+
-- Security: Multi-tenant Row-Level Security (RLS) with Role-Based Access Control
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM ENUMS
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('customer', 'engineer', 'finance', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'draft',
        'quoted',
        'payment_pending',
        'payment_verified',
        'intake_pending',
        'in_progress',
        'in_qa',
        'delivered',
        'revision_requested',
        'accepted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM (
        'sslcommerz_sandbox',
        'sslcommerz_live',
        'bkash_merchant_direct',
        'nagad_merchant_direct',
        'manual_bank_wire'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'initiated',
        'pending_verification',
        'verified',
        'failed',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website_url TEXT NOT NULL,
    industry TEXT NOT NULL,
    country_code VARCHAR(2) NOT NULL DEFAULT 'BD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role user_role_enum NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. SERVICE CATALOG (IMMUTABLE OWNER-CONFIRMED PRICING)
CREATE TABLE IF NOT EXISTS public.service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_bn TEXT,
    short_description TEXT NOT NULL,
    category TEXT NOT NULL,
    base_price_bdt NUMERIC(10, 2) NOT NULL,
    base_price_usd NUMERIC(10, 2) NOT NULL,
    original_price_bdt NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_base_package BOOLEAN NOT NULL DEFAULT true,
    turnaround_days INT NOT NULL DEFAULT 2,
    delivery_target TEXT NOT NULL DEFAULT '1–2 business days',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed confirmed setup prices & owner-approved delivery timelines (HOOOPLAAA_Service_Registry_2026-11-08.csv)
INSERT INTO public.service_catalog (sku, title, short_description, category, base_price_bdt, base_price_usd, original_price_bdt, is_base_package, turnaround_days, delivery_target)
VALUES
    ('HI-SET-META', 'Meta Business Setup', 'Meta Business Manager portfolio structure, verified domain linkage, asset delegation, and zero-password partner rights.', 'Paid Social Foundation', 1500.00, 14.00, NULL, true, 2, '1–2 business days'),
    ('HI-SET-GOOGLE', 'Google Business Setup', 'Google Business Profile claiming, physical address verification, Google Ads Manager CID MCC linking, and local asset hygiene.', 'Local & Search Presence', 1500.00, 14.00, NULL, true, 2, '1–2 days submission'),
    ('HI-SET-LINKEDIN', 'LinkedIn Company Page Setup', 'B2B Company page configuration, executive delegation, Insight Tag container link, and Campaign Manager structure.', 'B2B Social Infrastructure', 1500.00, 14.00, NULL, true, 1, '1 business day'),
    ('HI-BUNDLE-3', 'Complete 3-Platform Business Setup', 'Omnichannel architecture covering Meta, Google, and LinkedIn with unified naming governance and cross-network delegation.', 'Omnichannel Suite', 3000.00, 28.00, 4500.00, true, 4, '2–4 business days'),
    ('HI-ADD-WA', 'WhatsApp Automation Setup', 'Meta Cloud API WhatsApp Business webhook connection, quick-replies, catalog integration, and automated routing.', 'Conversational Add-on', 1690.00, 16.00, NULL, false, 2, '2 business days'),
    ('HI-ADD-PIXEL', 'Meta Pixel Tracking Setup', 'Standard event tracking for website visitors, leads, and purchases with Meta Pixel Helper verification.', 'Technical Tracking Add-on', 1500.00, 14.00, NULL, false, 2, 'Scope dependent (1–2 business days standard)'),
    ('HI-ADD-CREATIVE', 'Professional Ad Creative (Basic Static)', 'High-converting bespoke static visual design concept with multi-placement adaptation and headline copywriting.', 'Creative Add-on', 990.00, 9.00, NULL, false, 2, '1–2 business days')
ON CONFLICT (sku) DO UPDATE SET
    base_price_bdt = EXCLUDED.base_price_bdt,
    base_price_usd = EXCLUDED.base_price_usd,
    original_price_bdt = EXCLUDED.original_price_bdt,
    turnaround_days = EXCLUDED.turnaround_days,
    delivery_target = EXCLUDED.delivery_target;

-- 6. AUTHORITATIVE QUOTATIONS
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number TEXT UNIQUE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    service_sku TEXT REFERENCES public.service_catalog(sku) NOT NULL,
    addon_skus JSONB NOT NULL DEFAULT '[]'::jsonb,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('BDT', 'USD')),
    base_price NUMERIC(10, 2) NOT NULL,
    addons_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    coupon_code TEXT,
    final_amount NUMERIC(10, 2) NOT NULL,
    quote_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    business_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_converted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    quote_id UUID REFERENCES public.quotes(id),
    organization_id UUID REFERENCES public.organizations(id) NOT NULL,
    customer_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    assigned_engineer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    service_sku TEXT REFERENCES public.service_catalog(sku) NOT NULL,
    status order_status_enum NOT NULL DEFAULT 'payment_pending',
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('BDT', 'USD')),
    total_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. PAYMENTS & TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    payment_method payment_method_enum NOT NULL,
    payment_status payment_status_enum NOT NULL DEFAULT 'pending_verification',
    transaction_reference TEXT UNIQUE NOT NULL,
    sender_phone TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    gateway_session_id TEXT,
    gateway_payload JSONB DEFAULT '{}'::jsonb,
    verified_by UUID REFERENCES public.user_profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. INTAKE & COMPLIANCE REQUIREMENTS (ZERO-PASSWORD DELEGATED ACCESS)
CREATE TABLE IF NOT EXISTS public.order_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    business_goals TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    delegated_meta_partner_id TEXT,
    delegated_google_cid TEXT,
    delegated_gtm_invited BOOLEAN NOT NULL DEFAULT false,
    delegated_linkedin_admin BOOLEAN NOT NULL DEFAULT false,
    uploaded_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    intake_submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    is_sanitized_verified BOOLEAN NOT NULL DEFAULT true
);

-- 10. DELIVERABLES & REVISION REQUESTS
CREATE TABLE IF NOT EXISTS public.order_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    qa_checklist JSONB NOT NULL DEFAULT '{"capi_signal_tested": false, "consent_mode_verified": false, "custom_events_firing": false}'::jsonb,
    staging_preview_url TEXT,
    production_asset_package_url TEXT,
    handoff_documentation TEXT,
    delivered_at TIMESTAMPTZ,
    client_accepted_at TIMESTAMPTZ,
    revision_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.order_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES public.user_profiles(id) NOT NULL,
    revision_notes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'under_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    resolved_at TIMESTAMPTZ
);

-- 11. IMMUTABLE AUDIT TRAIL
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_role user_role_enum NOT NULL,
    action TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security helper functions
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role_enum AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID AS $$
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Service Catalog: Public read-only for active items
CREATE POLICY catalog_public_select ON public.service_catalog
    FOR SELECT USING (is_active = true);

CREATE POLICY catalog_admin_all ON public.service_catalog
    FOR ALL USING (public.get_auth_role() = 'admin');

-- User Profiles: Users can view their own profile; staff can view all
CREATE POLICY profiles_self_select ON public.user_profiles
    FOR SELECT USING (id = auth.uid() OR public.get_auth_role() IN ('admin', 'finance', 'engineer'));

CREATE POLICY profiles_self_update ON public.user_profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()));

-- Orders: Tenant isolation (Customers see only their organization; Staff see all)
CREATE POLICY orders_customer_select ON public.orders
    FOR SELECT USING (
        organization_id = public.get_auth_org_id()
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
    );

-- Payments: Only Finance and Admin can verify/update payments
CREATE POLICY payments_select ON public.payments
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE organization_id = public.get_auth_org_id())
        OR public.get_auth_role() IN ('admin', 'finance', 'engineer')
    );

CREATE POLICY payments_customer_insert ON public.payments
    FOR INSERT WITH CHECK (
        order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
        AND payment_status = 'pending_verification'
    );

CREATE POLICY payments_finance_update ON public.payments
    FOR UPDATE USING (public.get_auth_role() IN ('finance', 'admin'));

-- Audit Logs: Read-only for admin and finance; strictly append-only
CREATE POLICY audit_select ON public.audit_logs
    FOR SELECT USING (public.get_auth_role() IN ('admin', 'finance'));

CREATE POLICY audit_insert ON public.audit_logs
    FOR INSERT WITH CHECK (true);