# V8.3 — Cross-Agent Handoff & Release Gate Evidence

**Classification: `LOCAL_VERIFIED_REMOTE_BLOCKED`.** Production launch is NOT authorized. Production is currently **non-functional for every database-backed endpoint**, because of its configuration (see §2).

The attached handoff file (`HOOOPLAAA_V8_3_CROSS_AGENT_HANDOFF_PR_CLOUD_RELEASE_GATE_2026-11-10.md`) was **not present** in the repository or on the workstation. Its "26 acceptance gates" could not be read, so this report covers the seven priorities in the V8.3 directive message.

## 1. Repository and PR state (Priority 1)

- The V8.2 commits `2f86506`, `3ee08df` and `79aaf66` are preserved. Local and `origin/feature/platform-completion-and-hardening` were both at `79aaf66611d88f432b0e37f1d6638ec84f19b085`.
- **V8.2 was already published and merged by the owner as PR #8.** The merge commit on `main` is `ff5adce068ba98c47a34454b841d31395f5d4215`, and its tree is identical to `79aaf66`. A new PR for V8.2 would be a duplicate, so none was created.
- The V8.3 work below is on a new branch, `fix/v8-3-release-gate`, cut from `ff5adce`. Its PR is listed in §8.

## 2. Production incident found and contained

| Finding | Evidence |
|---|---|
| Merging PR #8 deployed V8.2 code to Production (`app.hoooplaaa.space`, deployment `dpl_ARRaJXx7MvDSeE79NaMb2sxVZgBX`, commit `ff5adce`). | `vercel inspect`, GitHub commit status |
| The Production database (`aqmyqezuoscpgqwtvblu`) does **not** have migration `20261112000000`. | `supabase migration list --linked` (read-only): the remote column is empty for `20261112000000` |
| `GET /api/orders/<id>/intake` on Production returns **HTTP 500**. | Read-only curl probe |
| **Root cause:** the Production function throws `SupabaseConfigurationError: SUPABASE_SERVICE_ROLE_KEY is required…`. The variable exists but its value is empty or a placeholder. `NODE_ENV` is also set to `development` in Production/Preview, and Vercel overrides it. | Vercel runtime log, 2026-11-09T18:43Z |
| **Action (owner-approved in chat): Production was rolled back** to `dpl_HweDPMs8FG8xrmSSPF9zZj3wUUFF` (`hoooplaaa-cvhjw09kn`, commit `d9013ef`, pre-V8.2). | `vercel rollback` succeeded |

Correction to the first diagnosis: the 500 happens **before any SQL runs**, so it was not caused by V8.2. The rollback did not restore service. It does keep Production on code that matches the unmigrated Production schema. If a valid service-role key were added while V8.2 code was live without the migration, every order read would fail on `orders.row_version`. While rolled back, Vercel will not auto-promote new `main` deploys until someone runs `vercel promote`.

**Safe order for the owner:**
1. Apply the migrations to the Production database (after staging proof).
2. Set a real `SUPABASE_SERVICE_ROLE_KEY` and remove `NODE_ENV=development`.
3. Promote the current `main` deployment.

## 3. Migration security and compatibility review (Priority 2)

New test file: `tests/v8-3-migration-compatibility.test.ts`. It builds a **fresh** PostgreSQL, applies migrations 1–4, seeds pre-V8.2-shaped data, then applies V8.2+.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Existing orders compatible with `row_version` | PASS | Legacy orders start at `row_version = 0`, keep their status, and bump to 1 on the next write |
| 2 | Existing deliverables handled safely | PASS | Legacy rows are kept unchanged and unbound (`qa_review_id`/`deliverable_file_id` NULL). The acceptance API will not accept them (it requires a binding), so legacy delivered orders need a fresh QA review before customer acceptance |
| 3 | No fabricated QA approvals | PASS | `order_qa_reviews` holds 0 rows after the upgrade; the migration inserts none |
| 4 | Settlement works with the guards | PASS | V8.2 suite 4.3 and 4.6, plus `e2e-workflow` (settlement RPC → paid, version bump, SLA after intake) |
| 5 | Privileged RPCs least-privilege | **FIXED** | The V8.2 trigger functions and `qa_required_checklist_items()` were EXECUTE-granted to anon/authenticated through Supabase default privileges. New migration `20261113000000_v8_3_least_privilege_functions.sql` revokes them. The test asserts that only `get_auth_org_id` and `get_auth_role` (RLS helpers) remain client-executable, and that every SECURITY DEFINER function pins `search_path` |
| 6 | RLS on financial / QA / customer records | PASS | V8.2 2.4, 7.2; existing v7-2r SQL suite |
| 7 | Concurrent updates cannot overwrite newer state | PASS | V8.2 4.1, 4.2, 4.3, 4.7 |
| 8 | Atomic delivery cannot partially update | PASS | V8.2 2.7 (rollback after failed trigger), 4.8 (stale version → no deliverable row) |
| 9 | Staff cannot execute customer acceptance | PASS | v8-1 tests 11 and 12 |
| 10 | Cross-tenant files cannot be deliverables | PASS | V8.2 1.1, 1.2, 1.5 |
| — | Idempotent re-application | PASS | V8.2+ migrations re-applied without error |
| — | Upgrade guards bind legacy rows | PASS | paid→unpaid, paid-without-evidence and file re-categorisation are refused on legacy rows |

## 4. Dependency audit (Priority 3)

