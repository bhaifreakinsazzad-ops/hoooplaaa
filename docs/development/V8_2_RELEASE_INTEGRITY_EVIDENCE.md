# V8.2 — Release Integrity Evidence

**Classification: `LOCAL_VERIFIED_REMOTE_BLOCKED`** — production launch NOT authorized.

Branch `feature/platform-completion-and-hardening` (PR #7). Base commit `ac1bf70`.
The attached master directive file (`HOOOPLAAA_V8_2_GEMINI_CLAUDE_CROSS_AGENT_RELEASE_INTEGRITY_PROMPT_2026-11-09.md`) was **not present** in the repository or the workstation; this work executes the six critical repairs and verification requirements stated in the V8.2 directive message. The "26 acceptance gates" list could not be read and is therefore not individually enumerated.

All local results prove SQL/route logic on PGlite (real PostgreSQL 16 roles). They do **not** prove a deployed Supabase project.

## Repairs

| # | Defect | Fix | Where |
|---|--------|-----|-------|
| 1 | Delivery accepted any existing Storage path / any file | Delivery takes only a `deliverableFileId` looked up **within the order**; category must be `deliverable`; uploader must be admin/engineer; Storage bytes re-read and SHA-256 + size recomputed and compared. Raw `deliverablePath` is rejected. DB trigger `guard_order_file()` enforces category column, staff uploader for deliverables, `orders/<order>/<client_assets|deliverables>/` prefix, no `..`/control chars, private bucket, and immutability of binding/digest/category. | `src/app/api/admin/orders/route.ts`, migration `20261112000000_v8_2_release_integrity.sql` |
| 2 | `qaChecklistPassed: true` request flag counted as QA approval | New table `order_qa_reviews` (reviewer id + role, decision, checklist JSON, notes, `clock_timestamp()`, file id, file SHA-256). Trigger `guard_qa_review()` re-checks ownership, deliverable category, digest, staff reviewer, order in `qa_review`, every checklist item true for approval. Immutable (service_role has no UPDATE/DELETE; anon/authenticated no access). Delivery requires `qaReviewId` of the **latest** review, approved, for that file, newer than any revision request. `order_deliverables` rows must bind file + approved review (trigger). Entering `delivered` is refused by the orders trigger without such a binding. | migration, `admin/orders` (`qa_review` action), `QaDeliveryPanel.tsx` |
| 3 | Intake POST imported `rejectCrossOrigin` without calling it | Called first in intake, admin orders, finance verify, manual MFS, audit POST. Already present: quote, checkout initiate, files, accept, session POST/PATCH/DELETE. SSLCOMMERZ callback is deliberately exempt (server-to-server, carries no session, settlement only after S2S validation) — documented in the route. | routes listed |
| 4 | `saveOrder()` unconditional upsert could overwrite newer state | `orders.row_version` + BEFORE UPDATE trigger `guard_order_transition()` (bumps version on every write incl. settlement RPC; legal transition table; no paid→unpaid; paid only with a `verified` payment_event; intake/SLA/acceptance one-way; SLA only when paid+intake; identity/total immutable; `delivered` needs approved QA binding). `saveOrder` = insert for new rows, compare-and-swap `UPDATE … WHERE row_version = $read` for existing rows → `OrderConcurrencyError` (HTTP 409). `transitionOrder()` re-reads and re-validates on conflict. Delivery is one RPC `deliver_order_with_qa_approval()` (row lock, version check, deliverable insert, order update, audit) — service_role EXECUTE only, `search_path` pinned. | `persistent-db.ts`, migration, all order-writing routes |
| 5 | Download returned stored hash without recomputing | `readVerifiedFile()` recomputes SHA-256 (constant-time compare) and size on every download; missing → 410, corrupted/mismatched → 409 (+ `FILE_INTEGRITY_FAILURE` audit), oversized → 413. Upload: Content-Length / `File.size` checked before buffering (413), `upsert:false`, orphaned bytes removed if the metadata row is refused, safe storage names. SVG: must be a self-contained `<svg>` document; scripts, handlers, `javascript:`/`data:` (incl. `&#58;` encoding), foreignObject, entities/DOCTYPE, external href/CSS, `<style>` rejected. Downloads: `attachment` + RFC 5987 name, `nosniff`, `CSP: default-src 'none'; sandbox`, SVG served as `application/octet-stream`, `no-store`. | `files/route.ts`, `intake-and-files.ts`, `persistent-db.ts` |
| 6 | Customer-facing accuracy | Intake email = signed-in account email for customers (UUID fallback removed client- and server-side). Generic "post-sale detailed audit report" and "evidence pack is ready" removed; audit mention shown only when the purchased scope lists it. Customers see only delivered deliverable files; internal storage paths no longer returned or rendered. "7-day price guarantee" → "7-day quote validity period". Catalog (seven approved products, poisha prices) unchanged. | dashboard order page, `how-it-works`, deliverables/files routes |
| — | Incidental | `BUSINESS_HOLIDAYS` regex was `/^d{4}-d{2}-d{2}$/` (never matched); fixed. Admin UI no longer sends a fake `specialistId`. | `order-service.ts`, `admin/page.tsx` |

## Regression tests (new: `tests/v8-2-release-integrity.test.ts`, 37 tests)

Ownership 1.1–1.6 · persisted QA 2.1–2.7 · CSRF 3.1 (11 endpoints × Origin and Sec-Fetch-Site) and 3.2 · atomic transitions 4.1–4.8 (stale writer, missing version, settlement race, DB regression guards, accepted immutability, version bump by settlement RPC, concurrent acceptance, stale delivery rollback) · file integrity 5.1–5.8 (multipart round-trip of original bytes, corruption, same-size substitution, missing object, oversize, SVG, category paths, pre-delivery visibility) · customer accuracy 6.1–6.3 · holiday parsing · PostgREST denial.

Pre-existing tests that encoded the removed weak behaviour (delivery by flag, direct `saveDeliverable`, marking paid without settlement, jumping status by assignment) were ported to the real chain via `tests/helpers/delivery-fixtures.ts`.

## Verification (after the final source change)

Run sequentially on Windows 11, Node 22.14.0, local PGlite harness, after the last source change:

| Command | Exit | Result |
|---------|------|--------|
| `npm ci` | 0 | 429 packages added (npm audit reports 12 advisories: 8 moderate, 2 high, 2 critical — pre-existing, not addressed here) |
| `npm run typecheck` | 0 | no errors |
| `npm run lint` | 0 | no ESLint warnings or errors |
| `npm test` | 0 | 16 files, **166 / 166 tests passed** (37 new V8.2) |
| `npm run build` | 0 | production build succeeded |
| `npm run test:e2e` | 0 | Playwright **4 / 4 passed** (includes: delivery by flag alone → 422; persisted QA review → delivery → customer acceptance) |

## Cloud gates

| Gate | Status | Evidence |
|------|--------|----------|
| Isolated Supabase staging project | **BLOCKED** | `supabase projects list` (read-only, 2026-11-10) shows only `NotRealEngine` and `Hoooplaaa` (`aqmyqezuoscpgqwtvblu`, production-connected). Free-plan limit prevents a third project. Nothing was created. |
| V8.2 migration on staging | **BLOCKED** | no isolated project; NOT applied to `aqmyqezuoscpgqwtvblu` (directive forbids it) |
| Real-cloud registration / email | **BLOCKED** | no staging project; SMTP not configured |
| SSLCOMMERZ sandbox checkout | **BLOCKED** | no sandbox merchant credentials |
| Real-cloud QA / delivery / acceptance | **BLOCKED** | depends on staging project |
| Live merchant payments / Production changes | **NOT DONE** (by design) | owner approval required |

## Exact remaining owner actions

1. Provide an isolated staging Supabase project (upgrade plan, or pause/delete a project of your choice, or create one in the dashboard) and share its ref. Do not reuse `aqmyqezuoscpgqwtvblu`.
2. Point Vercel **Preview** `SUPABASE_URL` / keys / `POSTGRES_*` at that staging project (Production untouched); keep `SUPABASE_TEST_BRIDGE` off.
3. Apply all five migrations to staging (including `20261112000000_v8_2_release_integrity.sql`), create the private `order-assets` bucket, then run `scripts/staging/*` and the cloud negative tests.
4. Provide SSLCOMMERZ **sandbox** store id/password for Preview; configure SMTP for staging Auth email.
5. Confirm the business calendar (weekend days, holiday list) — policy remains `PROVISIONAL_UNAPPROVED`.
6. Decide whether QA approval must be four-eyes (reviewer ≠ uploader). Currently any admin/engineer may review; the reviewer identity is recorded.
7. Before applying the V8.2 migration to any database that already has orders: existing `order_deliverables` rows have no file/review binding and will not satisfy the new acceptance checks; legacy order rows start at `row_version = 0`.
8. Clean the synthetic fixtures still in `aqmyqezuoscpgqwtvblu` (see `V7_2R_CLAUDE_RELEASE_EVIDENCE.md`) before any real use.
