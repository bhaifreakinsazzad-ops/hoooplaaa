# V7.2R release evidence

**Classification: `LOCAL_VERIFIED_REMOTE_BLOCKED`** (production launch NOT authorized).

Base commit: `13b12559c8ddc2938d20daeaedf43501212a89d2` (local V7.2, previous remote PR head `6478c43`). V7.2R changes are in the commit that follows it.

## Commands (all after the last code edit, Windows, Node 22.14, npm 10.9)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` (Vitest 3.2.7) | exit 0 — 10 files, **81 passed** (baseline before work: 51) |
| `npm run lint` (ESLint 8 + next/core-web-vitals, newly configured; the old script had no linter) | exit 0 — 0 errors, 2 pre-existing hook-deps warnings |
| `npm run build` | exit 0 |
| `npm run test:e2e` (Playwright, Edge, `next start`) | **4 passed** (new test 4 = real-browser guest handoff) |

Test layers: unit; PGlite PostgreSQL 16 with real `anon/authenticated/service_role` roles via `SET LOCAL ROLE` (LOCAL ONLY); route-handler tests; real-browser Playwright against the PGlite bridge. None of these is a cloud Supabase test.

## Defects found and fixed
1. Guest claim secret in checkout URL + localStorage, plaintext in `quotes.payload_json`, hash returned by API → HttpOnly cookie, hash in service-only `quote_claims`, 30 min, single use, origin/CSRF check, no-store.
2. RLS `quotes_select` allowed `organization_id IS NULL` → every guest quote was world-readable to anon/authenticated. Replaced.
3. Policies/functions used `request.jwt.claim.role`; definer functions had no `search_path`; finance/admin could bypass via `get_auth_role()` → removed, pinned, grants-only.
4. SSLCOMMERZ `verifyCallback` claimed the payment event and marked the payment verified **before** settlement; a failed settle made retries impossible → verify is read-only, one atomic RPC.
5. Finance could approve an `initiated` gateway attempt; manual-MFS submit re-labelled `payments[0]` (possibly a gateway attempt); manual attempt was pending with no reference → strict rules in API **and** SQL.
6. Checkout idempotency key used `Date.now()` and `onConflict: idempotency_key` could overwrite attempts → stable per-order/method attempt, partial unique indexes, insert-once.
7. **Order-number collision**: `HOO-<year>-<6 chars of quote id>` only changed every ~16 h, so a second order in the window failed on `orders_order_number_key` → hash-based number.
8. SLA calendar hard-coded Sat/Sun in UTC → configurable Asia/Dhaka policy in SQL and TS (parity-tested); SLA records provisional policy.
9. Test bridge faked 403s in JS, ran as superuser, and re-granted all privileges after the migration → real roles, platform-default grants emulated *before* migrations, all migrations applied in order.
10. `lint` script had no ESLint installed → ESLint configured and added to CI.

## 20 gates
| # | Gate | Result | Evidence |
|---|---|---|---|
|1|V7.2 SHA + type fix, nothing lost|PASS|clean tree at start, `13b1255`, `gatewayRawPayload` at tests/rpc-security-and-sla.test.ts:325|
|2|No claim secret in URL/storage/logs/referrer|PASS (local)|Playwright test 4, API tests 1,3, SQL test 9|
|3|Handoff private, short-lived, single-use, cross-tenant safe|PASS (local)|API tests 3,5,6; SQL tests 10–12|
|4|Privileged RPCs denied to anon/authenticated; narrow privileges; safe search_path|PASS (local)|SQL tests 1–4 (`has_function_privilege`, `proconfig`)|
|5|Direct client financial/pricing/audit writes rejected|PASS (local)|SQL tests 5–8|
|6|Service-role APIs authorise caller + tenant|PASS (local, sampled)|API tests 5,7; e2e 2,3|
|7|Duplicate checkout → one order, controlled attempts|PASS (local)|API test 6; SQL test 19|
|8|Settlement atomic/consistent under failure, replay, concurrency|PASS (local; PGlite single connection)|SQL tests 13,15; order-payment test 10|
|9|Manual approval needs pending attempt + finance auth + evidence|PASS (local)|SQL tests 16–17; API test 7|
|10|SLA only when paid AND intake complete|PASS (local)|SQL test 20; existing tests 9, 19|
|11|Business calendar, per-SKU, mixed bundles|PASS (local) — **policy provisional/unapproved**|SQL tests 20–22; rpc test 7–8|
|12|No secrets/test admin creds in prod/Git|PARTIAL|secret scan clean, `.env*.local` ignored; test bridge + seeded test passwords are in server bundle, runtime-blocked|
|13|Last-edit tsc/Vitest/build/lint/Playwright|PASS|table above|
|14|Remote SHA, PR #2, CI|see Git section|—|
|15|Cloud Supabase state inspected|BLOCKED|no Supabase CLI/connector/credentials|
|16|Migrations applied to staging|BLOCKED|as above|
|17|Cloud Auth/RLS/Storage/RPC negative tests|BLOCKED|as above|
|18|Vercel team/project/HTTPS Preview|BLOCKED|no Vercel access|
|19|Remote browser journey|BLOCKED|no Preview|
|20|SSLCOMMERZ sandbox validation evidence|BLOCKED|no sandbox merchant credentials; S2S path untested against the provider|

