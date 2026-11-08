-- ============================================================================
-- HOOOPLAAA INCORPORATED — CORE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Version: 3.0.0-PROD
-- Date: 2026-11-08 (Asia/Dhaka)
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- 1. ENUMS
CREATE TYPE order_status_enum AS ENUM (
  'draft',
  'quoted',
  'awaiting_payment',
  'payment_under_review',
  'paid',
  'awaiting_requirements',
  'ready_for_fulfillment',
  'in_progress',
  'qa_review',
  'delivered',
  'accepted',
  'revision_requested',
  'blocked_waiting_customer',
  'blocked_external_platform',
  'cancelled',
  'refunded'
);

CREATE TYPE financial_status_enum AS ENUM (
  'unpaid',
  'pending_verification',
  'paid',
  'refund_pending',
  'refunded',
  'disputed'
);

CREATE TYPE intake_status_enum AS ENUM (
  'not_started',
  'partially_completed',
  'completed',
  'needs_clarification'
);

CREATE TYPE payment_gateway_enum AS ENUM (
  'sslcommerz_sandbox',
  'sslcommerz_live',
  'bkash_direct_sandbox',
  'manual_mfs_bkash',
  'manual_mfs_nagad',
  'manual_bank_wire'
);

CREATE TYPE app_role_enum AS ENUM (
  'customer',
  'staff',
  'fulfillment',
  'finance',
  'admin',
  'super_admin'
);

-- 2. ORGANIZATIONS / CLIENT BUSINESSES
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website_url TEXT,
  operating_model TEXT NOT NULL DEFAULT 'in_person_storefront', -- in_person_storefront | service_area_in_person | online_only_no_in_person
  has_physical_storefront BOOLEAN NOT NULL DEFAULT true,
  conducts_in_person_visits BOOLEAN NOT NULL DEFAULT true,
  industry TEXT NOT NULL DEFAULT 'other',
  country_code CHAR(2) NOT NULL DEFAULT 'BD',
  city TEXT,
  facebook_page_status TEXT DEFAULT 'none',
  meta_portfolio_status TEXT DEFAULT 'none',
  google_profile_status TEXT DEFAULT 'none',
  linkedin_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. USER PROFILES (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role app_role_enum NOT NULL DEFAULT 'customer',
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. SERVICE CATALOG (Authoritative Registry)
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_bn TEXT,
  short_description TEXT NOT NULL,
  short_description_bn TEXT,
  category TEXT NOT NULL,
  base_price_minor INT NOT NULL, -- Stored in Poisha (1 BDT = 100 Poisha)
  billing_period TEXT NOT NULL DEFAULT 'one_time', -- one_time | weekly | monthly | quote
  publication_status TEXT NOT NULL DEFAULT 'draft', -- draft | source_listed | needs_verification | approved_internal | published | paused | retired | blocked
  checkout_enabled BOOLEAN NOT NULL DEFAULT false, -- Strictly false by default per security rules
  requires_quote BOOLEAN NOT NULL DEFAULT false,
  turnaround_target TEXT NOT NULL DEFAULT '1–2 business days',
  inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_confirmed_working_price BOOLEAN NOT NULL DEFAULT false,
  provenance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. AUTHORITATIVE QUOTES
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  customer_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  service_sku TEXT REFERENCES public.service_catalog(sku),
  selected_addon_skus JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL DEFAULT 'BDT',
  subtotal_minor INT NOT NULL,
  discount_minor INT NOT NULL DEFAULT 0,
  tax_minor INT NOT NULL DEFAULT 0,
  final_amount_minor INT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT '2026-11-08-v1',
  terms_hash TEXT NOT NULL,
  eligibility_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  can_self_checkout BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'priced', -- draft | priced | accepted | expired | requires_manual_scope
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. CUSTOMER ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  customer_user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  assigned_specialist_id UUID REFERENCES public.user_profiles(id),
  assigned_specialist_name TEXT,
  status order_status_enum NOT NULL DEFAULT 'awaiting_payment',
  financial_status financial_status_enum NOT NULL DEFAULT 'unpaid',
  intake_status intake_status_enum NOT NULL DEFAULT 'not_started',
  currency TEXT NOT NULL DEFAULT 'BDT',
  total_minor INT NOT NULL,
  total_paid_minor INT NOT NULL DEFAULT 0,
  payment_method payment_gateway_enum,
  payment_transaction_id TEXT,
  sla_started_at TIMESTAMPTZ, -- Contractual SLA clock: ONLY starts when paid AND intake complete!
  delivery_target_date TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  quote_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. ORDER LINE ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price_minor INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total_minor INT NOT NULL,
  scope_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. PAYMENT ATTEMPTS & RECONCILIATION
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  provider payment_gateway_enum NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  amount_minor INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | verified_paid | verified_failed | risk_hold | refunded
  provider_ref TEXT,
  transaction_reference TEXT,
  customer_phone TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. PAYMENT AUDIT EVENTS (Append-Only)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id BIGSERIAL PRIMARY KEY,
  payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE CASCADE,
  external_event_id TEXT UNIQUE NOT NULL, -- Replay attack prevention
  payload_hash TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  validation_status TEXT NOT NULL, -- valid | duplicate | invalid_signature | amount_mismatch | currency_mismatch
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. ONBOARDING INTAKE SUBMISSIONS (Strict Zero-Password Rule)
CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_whatsapp TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  brand_colors TEXT,
  existing_page_links TEXT,
  partner_invite_status TEXT NOT NULL DEFAULT 'pending_instructions', -- pending_instructions | invitation_sent | not_applicable
  notes TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 11. PRIVATE ORDER FILES (Stored in Private Storage Bucket)
CREATE TABLE IF NOT EXISTS public.order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES public.user_profiles(id),
  file_name TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 12. DELIVERABLES & QA HANDOVER
CREATE TABLE IF NOT EXISTS public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  access_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  qa_approved_by_staff_id UUID REFERENCES public.user_profiles(id),
  qa_approved_at TIMESTAMPTZ,
  client_acceptance_status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revision_requested
  revision_note TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 13. AUDIT REQUESTS (Pre-sale initial & Post-sale detailed)
CREATE TABLE IF NOT EXISTS public.audit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'pre_sale_initial', -- pre_sale_initial | post_sale_detailed
  business_name TEXT NOT NULL,
  website_or_page_url TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  primary_goal TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'submitted', -- submitted | triaged | in_review | completed | declined
  qualification_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES public.user_profiles(id),
  reviewer_notes TEXT,
  score_overall INT, -- 0-100
  key_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_sku TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ
);

