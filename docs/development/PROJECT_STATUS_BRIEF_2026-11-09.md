# HOOOPLAAA — Project status brief (2026-11-09)

Written when work was paused on request. It covers the condition the project was found in, everything done since, the exact state now, and how to resume. Evidence detail lives in `V7_2R_CLAUDE_RELEASE_EVIDENCE.md`. No credentials appear here.

**Bottom line:** the code is locally verified and secure by test. The cloud is *not* release-ready, because staging and Production share one Supabase project. **PR #4 and PR #5 have since been merged into `main` by the owner (`main` = `2ddf18b`; CI on `main` passed).** I did not touch Production configuration or deploy to Production, but `main` now carries the new registration code (see section 6, item 1).

---

## 1. Where the project started

- Next.js 15 + Supabase commerce platform, taken over from a previous agent's local commit `13b1255` ("V7.2"). Remote PR #2 had already been merged.
- Security and payment defects were present (see section 2). The unit/browser pipeline existed only partly (no ESLint installed).
- No Supabase CLI session, no Vercel access, no sandbox payment credentials.

## 2. Work done (chronological)

### A. V7.2R security and payment fixes (merged via PR #3, merge commit `e8ce915`)
Ten defects found and fixed, all with tests:
1. Guest quote secret was in the checkout URL, `localStorage` and plaintext in the DB. Now an HttpOnly, Secure, SameSite=Strict, `Path=/api` cookie. Only a SHA-256 hash is stored (`quote_claims`, service-role only). 30 minutes, single use, origin/CSRF check.
2. RLS let any client read every guest quote (`organization_id IS NULL`). Replaced.
3. JWT-claim checks in SQL, definer functions without a pinned `search_path`, and finance/admin bypass through helper functions. All removed or pinned. Privileged RPCs are EXECUTE-granted to `service_role` only.
4. Payment callback verification marked the payment verified *before* settlement, so a failed settle could not be retried. Verification is now read-only and settlement is one atomic RPC.
5. Finance could approve a gateway attempt, and the manual-MFS submit could relabel a payment. Strict rules now apply in both the API and SQL.
6. Checkout idempotency key used `Date.now()`. Now stable per order/method with partial unique indexes.
7. Order-number collisions (a real production bug). Now hash-based.
8. SLA calendar was hard-coded Sat/Sun UTC. Now a configurable Asia/Dhaka policy, parity-tested between SQL and TS. **Policy is PROVISIONAL (Fri/Sat weekend, 09:00–17:00); the owner has not approved it.**
9. The local test bridge faked 403s and ran as superuser. Now real roles and all migrations.
10. `lint` script had no ESLint. ESLint added, with a CI step.

New migration `20261110000000_v7_2r_security_hardening.sql`. Docs: `CLAUDE.md` (project rules), progress and evidence files.

### B. Test-code isolation (PR #4, **merged** by the owner, merge commit `53e216a`)
The PGlite test bridge is lazy-loaded and refuses to run on Vercel or with `APP_ENV` staging/production. Residual note: the bridge chunk still exists in the server build, unreachable at runtime.

### C. Server-side registration (PR #5, **merged** by the owner, merge commit `2ddf18b`; last feature commit `96df117`)
Public Supabase signup was disabled on the project, which broke customer self-registration because it used the anon-key `auth.signUp`. Replaced with the Admin API (`auth.admin.createUser`) plus:
- Role is always `customer`. Hostile body fields (`role`, `organizationId`, `app_metadata`) are ignored.
- The auth user is deleted if profile creation fails (no orphan logins).
- **Email auto-confirm fails closed (503)** unless there is a non-empty allowlist, `APP_ENV=staging`, and the Supabase project ref equals `REGISTRATION_STAGING_PROJECT_REF`. Production ignores the flag entirely.
- Strict same-origin + JSON check for registration; login is CSRF-checked; malformed bodies are 400.
- Shared database rate limit (per client and per email). If the limiter is down the request is refused. New migration `20261111000000_registration_rate_limit.sql`.
- Checkout page handles the "confirm your email" response; password minimum is 10.

