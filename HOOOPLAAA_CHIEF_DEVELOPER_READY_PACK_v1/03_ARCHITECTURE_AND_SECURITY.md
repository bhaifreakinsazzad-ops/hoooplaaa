# 03 — System Architecture, Integrations, Security

## Recommended architecture (subject to setup verification)
- **Web:** Next.js App Router, TypeScript strict mode, React, Tailwind CSS, accessible headless components, selected UI kit. Separate server-rendered public content from interactive client-side configurator.
- **Server:** Next.js Route Handlers / Server Actions backed by a centralized domain service layer (catalog, eligibility, quote, checkout, payment, order, files, staff). Treat every action/handler as public network input, enforce auth and authorization for all mutations.
- **Database:** Supabase Postgres (relational, with migrations), Supabase Auth, Supabase Storage private buckets. Use Postgres transactions / RPC as appropriate for atomic quote-to-order/payout-free ledger transitions.
- **Hosting:** Vercel, environments `local → preview/staging → production`; isolated configs and least-privilege secrets.
- **Gateway:** payment adapter, initial candidate SSLCOMMERZ **if the company has merchant approval**; sandbox first, validate IPN and payment API response/amount on server. Manual MFS/bank transfer *submission* is a fallback that still needs a finance verifier. bKash direct API can be considered only after genuine merchant documentation/credentials/approval.
- **Communications:** transactional email provider as configurable adapter (provider account and sending domain need verification). WhatsApp/SMS are optional later, subject to business-initiated messaging policies/credits.
- **Async jobs:** use a durable job/queue solution once needed; provider events processed idempotently; keep MVP simple with audited retry behavior.
- **Observability:** structured logs with correlation IDs, error tracking, performance and audit trail; no secret/user-content logging by default.

## High-level interaction path
Browser → Public/Client/Admin UI → Authorized domain actions / API → Supabase with RLS → payment/notification adapters → append-only payment events and job/audit records → portal timeline.

## Roles and tenant boundary
`customer`, `staff`, `fulfillment`, `finance`, `admin`, `super_admin`.
Customers only see resources associated with businesses they own/are explicitly members of. Staff only see assigned work and least necessary business contact data. Finance can validate payment and refund status but cannot change role policy or pricing without authorized workflow. Admin manages approved catalog, fulfillment and content. Super Admin assignment is server-controlled and logged. **Never trust editable user_metadata for roles.**

## Mandatory controls
1. **Server-authoritative pricing:** browser can display estimates but creates zero authoritative totals; final quote calculated with server-side product status, effective price version, add-on compatibility, discounts and optional taxes/fees.
2. **Immutable snapshots:** order lines copy prices, currency, billing interval, scope, exclusions, SLA/policy version and customer accepted terms. Catalog edits cannot retroactively rewrite orders.
3. **Payment validity:** provider session created server-side; IPN/webhook is never treated as paid until verified against provider validation endpoint, intended amount, currency, transaction ID and risk status. Idempotency keys per order/event. Never mark as paid solely from redirect query params or screenshots.
4. **RLS + grants:** every exposed customer-sensitive table needs GRANT discipline and explicit RLS policies per operation; test authenticated client A cannot access B even via direct API. Admin privileges enforced server-side AND DB-side; avoid overprivileged queries, public `security definer` functions and service-role tokens in frontend bundles.
5. **Private uploads:** allowed MIME types and maximum sizes, malware scan where feasible, per-order private storage paths, signed time-limited access after authorization; prohibit executable HTML/JS content delivery from trusted origin.
6. **Account access:** official delegated/partner invitations only; no plaintext password collection. Keep access-grant reference/status, never secrets in database row/comments or AI prompt.
7. **Privacy & legal:** consent data, retention policy, subject access/deletion workflow, reasonable log retention, backups and tested restore. Sensitive banking/identity info collected only if required through approved provider.
8. **Abuse controls:** form validation (schema), CSRF/origin safeguards, rate limits, captcha/anti-bot on public audit/checkout forms, spam moderation, input sanitization where rendering rich content, request size caps.
9. **QA/security CI:** typecheck, lint, tests, migration review and security checks before deploy. Pin dependency versions and keep lockfiles. Document secrets and rotation without revealing values.
10. **Accessibility and SEO:** semantic HTML, structured metadata, sitemap, robots, server-rendered indexable service pages; authenticated client/admin routes protected and non-indexed.

## State semantics / repeatability
Webhook and payment reconciliation may arrive in either order, duplicated or after return page closes. All cases must produce ONE reconciled attempt and ONE paid state transition (or hold for review). Failed/pending/risky payment must not provision an entitlement. Order creation is transactional; avoid anonymous order enumeration via public ID.

## Official documentation reviewed for architecture (2026-11-08)
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Authentication and Authorization: https://nextjs.org/docs/app/guides/authentication
- Supabase Next.js guide: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Auth SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- SSLCOMMERZ official integration guide: https://sslcommerz.com/integration-document/

**Note:** Documentation and versions change. Coding agent must pin and verify versions at implementation time. The project has not been connected to actual vendor accounts or tested in this planning stage.
