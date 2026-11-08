# HOOOPLAAA INCORPORATED — SYSTEM ARCHITECTURE & COMMERCIAL COMMERCE SPECIFICATION
**Document Version:** 3.0.0-PROD-SPEC  
**Reference Timestamp:** 2026-11-08  
**Architecture Classification:** Self-Service B2B Service Commerce & Lifecycle Management  
**Target Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage, Edge Functions), Vercel

---

## 1. System Topology & Core Domain Boundaries

HOOOPLAAA is architected as an asynchronous, self-service digital infrastructure platform. All pricing, eligibility validations, state transitions, and deliverable handoffs are strictly enforced by isolated server-side domain services.

```
                           +----------------------------------------+
                           |          Customer Client App           |
                           |   (Next.js App Router / React Server   |
                           |     Components + Client Islands)       |
                           +-------------------+--------------------+
                                               |
                                     HTTPS / JSON / RPC
                                               |
                                               v
+-----------------------------------------------------------------------------------+
|                            DOMAIN API GATEWAY LAYER                               |
|-----------------------------------------------------------------------------------|
|  +-------------------+   +--------------------+   +----------------------------+  |
|  | Eligibility Guard |   | Pricing Calculator |   | Idempotent Payment Manager |  |
|  | (Policy & Prereq) |   | (Authoritative)    |   | (bKash / SSLCommerz / Bank)|  |
|  +-------------------+   +--------------------+   +----------------------------+  |
+-----------------------------------------------------------------------------------+
                                               |
                     Service Role / RLS Session Authenticated Client
                                               v
+-----------------------------------------------------------------------------------+
|                        SUPABASE PERSISTENCE & STORAGE                             |
|-----------------------------------------------------------------------------------|
|  [Postgres Core]            [Postgres Audit Log]        [Private S3-Compatible]  |
|  - organizations            - immutable_audit_trail     - intake-assets/ (RLS)    |
|  - service_catalog          - financial_transactions    - deliverables/ (RLS)     |
|  - quote_snapshots          - transition_logs           - compliance-docs/ (RLS)  |
|  - orders & milestones                                                            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Relational Database Schema & Strict Row-Level Security (RLS)

All tables strictly enforce PostgreSQL Row-Level Security. Roles (`customer`, `engineer`, `finance`, `admin`) are resolved strictly via `auth.users` app metadata or an internal identity table, never from client-modifiable headers.

### 2.1 Database Definition (PostgreSQL 15+)

```sql
-- Enums for commercial states
CREATE TYPE order_status_enum AS ENUM (
  'draft',
  'quoted',
  'payment_pending',
  'payment_verified',
  'intake_pending',
  'in_progress',
  'in_qa',
  'delivered',
  'accepted',
  'rejected',
  'cancelled'
);

CREATE TYPE payment_gateway_enum AS ENUM (
  'sslcommerz_sandbox',
  'bkash_direct_sandbox',
  'manual_bank_wire',
  'manual_bkash_merchant'
);

CREATE TYPE app_role_enum AS ENUM (
  'customer',
  'engineer',
  'finance',
  'admin'
);

-- Organization / Client Account
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  industry TEXT NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'BD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- User Profiles linked to Supabase Auth
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  role app_role_enum NOT NULL DEFAULT 'customer',
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Catalog Services (Authoritative Registry)
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price_bdt NUMERIC(12, 2) NOT NULL,
  base_price_usd NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  turnaround_business_days INT NOT NULL DEFAULT 5,
  eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Authoritative Quote Snapshots
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  service_sku TEXT REFERENCES public.service_catalog(sku),
  selected_addon_skus JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL CHECK (currency IN ('BDT', 'USD')),
  subtotal_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  final_amount NUMERIC(12, 2) NOT NULL,
  discount_code TEXT,
  quote_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Customer Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT UNIQUE NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  created_by UUID REFERENCES public.user_profiles(id) NOT NULL,
  assigned_engineer_id UUID REFERENCES public.user_profiles(id),
  status order_status_enum NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL CHECK (currency IN ('BDT', 'USD')),
  total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method payment_gateway_enum,
  payment_transaction_id TEXT,
  intake_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  qa_checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  staging_delivery_url TEXT,
  production_delivery_url TEXT,
  client_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Tamper-Evident Audit Trail
CREATE TABLE public.order_audit_trail (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.user_profiles(id),
  action TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### 2.2 Row-Level Security (RLS) Implementation

```sql
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_audit_trail ENABLE ROW LEVEL SECURITY;

-- Helper to check caller app role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role_enum LANGUAGE sql STABLE AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Public can read active catalog items
CREATE POLICY catalog_public_read ON public.service_catalog
  FOR SELECT USING (is_active = true);

-- Customers can view only their own orders
CREATE POLICY orders_customer_select ON public.orders
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
    OR public.current_user_role() IN ('admin', 'finance', 'engineer')
  );

-- Customers cannot modify payment verification or status directly
CREATE POLICY orders_customer_update_intake ON public.orders
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    (status = 'intake_pending' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'customer')
    OR public.current_user_role() IN ('admin', 'finance', 'engineer')
  );

-- Staff with finance or admin roles have full review privileges
CREATE POLICY orders_staff_all ON public.orders
  FOR ALL USING (
    public.current_user_role() IN ('admin', 'finance', 'engineer')
  );
```

---

## 3. Server-Authoritative Pricing & Eligibility Logic

Client apps submit user selections to a serverless/edge pricing endpoint. The server reconstitutes catalog prices from database records, validates business category restrictions, computes bundle savings, applies cryptographic hash signatures, and returns an immutable quote snapshot.

```
Input:
  {
    service_sku: "SETUP-META-GROWTH",
    addon_skus: ["ADDON-TRACKING-SERVER", "ADDON-HYPERCARE-14D"],
    discount_code: "FOUNDER10",
    business: {
      industry: "ecommerce_fashion",
      website_live: true,
      domain_owned: true,
      has_bm_access: true
    }
  }

Pricing Formula:
  Subtotal = Base(service_sku) + Sum(Base(addon_skus))
  Bundle_Discount = If service_sku == "SETUP-OMNI-3PLATFORM" then 10,000 BDT
  Promo_Discount = Valid(discount_code) ? Calculate(discount_code, Subtotal) : 0
  Total_Discount = Bundle_Discount + Promo_Discount
  Final_Amount = Max(0, Subtotal - Total_Discount)
  Quote_Hash = HMAC_SHA256(SecretKey, ServiceSKU + Addons + FinalAmount + ExpiresAt)
```

---

## 4. Zero-Password Delegated Access Protocol

**Security Mandate:** HOOOPLAAA platforms NEVER solicit, store, or accept client root passwords. All ad platform configurations occur through authorized agency delegation protocols:
- **Meta Business:** Request Partner Access to Assets via Partner Business ID (`948201948201`).
- **Google Ads:** Client accepts Manager Account (MCC) link invitation sent to their Google CID (`482-910-3391`).
- **LinkedIn Campaign Manager:** Organization Admin grants Agency Partner role to HOOOPLAAA Enterprise.
- **Google Tag Manager / GA4:** Standard GTM User delegation with "Publish" container permission.
