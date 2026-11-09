import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import crypto from 'crypto';
import { applyMigrations, bootstrapSupabasePlatform, getInitializedTestPostgres } from '../src/testing/supabase-pglite-bridge';

/**
 * V8.3 — upgrade compatibility of the V8.2 migration against a database that already holds pre-V8.2 data
 * (the situation of any existing staging/production project), plus least-privilege function grants.
 * LOCAL ONLY (fresh PGlite, real PostgreSQL roles).
 */

const ORG = '20000000-0000-4000-a000-000000000001';
const CUST = '30000000-0000-4000-a000-000000000001';
const ENG = '30000000-0000-4000-a000-000000000004';
const V82 = '20261112000000';

let pg: PGlite;
const ids = { awaiting: crypto.randomUUID(), delivered: crypto.randomUUID(), legacyDeliv: crypto.randomUUID() };

async function seedLegacy(db: PGlite) {
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${CUST}', 'legacy-cust@example.com'), ('${ENG}', 'legacy-eng@example.com');
    INSERT INTO public.organizations (id, name) VALUES ('${ORG}', 'Legacy Org');
    INSERT INTO public.user_profiles (id, organization_id, email, full_name, role) VALUES
      ('${CUST}', '${ORG}', 'legacy-cust@example.com', 'Legacy Customer', 'customer'),
      ('${ENG}', '${ORG}', 'legacy-eng@example.com', 'Legacy Engineer', 'engineer');
  `);
  for (const [key, code, status, fin, intake] of [
    ['awaiting', 'ord_legacy_awaiting', 'awaiting_payment', 'unpaid', 'not_started'],
    ['delivered', 'ord_legacy_delivered', 'delivered', 'paid', 'completed'],
  ] as const) {
    const quoteId = crypto.randomUUID();
    await db.query(
      `INSERT INTO public.quotes (id, quote_code, organization_id, customer_id, business_name, selected_items,
         subtotal_minor, total_minor, eligibility_snapshot, quote_hash, expires_at, payload_json)
       VALUES ($1, $2, $3, $4, 'Legacy', '[]', 150000, 150000, '{}', 'h', now() + interval '7 days', '{}')`,
      [quoteId, `quo_${code}`, ORG, CUST]
    );
    await db.query(
      `INSERT INTO public.orders (id, order_code, order_number, organization_id, customer_id, quote_id, order_status,
         financial_status, intake_status, total_minor, quote_snapshot, payload_json, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::public.order_status_enum, $8::public.payment_status_enum, $9, 150000, '{}',
         $10::jsonb, CASE WHEN $7 = 'delivered' THEN now() END)`,
      [ids[key], code, `HOO-${code}`, ORG, CUST, quoteId, status, fin, intake,
        JSON.stringify({ id: code, status, financialStatus: fin, intakeStatus: intake })]
    );
  }
  // Pre-V8.2 file rows: category only inside payload_json, old flat path layout.
  await db.query(
    `INSERT INTO public.order_files (file_code, order_id, uploaded_by, file_name, file_size_bytes, mime_type, sha256_hash,
       storage_path, payload_json)
     VALUES ('file_legacy_deliv', $1, $2, 'pack.pdf', 10, 'application/pdf', $3, 'orders/ord_legacy_delivered/pack.pdf',
       '{"category":"deliverable"}'),
            ('file_legacy_asset', $1, $4, 'logo.png', 10, 'image/png', $3, 'orders/ord_legacy_delivered/client_assets/logo.png',
       '{"category":"client_asset"}')`,
    [ids.delivered, ENG, 'f'.repeat(64), CUST]
  );
  // Pre-V8.2 deliverable: QA passed by flag, no file/review binding.
  await db.query(
    `INSERT INTO public.order_deliverables (id, deliverable_code, order_id, uploaded_by, title, storage_bucket_path,
       verification_notes, qa_checklist_passed)
     VALUES ($1, 'deliv_legacy', $2, $3, 'Legacy pack', 'orders/ord_legacy_delivered/pack.pdf', 'legacy', true)`,
    [ids.legacyDeliv, ids.delivered, ENG]
  );
}

describe('V8.3 — V8.2 migration upgrade compatibility', () => {
  beforeAll(async () => {
    pg = new PGlite();
    await bootstrapSupabasePlatform(pg);
    const before = await applyMigrations(pg, (f) => f < V82);
    expect(before.length).toBe(4);
    await seedLegacy(pg);
    const upgrade = await applyMigrations(pg, (f) => f >= V82);
    expect(upgrade[0]).toMatch(/^20261112000000/);
  }, 120000);

  it('existing orders start at row_version 0 and keep their state', async () => {
    const r = await pg.query<any>(`SELECT order_code, row_version, order_status FROM public.orders ORDER BY order_code`);
    expect(r.rows.map((x) => [x.order_code, Number(x.row_version), x.order_status])).toEqual([
      ['ord_legacy_awaiting', 0, 'awaiting_payment'],
      ['ord_legacy_delivered', 0, 'delivered'],
    ]);
  });

  it('file_category is backfilled from payload_json; legacy paths are left untouched', async () => {
    const r = await pg.query<any>(`SELECT file_code, file_category, storage_path FROM public.order_files ORDER BY file_code`);
    expect(r.rows).toEqual([
      { file_code: 'file_legacy_asset', file_category: 'client_asset', storage_path: 'orders/ord_legacy_delivered/client_assets/logo.png' },
      { file_code: 'file_legacy_deliv', file_category: 'deliverable', storage_path: 'orders/ord_legacy_delivered/pack.pdf' },
    ]);
  });

  it('legacy deliverables are preserved unbound and no QA approval is fabricated', async () => {
    const d = await pg.query<any>(`SELECT deliverable_code, qa_review_id, deliverable_file_id FROM public.order_deliverables`);
    expect(d.rows).toEqual([{ deliverable_code: 'deliv_legacy', qa_review_id: null, deliverable_file_id: null }]);
    const q = await pg.query<any>(`SELECT count(*)::int AS n FROM public.order_qa_reviews`);
    expect(q.rows[0].n).toBe(0);
  });

  it('guards apply to legacy rows on their next write (no regression, legal transitions only)', async () => {
    const tryUpdate = async (sql: string) => {
      try {
        await pg.transaction(async (tx) => {
          await tx.query('SET LOCAL ROLE service_role');
          await tx.query(sql);
        });
        return null;
      } catch (e: any) {
        return String(e.message);
      }
    };
    expect(await tryUpdate(`UPDATE public.orders SET financial_status = 'unpaid' WHERE order_code = 'ord_legacy_delivered'`)).toMatch(/ORDER_STATE_REGRESSION/);
    expect(await tryUpdate(`UPDATE public.orders SET financial_status = 'paid' WHERE order_code = 'ord_legacy_awaiting'`)).toMatch(/ORDER_PAYMENT_EVIDENCE_REQUIRED/);
    expect(await tryUpdate(`UPDATE public.orders SET order_status = 'payment_under_review' WHERE order_code = 'ord_legacy_awaiting'`)).toBeNull();
    const v = await pg.query<any>(`SELECT row_version FROM public.orders WHERE order_code = 'ord_legacy_awaiting'`);
    expect(Number(v.rows[0].row_version)).toBe(1);
    // Legacy file rows cannot be re-pointed or re-categorised.
    expect(await tryUpdate(`UPDATE public.order_files SET file_category = 'client_asset' WHERE file_code = 'file_legacy_deliv'`)).toMatch(/ORDER_FILE_IMMUTABLE/);
  });

  it('re-applying the V8.2+ migrations is idempotent', async () => {
    await expect(applyMigrations(pg, (f) => f >= V82)).resolves.toBeTruthy();
    const r = await pg.query<any>(`SELECT count(*)::int AS n FROM public.orders`);
    expect(r.rows[0].n).toBe(2);
  });
});

describe('V8.3 — least-privilege function grants (full migration set)', () => {
  it('anon/authenticated can execute only the RLS helper functions in public', async () => {
    const db = await getInitializedTestPostgres();
    const r = await db.query<any>(`
      SELECT p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
       ORDER BY 1`);
    expect(r.rows.map((x) => x.proname)).toEqual(['get_auth_org_id', 'get_auth_role']);
  });

  it('every SECURITY DEFINER function pins search_path', async () => {
    const db = await getInitializedTestPostgres();
    const r = await db.query<any>(`
      SELECT p.proname, p.proconfig
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef`);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect((row.proconfig || []).some((c: string) => c.startsWith('search_path=')), row.proname).toBe(true);
    }
  });
});

describe('V8.3 — approved catalog is preserved', () => {
  it('exactly the seven approved services are checkout-enabled at their authoritative poisha prices', async () => {
    const { CANONICAL_SERVICES } = await import('../src/domain/catalog');
    const enabled = CANONICAL_SERVICES.filter((s) => s.checkoutEnabled)
      .map((s) => [s.sku, s.basePriceMinor])
      .sort();
    expect(enabled).toEqual(
      [
        ['HI-ADD-CREATIVE', 99000],
        ['HI-ADD-PIXEL', 150000],
        ['HI-ADD-WA', 169000],
        ['HI-BUNDLE-3', 300000],
        ['HI-SET-GOOGLE', 150000],
        ['HI-SET-LINKEDIN', 150000],
        ['HI-SET-META', 150000],
      ].sort()
    );
    for (const s of CANONICAL_SERVICES) expect(Number.isInteger(s.basePriceMinor)).toBe(true);
  });
});
