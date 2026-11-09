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

### Vercel read-only inspection (2026-11-09, after owner login)
- Vercel CLI 65.12.1 (via `npx`) is authenticated as `dandabuzzz-1922`; scopes: `db-x-codex` (pro), `notrealengine` (hobby).
- Project **`notrealengine/hoooplaaa`** (`prj_rdu5bJcqgK7kAuKG51AyMIljn6eb`, created 2026-11-09 04:02 local) is the HOOOPLAAA project. It already has several **Production** deployments and one Preview; `https://hoooplaaa.vercel.app` answers HTTP 200. These deployments predate this work and were not created or touched by me.
- Its Supabase variables (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `POSTGRES_*`, …) are scoped to **Production only** (Supabase integration naming, not the `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` names this app reads). It is unknown whether they point at `aqmyqezuoscpgqwtvblu` or at a live database.
- **Not done on purpose:** no `vercel link`, no env changes, no deploy, no migration. A Preview built now would either lack Supabase variables (fail closed) or have to reuse the Production database, which is not acceptable without owner approval. A dedicated staging Supabase project is required first.
- Supabase CLI could not be obtained via `npx` (not installable that way) and no Supabase login exists on this machine.

## Supabase staging + Vercel Preview verification (2026-11-09, owner-authorized)

Project `aqmyqezuoscpgqwtvblu` ("Hoooplaaa", ap-southeast-1, PG 17.11) was designated **staging** by the owner. The Supabase CLI labels it `production`; the owner confirmed in chat before any schema change. Treat it as the staging database; do not reuse it for live customers without a separate decision.

### Gate 15 — cloud state inspected (read-only): PASS
- Before: no public tables/policies/buckets, `auth.users` = 0, no `supabase_migrations` history, only Supabase's default `rls_auto_enable()` helper. Empty, so no conflict with repo migrations.
### Gate 16 — migrations applied: PASS
- `supabase db push --remote --yes` applied, in order: `20261108000000`, `20261109000000`, `20261110000000`. History table lists exactly those three.
- Post-state: 17 public tables, RLS on for all, 29 policies, private bucket `order-assets`, `allow_simulated_payments=false`, calendar policy `PROVISIONAL_UNAPPROVED` (Asia/Dhaka, Fri/Sat).
- `settle_order_payment_paid`, `convert_quote_to_active_order`, `claim_guest_quote`, `add_business_days`, `is_business_day`: EXECUTE for `service_role` only; `search_path=public, pg_temp`. `get_auth_role/get_auth_org_id` stay callable by clients by design.
- anon/authenticated hold no INSERT/UPDATE/DELETE on quotes, orders, payments, payment_events, audit_logs, quote_claims, platform_flags; no SELECT on quote_claims.
### Gate 17 — live negative tests (anon key vs cloud): PASS 18/18 (partial coverage)
- anon denied (401/42501): read quote_claims, read quotes, insert orders/payments/payment_events/audit_logs/quotes, EXECUTE of the three privileged RPCs with full signatures. service_role control calls reach each RPC (P0001 app errors, not permission errors), so signatures were valid.
- Storage: anon list of `order-assets` empty, public URL not served, anon upload rejected by RLS.
- NOT yet covered: authenticated-customer cross-tenant tests (needs real test users), Auth signup/session/logout flow, finance/admin role flows. Email provider only; `disable_signup=false`, `mailer_autoconfirm=false`.
### Gate 18 — Vercel Preview: PASS (protected)
- Project `notrealengine/hoooplaaa`; Preview `hoooplaaa-7orwxynl1-notrealengine.vercel.app` from branch `fix/test-bridge-isolation`. Deployment Protection = Vercel Authentication (unauthenticated request -> 302). No `--prod` deploy was made.
- Existing Production+Preview variables (hidden values) were NOT edited. Branch-scoped Preview overrides were added for `fix/test-bridge-isolation`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `APP_ENV=staging`, `PAYMENT_MODE=sandbox`, `NEXT_PUBLIC_PAYMENT_MODE=sandbox`, `SSLCOMMERZ_IS_SANDBOX=true`. `SUPABASE_TEST_BRIDGE` is unset.
- Incident (self-inflicted, fixed): while probing CLI flags I briefly overwrote the branch-scoped `NEXT_PUBLIC_SUPABASE_ANON_KEY` with a dummy value; it was re-set to the real key before the deploy.
- Headers on the Preview: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `/api` `Cache-Control: no-store, private`.
### Gate 19 — remote browser journey: PARTIAL
Run with curl through `vercel curl` (not a browser), against the Preview + cloud DB:
- Guest `POST /api/quote` (same-origin) -> 200, `Set-Cookie: hq_gc_*; Path=/api; Max-Age=1800; Secure; HttpOnly; SameSite=strict`; no claim token in the body.
- Cross-origin POST -> 403. GET without cookie -> 404. GET with cookie -> 200.
- DB: 1 quote, 1 `quote_claims` row with 64-hex SHA-256 hash, 0 plaintext tokens in `payload_json`.
- NOT done: configurator UI, checkout, manual-MFS submit, finance approval, SLA start, order tracking in a real browser; blocked on test accounts (see below). One probe quote (`QUO-MW99HHOB-D28AC8`) remains in staging.
### Gate 20 — SSLCOMMERZ sandbox: BLOCKED
- No verified sandbox store credentials. Existing Vercel values are hidden/unknown and were not touched.