Local verification on `96df117`: tsc clean, ESLint 0 errors, Vitest 98/98, build OK, Playwright 4/4. CI for that SHA had been started; confirm its result on GitHub.

### D. Cloud work on Supabase project `aqmyqezuoscpgqwtvblu` ("Hoooplaaa")
- Found empty (no tables/policies/buckets/users). Applied all four migrations; history table lists them.
- Verified live: RLS on all public tables; privileged RPCs callable by `service_role` only; clients cannot write financial tables; private `order-assets` bucket with no client policies.
- **Direct tests:** anon 18/18 and authenticated-role tests (cross-tenant, no self-promotion, no direct writes, RPC denial, storage denial) all passed.
- **Application journey on a protected Vercel Preview, against the real DB:** quote -> checkout -> manual payment reference -> finance approval -> intake -> SLA start. Verified in the DB: one verified payment attributed to the finance user, one replay event, audit rows, SLA started only after paid + intake complete (deadline computed under the provisional calendar). Cross-customer access was denied at every step; replayed approval refused.
- Guest handoff verified remotely: cookie flags, 403 on cross-origin, 404 without the cookie, DB holds only a 64-hex hash.
- Public signup **disabled** (`auth.enable_signup=false`), verified (`422 signup_disabled`).
- Bundle/response scan: the service-role key is absent from all pages, client assets and responses checked.

### E. Vercel (`notrealengine/hoooplaaa`)
Linked locally. Preview deployments only; **no production deploy by me.** Existing Production variables were never edited.

## 3. Critical finding (release-blocking)

**Production and "staging" share one Supabase project.** Production's `SUPABASE_URL` and `POSTGRES_HOST` point at `aqmyqezuoscpgqwtvblu`, and so do my Preview variables. Branch-scoped Vercel variables give no data isolation. So the migrations, the signup lockdown and all test data live in a database Production is wired to. A separate project could not be created: Supabase's free limit (2 projects) is reached (`Hoooplaaa`, `NotRealEngine`). On the owner's later instruction, work continued on this shared project.

Test data currently in it (all synthetic, mine): 7 auth users (5 staging fixtures incl. admin/finance/engineer, plus 2 self-registered), 3 quotes, 1 order, 1 payment, plus audit rows. The fixtures hold privileged roles, so **delete them before any real use.**

## 4. Open issues found but NOT fixed

| # | Issue | Evidence |
|---|---|---|
| 1 | **Logout does not revoke the session.** `DELETE /api/auth/session` clears cookies and calls `signOut()` on a shared anon client, so the bearer token stays valid until expiry. It also has no CSRF check. | Code read; my remote check for it was written but not run. Fix: call the admin `signOut(token)` and add `rejectCrossOrigin`. |
| 2 | **Order state machine has no guards.** `assignStaff`/`submitForQA`/`deliverOrder`/`acceptHandover` in `order-service.ts` do not check payment, intake or prior state. Staff could deliver an unpaid order. | Code read; not yet exercised remotely. |
| 3 | **Customers cannot accept a handover.** `accept` exists only on the staff-only `/api/admin/orders`; the dashboard text mentions accepting but has no button or endpoint. | Code read. |
| 4 | Rate limit assumes the client IP from `x-forwarded-for`; behind other proxies verify it. The in-memory pre-check is per instance only. | Design note. |
| 5 | Email delivery is not configured. Without auto-confirm, new customers cannot verify and so cannot sign in. | Owner decision. |
| 6 | Browser UI journey (Playwright against cloud), engineer fulfilment/delivery remotely, SSLCOMMERZ sandbox: not done. No sandbox credentials. | — |

## 5. Current state at pause