## Smallest user actions
1. Authenticate Git/GitHub (`gh auth login` or Git Credential Manager) so the branch can be pushed.
2. Provide an authorized, empty **staging** Supabase project (Supabase CLI login or a connector) — apply the three migrations in order; run `has_function_privilege` checks.
3. Authorize a Vercel scope/project; set `APP_ENV=staging`, Supabase URL/anon key (public) and service key (server-only), SSLCOMMERZ sandbox store credentials; keep `SUPABASE_TEST_BRIDGE` unset.
4. Decide the Bangladesh weekend/holiday policy and set `BUSINESS_CALENDAR_APPROVED=true` (and update `business_calendar_policy`).

## Git (gate 14) — BLOCKED
- Local commit `73fbad3` (V7.2R) on top of `13b1255`. Remote `origin/feature/phase-6-10-production-platform` is still `6478c43` (checked with `git ls-remote`).
- `git push` (non-interactive, 60 s bound) timed out with exit 124: Git Credential Manager is configured but no usable cached GitHub credential; `gh` is not installed. Nothing was force-pushed. PR #2 and CI are therefore NOT updated.
- Work preserved as `E:\Agentic Work Station\Web Applications\hoooplaaa-v7-2r.bundle` (`6478c43..HEAD`).
- Action: run `git push origin feature/phase-6-10-production-platform` in a terminal and complete the GitHub browser sign-in, then check the CI run on PR #2.

## Git update (supersedes the "BLOCKED" section above)
- Pushed (non-force) `feature/phase-6-10-production-platform` @ `ca34fc1aace3a8f54dce65038932f0e0d2c7d557`; `git ls-remote` matches local HEAD.
- GitHub reports **PR #2 is already merged and closed** (its head was `6478c43`, merged into `main`), so it cannot be updated. A new PR from this branch to `main` is needed. The push recreated the branch on the remote.
- GitHub Actions run https://github.com/bhaifreakinsazzad-ops/hoooplaaa/actions/runs/42527698608 on `ca34fc1`: **completed / success** (tsc, ESLint, Vitest, build, Playwright all green on ubuntu).
- Gate 14: PASS for remote SHA + CI; PR #2 update N/A (merged) — new PR pending owner go-ahead.

## Post-merge staging cutover — status 2026-11-09
- `origin/main` = `e8ce915` (PR #2 and #3 merged). Local `main` fast-forwarded to it; work continues on `fix/test-bridge-isolation` cut from it.
- **Code change (gate 12):** `src/domain/persistent-db.ts` no longer statically imports `src/testing/*`; the PGlite bridge is lazy-loaded and refused whenever `VERCEL`, `VERCEL_ENV`, or `APP_ENV=staging|production` is set. New `tests/test-code-isolation.test.ts` (3 tests). After the change: tsc clean, ESLint 0 errors, Vitest **84/84**, build OK, Playwright **4/4**. Note the bridge chunk still exists in the server build output but is unreachable without `SUPABASE_TEST_BRIDGE=true` and a non-deployed environment.
- The directive file `HOOOPLAAA_CLAUDE_CODE_POST_MERGE_STAGING_CUTOVER_2026-11-09.md` was **not found** on this machine (not in the repo or Downloads); the numbered objectives in the chat message were followed instead.
- **BLOCKED — Supabase staging (gates 15–17):** no Supabase CLI, no Supabase connector in this session, and `.env.local` holds only placeholder anon/service keys. The project `aqmyqezuoscpgqwtvblu` exists (`/rest/v1/` and `/auth/v1/health` answer HTTP 401 without a key). Migration state, grants, Auth, RLS, Storage were NOT inspected. No schema change was attempted.
- **BLOCKED — Vercel Preview + remote E2E (gates 18–19):** no Vercel CLI/connector/credentials.
- **BLOCKED — SSLCOMMERZ sandbox (gate 20):** store id/password are placeholders.
- Classification unchanged: `LOCAL_VERIFIED_REMOTE_BLOCKED`.

### Smallest actions to unblock
1. Supabase: create/identify an **empty staging** project; run `npx supabase login` (or add a Supabase connector) and `npx supabase link`; share nothing in chat. Then I apply the 3 migrations in order and run `has_function_privilege`, anon/customer negative PostgREST, Storage and Auth checks.
2. Vercel: `npx vercel login` + `vercel link` for the HOOOPLAAA project (or add the Vercel connector); set Preview env vars in the Vercel dashboard (`APP_ENV=staging`, public Supabase URL/anon key, server-only service key, SSLCOMMERZ sandbox ids), `SUPABASE_TEST_BRIDGE` unset.
3. Provide SSLCOMMERZ sandbox store credentials via the Vercel dashboard (not chat).
