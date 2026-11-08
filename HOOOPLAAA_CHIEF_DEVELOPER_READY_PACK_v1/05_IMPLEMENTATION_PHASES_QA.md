# 05 — Engineering Work Breakdown, Tests, Launch Gates

## Workstreams and dependency order

### Phase 0 — Repository & verified scope
- Inspect actual repository first if supplied; do not overwrite a legitimate existing implementation.
- Select Node, package manager and pinned Next.js/Supabase versions from **current official docs**; set TypeScript strict, lint, formatter, tests and `.env.example` without secrets.
- Import structured KB and service registry; create source-aware, versioned admin catalog. Confirm `checkout_enabled=false` initially.
- Approve the final public brand wordmark/logo use and first launch SKU sign-off as separate business decisions.
**Exit:** running local dev app, health endpoint, CI, DB connection only in test env, blank canonical catalog, no exposed secrets.

### Phase 1 — Visual system + discovery
- Produce three genuinely distinct homepage/configurator visual directions for selection.
- Implement responsive foundation, typography, navigation, approved service pages, eligibility notices and FAQ.
- Build category filters, search, deterministic goal-based recommendation and mobile speed optimizations.
**Exit:** visual design approved, WCAG keyboard basics, public page lighthouse baseline, no unsupported public offers.

### Phase 2 — Configurator and secure server pricing
- Rule-driven forms, saved drafts, conditional eligibility gates, multi-item/add-on selections and price breakdown.
- Server pricing engine with version snapshots and scope/compatibility validation; short-lived signed/DB quote references.
- Automatic fallback to structured custom quote when feasibility/price isn't deterministic.
**Exit:** test suites for all 7 confirmed fixed prices, Google ineligible, Pixel no website, invalid addons, tampered price, expired quote and bundle double charging.

### Phase 3 — Auth, business workspace, order intake
- Verified login / magic link, customer business profiles with tenant membership and least privilege.
- Quote approval, order transaction, requirement form, private uploads and access instructions.
- Admin order assignment, statuses, timeline, notifications, files and QA/handover.
**Exit:** full sandbox order flows for two separate customers, cross-tenant access denied, role behavior tested.

### Phase 4 — Payment & reconciliation
- Integrate ONE provider with actual approved merchant sandbox account and merchant rules; validate callback, IPN/webhook, transaction status/amount and risk flags.
- Alternative manual bank/MFS reference submission with explicit pending verification, finance review and audit trail.
- Test duplicate notifications, out-of-order callbacks, retries, wrong totals, failed/abandoned payments, risk holds, refunds and concurrency.
**Exit:** E2E confirmed payment → precisely one order → intake, no service activation on unverified payment. **Production switch remains off until approved live merchant credentials and provider sign-off.**

### Phase 5 — Launch hardening
- Admin catalog release controls, FAQs/policies, error monitoring, audit logs, backup/restore test, accessibility audit, performance checks, security review.
- Full UAT on mobile/desktop and degraded networks, RLS negative tests, recovery simulation and incident playbook.
**Exit:** sign-off checklist complete; can publish only approved SKUs; staging demonstration accepted; domain/DNS/payment verified.

### Phase 6 — Advanced service families
- Only after pilot proof: subscriptions, SaaS workspace provisioning, email/WhatsApp automation, advanced price rules, affiliate/referral, custom quotation workflows and deeper audit report automation. Do not pre-build speculative integrations at the cost of core order reliability.

## Deterministic P0 test matrix (minimum)
1. Visitor chooses Meta only → ৳1,500 one time.
2. Visitor chooses Google only with eligible local business → ৳1,500 subject to profile eligibility; Google verification isn't guaranteed.
3. Pure online-only chooses Google → cannot complete Google offer through unmodified standard checkout.
4. LinkedIn Company Page → ৳1,500; client must be suitable for page admin ownership.
5. 3-Platform eligible bundle → ৳3,000 exactly, not ৳4,500 or ৳7,500.
6. 3-Platform ineligible Google → scope intervention; no false 3-platform promise and no auto charge for altered scope.
7. Meta + Static Creative → ৳2,490 when the combination is explicitly allowed and excludes external charges.
8. Pixel chosen without compatible website/property → blocked/quote route; not instant false-ready fulfillment.
9. Manipulate browser JSON `total=1` → server ignores and re-derives legitimate total.
10. Checkout retries / duplicate provider IPNs → exactly one paid reconciliation and one order, unique event IDs.
11. Payment success redirect forged but provider not verified → NOT paid.
12. Finance manually verifies false screenshot/reference → NOT paid until statement/provider proof.
13. Two customer accounts attempt each other's files/orders → forbidden at UI, API and database policies.
14. Staff changes own role through frontend metadata → forbidden.
15. User uploads executable or invalid file → rejected; stored files private.
16. Changing published price later does NOT modify an old quote/order snapshot.
17. Unpublished/proposed SKU attempted via direct endpoint → quote/payment denied.
18. Blocked personalized gateway or card SKU attempted → denied server-side regardless of UI.
19. Paid order with missing client access/requirements → remains waiting; SLA not started.
20. Free audit submission cannot auto-generate a fabricated performance report based on inaccessible analytics.
21. Full keyboard-only and reduced-motion tests on configurator and payment states.
22. First-load mobile UX on slow Bangladesh connection remains usable; measured CWV budgets set before release.

## Roles / permissions acceptance
- Customer CRUD restricted to owned/authorized business.
- Fulfillment assigned jobs only; finance payment ledger but not privileges/catalog pricing.
- Admin can approve/publish catalog when policy permits; Super Admin can grant roles with logged approvals.
- No public unprotected file URLs or service role secret leakage.

## KPI / performance measurement
Baseline performance budgets: LCP ≤2.5s and CLS ≤0.1 at the 75th percentile for target users (targets, not achieved measurements). Checkout price derivation should be deterministic, audited and tested; prioritize reliability and accurate eligibility over animation effects. Track funnel metrics without inventing actual conversions.

## Deliverables per phase required from coding agent
- Working code committed, precise changed-files list, migration instructions, fixture data and demo credentials that contain no real secrets.
- Test output and screenshot/video evidence for responsive UX, success/failure modes and role boundaries.
- Updated `README`, `.env.example`, deployment configuration and rollback notes.
- Explicit "implemented / mocked / needs credentials / blocked" list. No opaque declarations that a feature "works" without reproducible evidence.

## Hard release blockers
Unapproved public price/SKU; unverified merchant account; RLS/data leak; client permissions broken; failed payment mismatch/duplicate handling; invented provider access; missing terms/privacy/refund policy; unverified official domain/branding; no audit of sensitive file storage.