- **Git:** `origin/main` = `2ddf18b` (PR #3, #4, #5 all merged; CI success). This brief is on branch `docs/status-brief`. The feature branches were auto-deleted on merge; my later push accidentally recreated `fix/server-side-registration` (stale, based on pre-merge history), which I removed. The local working tree has **untracked `scripts/staging/`** (reusable verification tools: `lib.mjs`, `seed-users.mjs`, `negative-tests.mjs`, `registration-e2e.mjs`). These are written but **not yet run or committed**; review before committing. `.anchor/` is untracked tooling; do not commit it.
- **Supabase:** four migrations applied; signup disabled; test data as in section 3.
- **Vercel:** 13 Preview deployments exist (some pre-date this work). The newest, `hoooplaaa-4e0t0lf4i-notrealengine.vercel.app`, is `96df117` with per-deployment registration variables (auto-confirm, an 8-address `example.com` allowlist, project-ref binding). No project-level registration variables are set. All Previews are behind Vercel Authentication. Older Previews were built with other settings: delete the ones you do not need.
- **Docs:** evidence file is current through the isolation incident; this brief supersedes the summary parts.

## 6. What the owner needs to decide or do

0. **Production consequence of the merge (check first):** `main` now contains fail-closed registration. Production has no `REGISTRATION_*` variables, so registration requires email confirmation. With no email delivery configured and public Supabase signup disabled, a new customer in Production can register (202) but cannot sign in. The shared database already has the rate-limit migration, so registration does not fail closed on a missing limiter. Verify Production behaviour and decide email delivery before enabling it for customers.

1. **Isolation:** create a separate Supabase project (upgrade, free a slot, or create in the dashboard), apply all four migrations, point Preview at it, and set `PRODUCTION_SUPABASE_PROJECT_REF`. Until then treat the shared project as non-production-ready.
2. **Clean up** the synthetic data and the privileged fixture users in the shared project.
3. **Calendar policy:** confirm weekend/holidays; set `BUSINESS_CALENDAR_APPROVED` and update `business_calendar_policy`.
4. **Email:** configure delivery and email confirmation, or accept unverified addresses on staging only.
5. **SSLCOMMERZ sandbox credentials:** put them in the Vercel dashboard (never in chat) so gate 20 can be tested.
6. **Do not treat merged code or a READY Vercel status as production readiness.** Check whether the merge triggered a Production deployment.
7. Approve or reject the fixes for issues 1–3 in section 4.

## 7. How to resume

Tools: Supabase CLI 3.0.0 at `C:\Users\sazza\AppData\Local\Temp\claude\85ba2ff761bc19ad\0ea80b66-6bac-45a1-8e48-7728d03550e6\scratchpad\supabase-cli\supabase.exe` (temp folder; re-download from the supabase/cli releases if it is gone; `supabase login` was completed). Vercel: `npx vercel@65.12.1 --scope notrealengine`. Synthetic user credentials were generated into scratchpad JSON files outside the repo; regenerate with `scripts/staging/seed-users.mjs`.

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
# cloud checks (set SUPABASE_BIN, PREVIEW_URL):
node scripts/staging/seed-users.mjs
node scripts/staging/negative-tests.mjs
node scripts/staging/registration-e2e.mjs
```

Next engineering steps in order: (1) fix logout revocation + CSRF, (2) add state-machine guards and a customer accept endpoint with tests, (3) run the staging scripts and commit them, (4) re-run the full pipeline and confirm CI and Vercel SHA, (5) clean test data, then restore strict config (remove auto-confirm and allowlist, keep signup disabled).

## 8. Project rules to keep (from `CLAUDE.md`)

Guest quote capability = HttpOnly cookie, hash only in `quote_claims`. Privileged RPCs `service_role` only; authorisation happens in the Next.js API. Clients cannot write quotes, orders, payments, payment events or audit logs. Settlement is one atomic RPC; callback verification is read-only. Simulated payments are blocked in the DB unless `platform_flags.allow_simulated_payments`. SLA starts only when paid and intake complete. `SUPABASE_TEST_BRIDGE` must be off in Preview and Production.

## 9. Classification

`LOCAL_VERIFIED`, cloud partially verified on a shared project, **NOT production-ready.**
