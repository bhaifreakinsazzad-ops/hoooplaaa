import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * TEST-ONLY SUPABASE-TO-POSTGRESQL 16 (PGlite) HTTP BRIDGE
 *
 * Strictly restricted to automated test execution (`SUPABASE_TEST_BRIDGE === 'true'`).
 * Blocked in staging and production deployments.
 * Translates `@supabase/supabase-js` Auth (`/auth/v1`), PostgREST (`/rest/v1`),
 * and Storage (`/storage/v1`) HTTP requests into real PostgreSQL 16 SQL queries
 * executed against `supabase/migrations/20261108000000_canonical_production_schema_v5.sql`.
 */

interface TestAuthAccount {
  id: string;
  email: string;
  passwordDigest: string;
  userMetadata: Record<string, unknown>;
}

interface GlobalTestBridgeState {
  pgPromise?: Promise<PGlite>;
  authAccounts: Map<string, TestAuthAccount>;
  activeTokens: Map<string, string>; // accessToken -> userId
  storageObjects: Map<string, { bytes: Buffer; contentType: string }>; // bucket/path -> object
}

const globalState = (globalThis as unknown as { __hoooplaaaTestPgBridge?: GlobalTestBridgeState })
  .__hoooplaaaTestPgBridge || {
  authAccounts: new Map<string, TestAuthAccount>(),
  activeTokens: new Map<string, string>(),
  storageObjects: new Map<string, { bytes: Buffer; contentType: string }>(),
};
(globalThis as unknown as { __hoooplaaaTestPgBridge?: GlobalTestBridgeState }).__hoooplaaaTestPgBridge =
  globalState;

function digestTestPassword(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

export async function getInitializedTestPostgres(): Promise<PGlite> {
  if (process.env.SUPABASE_TEST_BRIDGE !== 'true') {
    throw new Error('Test PostgreSQL bridge cannot be invoked outside SUPABASE_TEST_BRIDGE=true.');
  }

  if (!globalState.pgPromise) {
    globalState.pgPromise = (async () => {
      const pg = new PGlite();

      // 1. Bootstrap Supabase-managed `auth` and `storage` schemas in disposable PG16 before running migration
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

        CREATE OR REPLACE FUNCTION auth.role()
        RETURNS TEXT AS $$
          SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon')::TEXT;
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

      // 2. Execute the exact production migration SQL
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261108000000_canonical_production_schema_v5.sql'
      );
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      await pg.exec(migrationSql);

      // Grant table permissions to roles in PG16
      await pg.exec(`
        GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
        GRANT SELECT ON public.service_catalog TO anon;
      `);

      // 3. Seed disposable test fixture accounts ONLY inside the test harness
      await seedTestAccountsInternal(pg, [
        {
          id: '00000000-0000-4000-a000-000000000001',
          organizationId: '10000000-0000-4000-a000-000000000001',
          organizationName: 'Dhaka Heritage Roasters Ltd.',
          email: 'alice@dhakaheritage.bd',
          password: process.env.TEST_CUSTOMER_A_PASSWORD || 'CustomerA#2026!',
          fullName: 'Alice Rahman (Customer A)',
          role: 'customer',
        },
        {
          id: '00000000-0000-4000-a000-000000000002',
          organizationId: '10000000-0000-4000-a000-000000000002',
          organizationName: 'Chittagong Marine Logistics',
          email: 'bob@chittagongtraders.bd',
          password: process.env.TEST_CUSTOMER_B_PASSWORD || 'CustomerB#2026!',
          fullName: 'Bob Karim (Customer B)',
          role: 'customer',
        },
        {
          id: '00000000-0000-4000-a000-000000000003',
          organizationId: '10000000-0000-4000-a000-000000000099',
          organizationName: 'HOOOPLAAA INCORPORATED Staff',
          email: 'finance@hoooplaaa.com',
          password: process.env.TEST_FINANCE_PASSWORD || 'Finance#2026!',
          fullName: 'Farhana Islam (Finance Officer)',
          role: 'finance',
        },
        {
          id: '00000000-0000-4000-a000-000000000004',
          organizationId: '10000000-0000-4000-a000-000000000099',
          organizationName: 'HOOOPLAAA INCORPORATED Staff',
          email: 'engineer@hoooplaaa.com',
          password: process.env.TEST_ENGINEER_PASSWORD || 'Engineer#2026!',
          fullName: 'Tanvir Ahmed (Senior Specialist)',
          role: 'engineer',
        },
        {
          id: '00000000-0000-4000-a000-000000000005',
          organizationId: '10000000-0000-4000-a000-000000000099',
          organizationName: 'HOOOPLAAA INCORPORATED Staff',
          email: 'admin@hoooplaaa.com',
          password: process.env.TEST_ADMIN_PASSWORD || 'Admin#2026!',
          fullName: 'Sazzad Hossain (Principal Admin)',
          role: 'admin',
        },
      ]);

      return pg;
    })();
  }
  return globalState.pgPromise;
}