### Remaining owner actions
1. Decide whether test users may be created in this Supabase project (signup is currently open), or provide a seed plan. Needed for customer/finance/admin cloud tests.
2. Provide SSLCOMMERZ sandbox store id/password directly in the Vercel dashboard (Preview, branch `fix/test-bridge-isolation`).
3. Weekend/holiday policy and `BUSINESS_CALENDAR_APPROVED`.
4. Decide whether this project stays "staging" or a separate production project is created before launch.
5. Consider turning off open signup on staging until the role-seeding plan exists.

### Staging test users and authenticated cloud journey (2026-11-09, owner-authorized)
Five staging users were created through the Supabase Admin API (confirmed email, random passwords generated at creation, stored outside the repo): customer A, customer B (separate orgs), finance, engineer, admin, all `staging-*@example.com`, with `user_profiles` rows. Credentials are NOT in Git, docs or chat. They are fixtures for staging only; rotate or delete them before any real-customer use.

**Direct PostgREST/Auth/Storage as authenticated roles (cloud): 41/41 effective pass** (a first run showed 6 failures caused by patching a non-existent `status` column; re-run with real columns `order_status`/`financial_status`/`payment_status` passed 18/18):
- all 5 logins succeed; wrong password rejected; token rejected after logout;
- customer A sees only own profile/org, cannot read B's profile, cannot self-promote to admin, cannot move into B's org;
- customer, finance and admin: direct INSERT (orders, payments, payment_events, audit_logs, quotes) 403; direct PATCH/DELETE of orders and payments 403; EXECUTE of the 3 privileged RPCs 403; customer cannot read quote_claims;
- Storage: no client policies on `storage.objects`, customer list is empty, client uploads (own or B's org path) rejected by RLS; uploads must be server-mediated.

**Application journey on the protected Preview against the cloud DB: 28/29 steps pass, the 1 miss is a test-script field name (verified in DB):**
- login via `/api/auth/session` for customer A/B, finance, engineer; wrong password 401;
- A creates a quote (no claim token in response); B gets 403 reading it and 403 checking it out; A and staff can read it;
- A initiates `manual_mfs` checkout; a duplicate checkout returns the same order; B cannot attach a reference (403);
- finance approval before a reference exists -> 422; after A submits the reference: no auth 401, customer 403, engineer 403, finance 200 (a `verifiedByStaffId` in the body naming customer A was ignored); replay -> 422;
- DB: `financial_status=paid`, exactly 1 payment `verified` with `verified_by_finance_id` = the finance user, 1 `payment_events` row, 3 `audit_logs` rows, `sla_started_at` NULL while intake was incomplete;
- intake: B denied (403), password-in-intake rejected (400), unauthenticated 401, A submits -> 200; B cannot read it; engineer and admin can;
- after intake the order is `ready_for_fulfillment`, `intake_status=completed`, `sla_started_at=2026-11-09 13:06:31Z` (Mon 19:06 Asia/Dhaka, after the 17:00 cutoff) and `sla_deadline_at=2026-11-12 03:00Z` (Thu 09:00 Dhaka). That is consistent with the provisional policy (Fri/Sat weekend, 09:00–17:00); the owner has not approved it.

Method: HTTP via `vercel curl` against the protected Preview, not a real browser. Gate 19 is therefore upgraded to "API journey verified remotely"; the visual configurator/checkout/dashboard UI has not been exercised in a browser against the Preview.

Residual risks / open items
1. Signup is open on this Supabase project (`disable_signup=false`) and the project is labelled "production" by Supabase. Close signup or move to a dedicated staging project before inviting anyone.
2. Staging data left behind: 5 test users, 3 orgs, 2 quotes (one guest probe), 1 paid order with intake.
3. SSLCOMMERZ sandbox still unverified (no sandbox credentials supplied).
4. Weekend/holiday policy and `BUSINESS_CALENDAR_APPROVED` still need the owner's decision.
5. Browser UI journey, order file upload through the server, engineer fulfillment/delivery and the customer-acceptance step are not yet exercised remotely.