-- 14. TAMPER-EVIDENT SYSTEM AUDIT LOG (Append-Only)
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID,
  actor_role app_role_enum NOT NULL DEFAULT 'customer',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role_enum LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
    'customer'::app_role_enum
  );
$$;

-- Helper function: user accessible organizations
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 1. Catalog: Anyone can read published items; only Admin can edit
CREATE POLICY catalog_public_read ON public.service_catalog
  FOR SELECT USING (publication_status = 'published' OR public.current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY catalog_admin_mutate ON public.service_catalog
  FOR ALL USING (public.current_user_role() IN ('admin', 'super_admin'));

-- 2. Organizations: Users only see their own org; Staff see all
CREATE POLICY org_customer_select ON public.organizations
  FOR SELECT USING (
    id = public.current_user_org_id() OR public.current_user_role() IN ('staff', 'fulfillment', 'finance', 'admin', 'super_admin')
  );

-- 3. Quotes: Customers see quotes created for their org; Staff see all
CREATE POLICY quotes_customer_select ON public.quotes
  FOR SELECT USING (
    organization_id = public.current_user_org_id() OR customer_user_id = auth.uid() OR public.current_user_role() IN ('staff', 'finance', 'admin', 'super_admin')
  );

-- 4. Orders: Multi-tenant isolation
CREATE POLICY orders_customer_select ON public.orders
  FOR SELECT USING (
    organization_id = public.current_user_org_id() OR customer_user_id = auth.uid() OR public.current_user_role() IN ('staff', 'fulfillment', 'finance', 'admin', 'super_admin')
  );

-- Customers can never modify financial_status directly
CREATE POLICY orders_customer_update ON public.orders
  FOR UPDATE USING (
    customer_user_id = auth.uid() OR organization_id = public.current_user_org_id()
  )
  WITH CHECK (
    -- Customer cannot change financial status or role-locked fields
    (financial_status = (SELECT financial_status FROM public.orders WHERE id = orders.id))
  );

-- Staff with finance role can verify payments
CREATE POLICY orders_staff_all ON public.orders
  FOR ALL USING (
    public.current_user_role() IN ('finance', 'admin', 'super_admin')
  );

-- 5. Order Files: Strictly private to owning customer & assigned staff
CREATE POLICY files_customer_select ON public.order_files
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_user_id = auth.uid() OR organization_id = public.current_user_org_id())
    OR public.current_user_role() IN ('fulfillment', 'admin', 'super_admin')
  );

-- 6. Intake: Customers can only insert/update for their orders
CREATE POLICY intake_customer_all ON public.intake_submissions
  FOR ALL USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_user_id = auth.uid() OR organization_id = public.current_user_org_id())
    OR public.current_user_role() IN ('fulfillment', 'admin', 'super_admin')
  );

-- 7. Audit logs & Payment events: Read-only for Admin, append-only system
CREATE POLICY audit_logs_admin_read ON public.system_audit_logs
  FOR SELECT USING (public.current_user_role() IN ('admin', 'super_admin'));