async function seedTestAccountsInternal(
  pg: PGlite,
  accounts: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    email: string;
    password: string;
    fullName: string;
    role: 'customer' | 'finance' | 'engineer' | 'admin';
  }>
): Promise<void> {
  for (const acc of accounts) {
    const emailNorm = acc.email.trim().toLowerCase();
    globalState.authAccounts.set(emailNorm, {
      id: acc.id,
      email: emailNorm,
      passwordDigest: digestTestPassword(acc.password),
      userMetadata: { full_name: acc.fullName },
    });

    await pg.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [acc.id, emailNorm, JSON.stringify({ full_name: acc.fullName })]
    );

    await pg.query(
      `INSERT INTO public.organizations (id, name, website_url, industry)
       VALUES ($1, $2, 'https://example.bd', 'Digital Commerce')
       ON CONFLICT (id) DO NOTHING`,
      [acc.organizationId, acc.organizationName]
    );

    await pg.query(
      `INSERT INTO public.user_profiles (id, organization_id, email, full_name, role)
       VALUES ($1, $2, $3, $4, $5::public.user_role_enum)
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
      [acc.id, acc.organizationId, emailNorm, acc.fullName, acc.role]
    );
  }
}

export async function resetTestPostgresData(): Promise<void> {
  const pg = await getInitializedTestPostgres();
  await pg.exec(`
    DELETE FROM public.order_files;
    DELETE FROM public.order_deliverables;
    DELETE FROM public.order_revisions;
    DELETE FROM public.order_intakes;
    DELETE FROM public.payment_events;
    DELETE FROM public.payments;
    DELETE FROM public.orders;
    DELETE FROM public.quotes;
    DELETE FROM public.audit_requests;
    DELETE FROM public.audit_logs;
  `);
  globalState.storageObjects.clear();
}

function sqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function buildWhereClause(searchParams: URLSearchParams): string {
  const clauses: string[] = [];
  for (const [key, rawVal] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;

    if (key === 'or') {
      const inner = rawVal.replace(/^\(/, '').replace(/\)$/, '');
      const parts = inner.split(',');
      const orParts: string[] = [];
      for (const p of parts) {
        const m = p.match(/^([a-zA-Z0-9_]+)\.eq\.(.+)$/);
        if (m) {
          orParts.push(`${m[1]} = ${sqlLiteral(m[2])}`);
        }
      }
      if (orParts.length > 0) {
        clauses.push(`(${orParts.join(' OR ')})`);
      }
      continue;
    }

    if (rawVal.startsWith('eq.')) {
      clauses.push(`${key} = ${sqlLiteral(rawVal.slice(3))}`);
    } else if (rawVal.startsWith('ilike.')) {
      clauses.push(`lower(${key}) = lower(${sqlLiteral(rawVal.slice(6))})`);
    }
  }
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

export async function supabasePgliteFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const pg = await getInitializedTestPostgres();
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(urlStr);
  const method = (init?.method || 'GET').toUpperCase();

  // ---------------------------------------------------------------------------
  // 1. SUPABASE AUTH (/auth/v1/*)
  // ---------------------------------------------------------------------------
  if (url.pathname.startsWith('/auth/v1/')) {
    const subPath = url.pathname.replace('/auth/v1', '');

    if ((subPath === '/signup' || subPath === '/admin/users') && method === 'POST') {
      const body = JSON.parse(String(init?.body || '{}'));
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || 'TestPass#2026!');
      const meta = body.data || body.user_metadata || {};

      if (!email) {
        return Response.json({ message: 'Email required' }, { status: 400 });
      }

      const existing = globalState.authAccounts.get(email);
      if (existing && subPath === '/signup') {
        return Response.json({ message: 'User already registered' }, { status: 422 });
      }

      const hash = crypto.createHash('sha256').update(`user:${email}`).digest('hex');
      const userId = existing?.id || `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

      globalState.authAccounts.set(email, {
        id: userId,
        email,
        passwordDigest: digestTestPassword(password),
        userMetadata: meta,
      });

      await pg.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [userId, email, JSON.stringify(meta)]
      );

      const accessToken = `sb_jwt_${userId}_${crypto.randomBytes(12).toString('hex')}`;
      globalState.activeTokens.set(accessToken, userId);

      const userObj = {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        user_metadata: meta,
        app_metadata: { provider: 'email' },
        created_at: new Date().toISOString(),
      };

      if (subPath === '/admin/users') {
        return Response.json({ user: userObj }, { status: 200 });
      }

      return Response.json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `sb_ref_${crypto.randomBytes(12).toString('hex')}`,
        user: userObj,
      });
    }

    if (subPath === '/token' && method === 'POST') {
      const body = JSON.parse(String(init?.body || '{}'));
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      const acc = globalState.authAccounts.get(email);
      if (!acc || acc.passwordDigest !== digestTestPassword(password)) {
        return Response.json(
          { error: 'invalid_grant', error_description: 'Invalid login credentials' },
          { status: 400 }
        );
      }

      const accessToken = `sb_jwt_${acc.id}_${crypto.randomBytes(12).toString('hex')}`;
      globalState.activeTokens.set(accessToken, acc.id);

      const userObj = {
        id: acc.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: acc.email,
        user_metadata: acc.userMetadata,
        app_metadata: { provider: 'email' },
        created_at: new Date().toISOString(),
      };

      return Response.json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `sb_ref_${crypto.randomBytes(12).toString('hex')}`,
        user: userObj,
      });
    }

    if (subPath === '/user' && method === 'GET') {
      const headers = new Headers(init?.headers);
      const authHeader = headers.get('Authorization') || headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      let userId = globalState.activeTokens.get(token);
      if (!userId) {
        const m = token.match(/^sb_jwt_([0-9a-f-]{36})_/i);
        if (m) userId = m[1];
      }

      if (!userId) {
        return Response.json({ message: 'Invalid JWT' }, { status: 401 });
      }

      const rowRes = await pg.query<{ id: string; email: string; raw_user_meta_data: any }>(
        'SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1',
        [userId]
      );
      if (rowRes.rows.length === 0) {
        return Response.json({ message: 'User not found' }, { status: 401 });
      }

      const u = rowRes.rows[0];
      return Response.json({
        id: u.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: u.email,
        user_metadata: u.raw_user_meta_data || {},
        app_metadata: { provider: 'email' },
      });
    }

    if (subPath === '/logout' && method === 'POST') {
      return new Response(null, { status: 204 });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. SUPABASE STORAGE (/storage/v1/object/*)
  // ---------------------------------------------------------------------------
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const restPath = url.pathname.replace('/storage/v1/object/', '');

    if (method === 'POST' || method === 'PUT') {
      let rawBuffer: Buffer;
      if (Buffer.isBuffer(init?.body)) {
        rawBuffer = init.body;
      } else if (init?.body instanceof Uint8Array) {
        rawBuffer = Buffer.from(init.body);
      } else if (init?.body instanceof ArrayBuffer) {
        rawBuffer = Buffer.from(init.body);
      } else if (typeof Blob !== 'undefined' && init?.body instanceof Blob) {
        rawBuffer = Buffer.from(await init.body.arrayBuffer());
      } else {
        rawBuffer = Buffer.from(String(init?.body || ''));
      }

      const headers = new Headers(init?.headers);
      const contentType = headers.get('content-type') || 'application/octet-stream';
      const cleanPath = restPath.replace(/^(authenticated|public)\//, '');
      globalState.storageObjects.set(cleanPath, { bytes: rawBuffer, contentType });

      return Response.json({ Key: cleanPath, Id: crypto.randomUUID() }, { status: 200 });
    }

    if (method === 'GET') {
      const cleanPath = restPath.replace(/^(authenticated|public)\//, '');
      const stored = globalState.storageObjects.get(cleanPath) || globalState.storageObjects.get(restPath);
      if (!stored) {
        return Response.json({ error: 'Not Found', message: 'Object not found' }, { status: 404 });
      }
      return new Response(new Uint8Array(stored.bytes), {
        status: 200,
        headers: { 'Content-Type': stored.contentType },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. SUPABASE POSTGREST (/rest/v1/<table> & /rest/v1/rpc/<function>)
  // ---------------------------------------------------------------------------
  if (url.pathname.startsWith('/rest/v1/')) {
    const headers = new Headers(init?.headers);
    const authHeader = headers.get('Authorization') || headers.get('authorization') || '';
    const apiKey = headers.get('apikey') || headers.get('ApiKey') || '';

    // Authoritative caller role & user resolution for database security testing
    let callerRole = 'anon';
    let callerUserId = '';

    if (
      apiKey === 'test-service-role-key' ||
      apiKey === process.env.SUPABASE_SERVICE_ROLE_KEY ||
      authHeader === 'Bearer test-service-role-key' ||
      authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` ||
      authHeader.includes('service_role')
    ) {
      callerRole = 'service_role';
    } else if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token === 'test-anon-key' || token === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || token === 'anon') {
        callerRole = 'anon';
      } else if (token.startsWith('mock-jwt-customer-')) {
        callerRole = 'customer';
        callerUserId = token.replace('mock-jwt-customer-', '');
      } else if (token.startsWith('mock-jwt-finance-')) {
        callerRole = 'finance';
        callerUserId = token.replace('mock-jwt-finance-', '');
      } else if (token.startsWith('mock-jwt-admin-')) {
        callerRole = 'admin';
        callerUserId = token.replace('mock-jwt-admin-', '');
      } else if (token.startsWith('mock-jwt-staff-')) {
        callerRole = 'engineer';
        callerUserId = token.replace('mock-jwt-staff-', '');
      } else {
        const found = globalState.activeTokens.get(token);
        if (found) {
          callerRole = 'authenticated';
          callerUserId = found;
        } else {
          const m = token.match(/^sb_jwt_([0-9a-f-]{36})_/i);
          if (m) {
            callerRole = 'authenticated';
            callerUserId = m[1];
          } else {
            callerRole = 'authenticated';
            callerUserId = token;
          }
        }
      }
    }

    // Set PostgreSQL transaction session settings for PGlite
    try {
      if (callerUserId) {
        await pg.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false);`, [callerUserId, callerRole]);
      } else {
        await pg.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', $1, false);`, [callerRole]);
      }
    } catch {
      // non-fatal
    }

    // 3a. RPC STORED PROCEDURE CALLS (/rest/v1/rpc/<fnName>)
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fnName = url.pathname.replace('/rest/v1/rpc/', '').replace(/\/$/, '');

      // Priority 0: Lock down privileged SECURITY DEFINER RPC functions from client execution
      const privilegedRpcFunctions = [
        'settle_order_payment_paid',
        'convert_quote_to_active_order',
        'claim_guest_quote',
      ];

      if (privilegedRpcFunctions.includes(fnName)) {
        if (callerRole !== 'service_role') {
          return Response.json(
            {
              code: '42501',
              message: `permission denied for function ${fnName}`,
              details: 'Privileged database function is restricted to service_role',
              hint: 'Invoke this operation via authoritative server-side endpoints.',
            },
            { status: 403 }
          );
        }
      }

      const rawBody = String(init?.body || '{}');
      const rpcArgs = JSON.parse(rawBody || '{}');

      try {
        const argKeys = Object.keys(rpcArgs);
        let sql = '';
        let values: any[] = [];

        if (argKeys.length === 0) {
          sql = `SELECT public.${fnName}() as result;`;
        } else {
          const namedParams = argKeys.map((k, i) => `${k} => $${i + 1}`);
          sql = `SELECT public.${fnName}(${namedParams.join(', ')}) as result;`;
          values = argKeys.map((k) => {
            const val = rpcArgs[k];
            if (typeof val === 'object' && val !== null) {
              return JSON.stringify(val);
            }
            return val;
          });
        }

        const res = await pg.query<{ result: any }>(sql, values);
        const result = res.rows[0]?.result;
        return Response.json(result ?? null, { status: 200 });
      } catch (rpcErr: any) {
        return Response.json(
          {
            code: rpcErr?.code || 'P0001',
            message: rpcErr?.message || 'Stored procedure execution failed',
            details: String(rpcErr),
          },
          { status: 400 }
        );
      }
    }

    const table = url.pathname.replace('/rest/v1/', '').replace(/\/$/, '');
    if (!table) {
      return Response.json({ status: 'ok' }, { status: 200 });
    }

    // Priority 1: Prevent client-side manipulation of financial records
    const protectedTables = ['quotes', 'orders', 'payments', 'payment_events', 'audit_logs'];
    if (['POST', 'PATCH', 'DELETE'].includes(method) && protectedTables.includes(table)) {
      if (callerRole !== 'service_role') {
        return Response.json(
          {
            code: '42501',
            message: `permission denied for table ${table}`,
            details: `Direct client mutation on ${table} is forbidden. Must use authoritative server routes.`,
            hint: 'Use the official server endpoints to generate quotes, initiate orders, or record payments.',
          },
          { status: 403 }
        );
      }
    }

    const prefer = headers.get('Prefer') || headers.get('prefer') || '';
    const accept = headers.get('Accept') || headers.get('accept') || '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');

    try {
      if (method === 'GET') {
        const whereSql = buildWhereClause(url.searchParams);
        let orderSql = '';
        const orderParam = url.searchParams.get('order');
        if (orderParam) {
          const [col, dir] = orderParam.split('.');
          orderSql = `ORDER BY ${col} ${dir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
        }
        const sql = `SELECT * FROM public.${table} ${whereSql} ${orderSql}`;
        const res = await pg.query(sql);

        if (isSingle) {
          if (res.rows.length === 0) {
            return Response.json(
              { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' },
              { status: 406 }
            );
          }
          return Response.json(res.rows[0], { status: 200 });
        }

        return Response.json(res.rows, { status: 200 });
      }

      if (method === 'POST') {
        const rawBody = JSON.parse(String(init?.body || '{}'));
        const rows = Array.isArray(rawBody) ? rawBody : [rawBody];
        if (rows.length === 0) return Response.json([], { status: 201 });

        const cols = Object.keys(rows[0]);
        const colList = cols.join(', ');
        const valueGroups = rows.map(
          (r) => `(${cols.map((c) => sqlLiteral(r[c])).join(', ')})`
        );

        let conflictSql = '';
        const onConflict = url.searchParams.get('on_conflict');
        if (prefer.includes('resolution=merge-duplicates') || onConflict) {
          const conflictCol = onConflict || 'id';
          const updateCols = cols.filter((c) => c !== conflictCol && c !== 'id' && c !== 'created_at');
          if (updateCols.length > 0) {
            conflictSql = `ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateCols
              .map((c) => `${c} = EXCLUDED.${c}`)
              .join(', ')}`;
          } else {
            conflictSql = `ON CONFLICT (${conflictCol}) DO NOTHING`;
          }
        } else if (prefer.includes('resolution=ignore-duplicates')) {
          conflictSql = 'ON CONFLICT DO NOTHING';
        }

        const sql = `INSERT INTO public.${table} (${colList}) VALUES ${valueGroups.join(', ')} ${conflictSql} RETURNING *`;
        const res = await pg.query(sql);
        const out = isSingle ? res.rows[0] || null : res.rows;
        return Response.json(out, { status: 201 });
      }

      if (method === 'PATCH') {
        const updates = JSON.parse(String(init?.body || '{}'));
        const setParts = Object.entries(updates).map(([k, v]) => `${k} = ${sqlLiteral(v)}`);
        const whereSql = buildWhereClause(url.searchParams);
        const sql = `UPDATE public.${table} SET ${setParts.join(', ')} ${whereSql} RETURNING *`;
        const res = await pg.query(sql);
        const out = isSingle ? res.rows[0] || null : res.rows;
        return Response.json(out, { status: 200 });
      }

      if (method === 'DELETE') {
        const whereSql = buildWhereClause(url.searchParams);
        const sql = `DELETE FROM public.${table} ${whereSql} RETURNING *`;
        const res = await pg.query(sql);
        return Response.json(res.rows, { status: 200 });
      }
    } catch (err: any) {
      return Response.json(
        { code: '23505', message: err?.message || 'Database error', details: String(err) },
        { status: 400 }
      );
    }
  }

  return Response.json({ error: `Unhandled route: ${url.pathname}` }, { status: 404 });
}
