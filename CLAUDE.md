# HOOOPLAAA platform — Claude Code project rules

Next.js 15 + Supabase (PostgreSQL/Auth/Storage) commerce platform. Branch `feature/phase-6-10-production-platform`, PR #2.
Do not rebuild; make narrow, tested changes. Never commit secrets or `.env.local`.

## Commands
- `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` (Vitest, PGlite) · `npm run build` · `npm run test:e2e` (Playwright, builds must exist)
- Local tests run with `SUPABASE_TEST_BRIDGE=true` (PGlite + real PG roles). That proves SQL/route logic only — NOT a deployed Supabase project.

## Security invariants (do not weaken)
- Guest quote capability = HttpOnly, SameSite=Strict, `Path=/api` cookie; only SHA-256 hash stored in `quote_claims` (service_role only), 30 min, single use. Never in URL/body/localStorage/logs. Quote id alone never authorises anything.
- Privileged RPCs (`settle_order_payment_paid`, `convert_quote_to_active_order`, `claim_guest_quote`) are EXECUTE-granted to `service_role` only; authorisation of finance/admin happens in the Next.js API. No `request.jwt.claim.*` identity checks in SQL. All SECURITY DEFINER functions pin `search_path`.
- Clients (anon/authenticated) cannot write quotes/orders/payments/payment_events/audit_logs.
- Settlement is one atomic RPC (evidence + replay event + payment + order + SLA + audit). `verifyCallback` is read-only. Manual approval only for a `pending_verification` `manual_mfs` attempt with a submitted reference. Simulated payments are blocked in the DB unless `platform_flags.allow_simulated_payments` (false by default; true only in the PGlite harness).
- SLA starts only when paid AND intake complete; business calendar = Asia/Dhaka, policy is PROVISIONAL_UNAPPROVED (owner must confirm weekend/holidays).
- `SUPABASE_TEST_BRIDGE` must be off in Preview/Production.

## State
See `docs/development/V7_2R_CLAUDE_PROGRESS.md` and `docs/development/V7_2R_CLAUDE_RELEASE_EVIDENCE.md`.
