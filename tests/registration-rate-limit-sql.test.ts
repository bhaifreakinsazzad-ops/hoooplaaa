import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { getInitializedTestPostgres } from '../src/testing/supabase-pglite-bridge';

/**
 * hit_registration_rate_limit (migration 20261111000000). LOCAL ONLY: disposable PGlite with REAL roles.
 */

const FN = 'public.hit_registration_rate_limit(text,integer,integer)';
const key = () => crypto.randomBytes(16).toString('hex');

async function asRole<T>(role: string, sql: string, params: unknown[] = []) {
  const pg = await getInitializedTestPostgres();
  await pg.exec('BEGIN');
  try {
    await pg.exec('SET LOCAL ROLE ' + role);
    return await pg.query<T>(sql, params);
  } finally {
    await pg.exec('ROLLBACK');
  }
}

describe('registration rate limit SQL (LOCAL ONLY, real PG roles)', () => {
  it('1. EXECUTE: anon/authenticated denied, service_role granted; definer pins search_path', async () => {
    const pg = await getInitializedTestPostgres();
    for (const role of ['anon', 'authenticated']) {
      const r = await pg.query<{ ok: boolean }>("SELECT has_function_privilege('" + role + "', '" + FN + "', 'EXECUTE') AS ok");
      expect(r.rows[0].ok, role).toBe(false);
    }
    const s = await pg.query<{ ok: boolean }>("SELECT has_function_privilege('service_role', '" + FN + "', 'EXECUTE') AS ok");
    expect(s.rows[0].ok).toBe(true);
    const cfg = await pg.query<{ cfg: string[]; secdef: boolean }>(
      "SELECT proconfig AS cfg, prosecdef AS secdef FROM pg_proc WHERE proname = 'hit_registration_rate_limit'"
    );
    expect(cfg.rows[0].secdef).toBe(true);
    expect((cfg.rows[0].cfg || []).join(',')).toMatch(/search_path=public, pg_temp/);
  });

  it('2. clients cannot call it or read/write the table directly', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(asRole(role, 'SELECT public.hit_registration_rate_limit($1, 60, 5)', [key()])).rejects.toThrow(/permission denied/i);
      await expect(asRole(role, 'SELECT * FROM public.registration_rate_limits')).rejects.toThrow(/permission denied/i);
      await expect(asRole(role, "INSERT INTO public.registration_rate_limits (key_hash) VALUES ('" + key() + "')")).rejects.toThrow(/permission denied/i);
    }
  });

  it('3. counts atomically: allowed up to max, then returns the seconds to wait', async () => {
    const pg = await getInitializedTestPostgres();
    const k = key();
    for (let i = 0; i < 3; i++) {
      const r = await pg.query<{ v: number }>('SELECT public.hit_registration_rate_limit($1, 600, 3) AS v', [k]);
      expect(r.rows[0].v).toBe(0);
    }
    const blocked = await pg.query<{ v: number }>('SELECT public.hit_registration_rate_limit($1, 600, 3) AS v', [k]);
    expect(blocked.rows[0].v).toBeGreaterThan(0);
    expect(blocked.rows[0].v).toBeLessThanOrEqual(600);
    // another key is independent
    const other = await pg.query<{ v: number }>('SELECT public.hit_registration_rate_limit($1, 600, 3) AS v', [key()]);
    expect(other.rows[0].v).toBe(0);
  });

  it('4. the window resets after it expires', async () => {
    const pg = await getInitializedTestPostgres();
    const k = key();
    for (let i = 0; i < 2; i++) await pg.query('SELECT public.hit_registration_rate_limit($1, 600, 1)', [k]);
    expect((await pg.query<{ v: number }>('SELECT public.hit_registration_rate_limit($1, 600, 1) AS v', [k])).rows[0].v).toBeGreaterThan(0);
    await pg.query("UPDATE public.registration_rate_limits SET window_start = now() - interval '2 hours' WHERE key_hash = $1", [k]);
    expect((await pg.query<{ v: number }>('SELECT public.hit_registration_rate_limit($1, 600, 1) AS v', [k])).rows[0].v).toBe(0);
  });

  it('5. rejects invalid keys and parameters; service_role can call it', async () => {
    const pg = await getInitializedTestPostgres();
    await expect(pg.query("SELECT public.hit_registration_rate_limit('short', 60, 5)")).rejects.toThrow(/invalid rate limit key/);
    await expect(pg.query('SELECT public.hit_registration_rate_limit($1, 0, 5)', [key()])).rejects.toThrow(/invalid rate limit parameters/);
    await expect(pg.query('SELECT public.hit_registration_rate_limit($1, 60, 0)', [key()])).rejects.toThrow(/invalid rate limit parameters/);
    const r = await asRole<{ v: number }>('service_role', 'SELECT public.hit_registration_rate_limit($1, 60, 5) AS v', [key()]);
    expect(r.rows[0].v).toBe(0);
  });
});