Before: 12 advisories (2 critical, 2 high, 8 moderate). After: **6 moderate, 0 high, 0 critical**.

| Package | Severity | Path | Exposure | Action |
|---|---|---|---|---|
| `vitest`, `tinypool`, `@vitest/mocker` | critical | direct devDependency | dev/test only, not in the production bundle | upgraded `vitest` 3.2.7 → **4.1.12** (no breaking changes affected the suite; `tinypool` is gone from the tree) |
| `postcss` < 8.5.10 | high | transitive via `next@15.5.29` (pinned 8.4.31) | build-time CSS processing only, not at runtime | `overrides.next.postcss = ^8.5.10` → Next now resolves the root `postcss@8.5.32`. No Next 16 major upgrade needed. Build and E2E re-verified |
| `zod` < 4.6.6 | high | direct dependency | **unused**: no import anywhere in `src`, `tests`, `e2e` or `scripts` | removed |
| `minimatch` 7.0.0–11.0.0 (+5 `@typescript-eslint/*` reporting it) | moderate | transitive via `eslint-config-next` | lint tooling only, never shipped | **unresolved**: the fix needs a typescript-eslint range bump outside `eslint-config-next@15`. Revisit with the Next 16 / ESLint 9 migration |

Tooling note: npm 10.9.2 crashes (`Cannot read properties of null (reading 'edgesOut')`) while resolving vitest 4's peer set. The lockfile was regenerated with npm 11.6.2. `npm ci` on Node 22 / npm 10 installs it cleanly, as shown in §6.

## 5. Application journey (Priority 4)

- **Covered locally:** registration → login → configurator → authoritative quote → checkout → settlement → intake → real multipart file upload → assignment → persisted QA review → atomic delivery → customer acceptance. Evidence: Playwright `e2e/browser-workflow.spec.ts` (4 tests, multi-actor), `tests/e2e-workflow.test.ts`, and the V8.1/V8.2 suites.
- **Catalog:** the seven approved services are unchanged and now pinned by a test: `HI-SET-META` 150000, `HI-SET-GOOGLE` 150000, `HI-SET-LINKEDIN` 150000, `HI-BUNDLE-3` 300000, `HI-ADD-WA` 169000, `HI-ADD-PIXEL` 150000, `HI-ADD-CREATIVE` 99000 poisha. `HI-SAAS-01` stays disabled.
- **Branding:** Navy/Gold/Ivory tokens are untouched (`tailwind.config.ts` not modified in V8.2/V8.3).
- **Not covered:** the same journey on real cloud infrastructure. It is blocked (§7).

## 6. Verification pipeline (Priority 5)

The commands ran sequentially after the last source change on Windows 11 with Node 22.14.0 and npm 10.9.2. The local PGlite harness was used.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 430 packages; 6 moderate advisories (dev lint tooling) |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | no ESLint warnings or errors |
| `npm test` | 0 | 17 files, **174 / 174 passed**: the 166 earlier tests, 7 migration/privilege tests and 1 catalog pin |
| `npm run build` | 0 | succeeded with Next's postcss override |
| `npm run test:e2e` | 0 | Playwright **4 / 4 passed** |
| `npm audit --audit-level=high` | 0 | 0 high, 0 critical |

## 7. Isolated staging, SMTP, payment sandbox (Priority 6)

| Gate | Status | Evidence |
|---|---|---|
| Isolated Supabase staging | **BLOCKED** | `supabase projects list` (read-only, 2026-11-10) shows only `NotRealEngine` and `Hoooplaaa` (`aqmyqezuoscpgqwtvblu`, production). The free-plan 2-project limit is reached. Nothing was created, deleted or paused |
| Migrations / RLS / RPC / Storage on staging | **BLOCKED** | no staging project; nothing applied to Production |
| Vercel Preview → staging | **BLOCKED** | Preview shares Production's Supabase variables |
| Cloud registration / email | **BLOCKED** | no staging; SMTP not configured |
| SSLCOMMERZ sandbox checkout | **BLOCKED** | no sandbox merchant credentials configured for Preview |
| Cloud QA / delivery / acceptance | **BLOCKED** | depends on staging |

## 8. Owner dependencies (Priority 7)

| # | Dependency | Owner action |
|---|---|---|
| 1 | **Production configuration** | Set a valid `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production via the dashboard or the Supabase integration (never in chat), and remove `NODE_ENV=development`. Then follow the order in §2 |
| 2 | Dedicated Supabase staging project | Upgrade the plan, free a slot of your choice, or create one in the dashboard. Do not reuse `aqmyqezuoscpgqwtvblu` |
| 3 | Transactional SMTP | Configure in staging Supabase Auth |
| 4 | SSLCOMMERZ sandbox | Set sandbox store id/password as Preview-scoped Vercel secrets |
| 5 | Bangladesh business calendar | Approve the weekend days and holiday list (`PROVISIONAL_UNAPPROVED`) |
| 6 | QA four-eyes policy | Decide whether the reviewer must differ from the uploader |
| 7 | Merge authorization | Review and merge the V8.3 PR (link below); nothing was merged by the agent |
| 8 | Production deployment | Production is held at `d9013ef` by the rollback. Promote only after #1 and the staging proof |
| 9 | Synthetic fixtures | Clean the staging fixtures still in `aqmyqezuoscpgqwtvblu` (see V7.2R evidence) |

PR_PLACEHOLDER
