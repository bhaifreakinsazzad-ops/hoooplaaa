import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';

describe('PostgreSQL 16 Canonical Migration & Engine-Level RLS Enforcement (V6)', () => {
  const migrationDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migrationPath = path.join(
    migrationDir,
    '20261108000000_canonical_production_schema_v5.sql'
  );

  let pg: PGlite;
  let migrationSql: string;

  const ORG_ALPHA = '10000000-0000-4000-a000-000000000001';
  const ORG_BETA = '10000000-0000-4000-a000-000000000002';
  const ORG_STAFF = '10000000-0000-4000-a000-000000000099';

  const CUSTOMER_A = '00000000-0000-4000-a000-000000000001';
  const CUSTOMER_B = '00000000-0000-4000-a000-000000000002';
  const FINANCE_USER = '00000000-0000-4000-a000-000000000003';
  const ADMIN_USER = '00000000-0000-4000-a000-000000000005';

  const QUOTE_A = '20000000-0000-4000-a000-000000000001';
  const ORDER_A = '30000000-0000-4000-a000-000000000001';
  const PAYMENT_A = '40000000-0000-4000-a000-000000000001';

  beforeAll(async () => {
    pg = new PGlite();
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    // In disposable PGlite, pre-create Supabase-managed `auth` and `storage` schemas and roles
    // BEFORE running the production migration (since the production migration never overrides them).
    await pg.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
      );
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$ LANGUAGE sql STABLE;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        public BOOLEAN NOT NULL DEFAULT false,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
        END IF;
      END $$;
    `);

    await pg.exec(migrationSql);

    await pg.exec(`
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
      GRANT SELECT ON public.service_catalog TO anon;
    `);

    // Seed test tenants and users in disposable PostgreSQL 16
    await pg.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${CUSTOMER_A}', 'alice@dhakaheritage.bd'),
        ('${CUSTOMER_B}', 'bob@chittagongtraders.bd'),
        ('${FINANCE_USER}', 'finance@hoooplaaa.com'),
        ('${ADMIN_USER}', 'admin@hoooplaaa.com');

      INSERT INTO public.organizations (id, name, website_url, industry) VALUES
        ('${ORG_ALPHA}', 'Dhaka Heritage Roasters', 'https://dhakaheritage.bd', 'F&B'),
        ('${ORG_BETA}', 'Chittagong Traders', 'https://ctgtraders.bd', 'Logistics'),
        ('${ORG_STAFF}', 'HOOOPLAAA Staff', 'https://hoooplaaa.com', 'Agency');

      INSERT INTO public.user_profiles (id, organization_id, email, full_name, role) VALUES
        ('${CUSTOMER_A}', '${ORG_ALPHA}', 'alice@dhakaheritage.bd', 'Alice Rahman', 'customer'),
        ('${CUSTOMER_B}', '${ORG_BETA}', 'bob@chittagongtraders.bd', 'Bob Karim', 'customer'),
        ('${FINANCE_USER}', '${ORG_STAFF}', 'finance@hoooplaaa.com', 'Farhana Finance', 'finance'),
        ('${ADMIN_USER}', '${ORG_STAFF}', 'admin@hoooplaaa.com', 'Sazzad Admin', 'admin');

      INSERT INTO public.quotes (
        id, quote_code, organization_id, customer_id, business_name,
        selected_items, subtotal_minor, discount_minor, total_minor,
        eligibility_snapshot, status, quote_hash, expires_at, payload_json
      ) VALUES (
        '${QUOTE_A}', 'QUO-TEST-A', '${ORG_ALPHA}', '${CUSTOMER_A}', 'Dhaka Heritage Roasters',
        '[]'::jsonb, 300000, 0, 300000, '{}'::jsonb, 'priced', 'hash_a',
        timezone('utc', now()) + interval '7 days', '{}'::jsonb
      );
    `);
  });

  it('1. Ensures canonical SQL migration does NOT override Supabase auth.users, auth.uid(), or roles, and seeds 7 SKUs cleanly', async () => {
    const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
    expect(files).toEqual(['20261108000000_canonical_production_schema_v5.sql']);

    expect(migrationSql).not.toMatch(/CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+auth/i);
    expect(migrationSql).not.toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+auth\.users/i);
    expect(migrationSql).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+auth\.uid/i);
    expect(migrationSql).not.toMatch(/CREATE\s+ROLE\s+(anon|authenticated|service_role)/i);
    expect(migrationSql).not.toMatch(/password_hash/i);

    const catalogRes = await pg.query<{ sku: string; base_price_minor: number; delivery_target: string }>(
      'SELECT sku, base_price_minor, delivery_target FROM public.service_catalog ORDER BY sku'
    );
    expect(catalogRes.rows.length).toBe(7);
    expect(Number(catalogRes.rows.find((r) => r.sku === 'HI-BUNDLE-3')?.base_price_minor)).toBe(
      300000
    );
    expect(catalogRes.rows.find((r) => r.sku === 'HI-BUNDLE-3')?.delivery_target).toBe(
      '2–4 business days'
    );
  });

  it('2. Enforces PostgreSQL RLS: Customer A can create and read their own order, intake, and payment', async () => {
    await pg.exec(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${CUSTOMER_A}', true);

      INSERT INTO public.orders (
        id, order_code, order_number, organization_id, customer_id, quote_id,
        order_status, financial_status, intake_status, total_minor, quote_snapshot, payload_json
      ) VALUES (
        '${ORDER_A}', 'ORD-A-001', 'HI-202611-1001', '${ORG_ALPHA}', '${CUSTOMER_A}', '${QUOTE_A}',
        'payment_under_review', 'pending_verification', 'not_started', 300000, '{}'::jsonb, '{}'::jsonb
      );

      INSERT INTO public.payments (
        id, attempt_code, order_id, payment_method, payment_status, amount_minor, idempotency_key, manual_trx_reference
      ) VALUES (
        '${PAYMENT_A}', 'pay_mfs_001', '${ORDER_A}', 'manual_mfs', 'pending_verification', 300000, 'idemp_pg_1', 'BKASH998877'
      );

      INSERT INTO public.order_intakes (
        order_id, submitted_by, business_name, contact_email, contact_whatsapp,
        target_audience, partner_invite_status, payload_json
      ) VALUES (
        '${ORDER_A}', '${CUSTOMER_A}', 'Dhaka Heritage Roasters', 'alice@dhakaheritage.bd',
        '+8801711223344', 'Specialty Coffee Buyers', 'invitation_sent', '{}'::jsonb
      );
      COMMIT;
    `);

    const checkRes = await pg.query<{ id: string }>(
      `SELECT id FROM public.orders WHERE id = '${ORDER_A}'`
    );
    expect(checkRes.rows.length).toBe(1);
  });

  it('3. Enforces PostgreSQL RLS: Customer B is strictly blocked from reading or modifying Customer A orders, intakes, or files', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET LOCAL ROLE authenticated;');
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${CUSTOMER_B}', true);`);

    // Customer B attempts to SELECT Customer A's order and intake -> 0 rows visible
    const ordersB = await pg.query(`SELECT id FROM public.orders WHERE id = '${ORDER_A}'`);
    expect(ordersB.rows.length).toBe(0);

    const intakesB = await pg.query(
      `SELECT id FROM public.order_intakes WHERE order_id = '${ORDER_A}'`
    );
    expect(intakesB.rows.length).toBe(0);

    // Customer B attempts to INSERT a file onto Customer A's order -> blocked by RLS WITH CHECK
    await expect(
      pg.exec(`
        INSERT INTO public.order_files (
          file_code, order_id, uploaded_by, file_name, file_size_bytes, mime_type, sha256_hash, storage_path, payload_json
        ) VALUES (
          'file_hack', '${ORDER_A}', '${CUSTOMER_B}', 'malicious.png', 128, 'image/png', 'abc', 'orders/hack/malicious.png', '{}'::jsonb
        );
      `)
    ).rejects.toThrow(/row-level security policy/i);

    await pg.exec('ROLLBACK;');
  });

  it('4. Enforces PostgreSQL RLS: Customer cannot escalate their own role or change tenant organization_id', async () => {
    await pg.exec('BEGIN;');
    await pg.exec('SET LOCAL ROLE authenticated;');
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${CUSTOMER_A}', true);`);

    // Attempt privilege escalation to 'admin'
    await expect(
      pg.exec(`UPDATE public.user_profiles SET role = 'admin' WHERE id = '${CUSTOMER_A}';`)
    ).rejects.toThrow(/row-level security policy/i);

    await pg.exec('ROLLBACK;');

    // Verify role in DB remains 'customer'
    const profileRes = await pg.query<{ role: string }>(
      `SELECT role FROM public.user_profiles WHERE id = '${CUSTOMER_A}'`
    );
    expect(profileRes.rows[0].role).toBe('customer');
  });

  it('5. Enforces PostgreSQL RLS: Customer cannot verify payments, while Finance Officer can', async () => {
    // Customer A attempts to mark their own payment as 'verified'
    await pg.exec('BEGIN;');
    await pg.exec('SET LOCAL ROLE authenticated;');
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${CUSTOMER_A}', true);`);
    await pg.exec(
      `UPDATE public.payments SET payment_status = 'verified' WHERE id = '${PAYMENT_A}';`
    );
    await pg.exec('COMMIT;');

    // Because of `payments_finance_update` USING (get_auth_role() IN ('finance', 'admin')), 0 rows were updated
    const afterCustomerAttempt = await pg.query<{ payment_status: string }>(
      `SELECT payment_status FROM public.payments WHERE id = '${PAYMENT_A}'`
    );
    expect(afterCustomerAttempt.rows[0].payment_status).toBe('pending_verification');

    // Now Finance Officer updates the payment status to 'verified'
    await pg.exec('BEGIN;');
    await pg.exec('SET LOCAL ROLE authenticated;');
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${FINANCE_USER}', true);`);
    await pg.exec(`
      UPDATE public.payments
      SET payment_status = 'verified', verified_by_finance_id = auth.uid(), verified_at = timezone('utc', now())
      WHERE id = '${PAYMENT_A}';
    `);
    await pg.exec('COMMIT;');

    const afterFinanceVerify = await pg.query<{
      payment_status: string;
      verified_by_finance_id: string;
    }>(`SELECT payment_status, verified_by_finance_id FROM public.payments WHERE id = '${PAYMENT_A}'`);
    expect(afterFinanceVerify.rows[0].payment_status).toBe('verified');
    expect(afterFinanceVerify.rows[0].verified_by_finance_id).toBe(FINANCE_USER);
  });
});
