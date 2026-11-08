# HOOOPLAAA INCORPORATED — CHIEF DEVELOPER EXECUTION PACK

**Version:** 1.0 • **Prepared:** 2026-11-08 (Asia/Dhaka) • **Mode:** Predevelopment blueprint, NOT a deployed website.

## Product objective
Create a premium, mobile-first, Bangladesh-first self-service **digital agency commerce and fulfilment platform**. Clients should be able to discover suitable services, answer business-specific questions, configure scope, see a trustworthy live price/quote, submit orders, pay using an approved method, provide onboarding requirements and follow progress — without a mandatory sales call or WhatsApp conversation. Complex/non-standard requests use a structured custom-quote workflow, not fabricated automated prices.

**Business promise:** Attract. Connect. Convert. Grow.

## Read order for a coding agent
1. `01_PRODUCT_REQUIREMENTS.md` — outcomes, user journeys, functional requirements, statuses and non-goals.
2. `02_UX_BRAND_AND_SITEMAP.md` — interaction and visual design.
3. `03_ARCHITECTURE_AND_SECURITY.md` — implementation architecture, data tenancy and payment integrity.
4. `04_DATA_AND_PRICING_ENGINE.md` — data model, pricing / eligibility rules, order state machines.
5. `05_IMPLEMENTATION_PHASES_QA.md` — build sequence, test plan, launch gates and success criteria.
6. `06_AGENT_MASTER_INSTRUCTIONS.md` — copy/paste into the coding agent.
7. `07_DECISIONS_AND_DEPENDENCIES.md` — open business decisions, unknowns, release blockers.
8. `catalog_seed_source_aware.json` and `configuration_rule_examples.json` — structured input examples. **All initial `checkout_enabled` values are false.**
9. `source_manifest.json` — source precedence and URLs.

## The non-negotiable business truth
- Hoooplaaa Incorporated is a **multi-service digital marketing agency**. Business Setup & Infrastructure Solutions is **one** service line, not the whole company.
- Current owner-confirmed working individual rates: Meta ৳1,500; eligible Google Business Profile ৳1,500; LinkedIn Company Page ৳1,500; combined bundle ৳3,000. Add-ons: WhatsApp workflow ৳1,690; Meta Pixel ৳1,500; Basic static ad creative ৳990.
- Pre-sale **Initial Audit** and post-sale **Detailed Audit** are different complimentary journeys. The advertised `$20 value` is a historical marketing figure; never imply a proven separate market price without evidence.
- SaaS, expanded creative, affiliate and other offerings exist in the knowledge base, but many are **source-listed/proposed**, not approved for self-service payment. None may become purchasable until owner approval, provider/fulfillment tests, price/terms review and enablement.
- Original `388` catalog, proposed `100` Hoooplaaa allocation, historical `88` intended public rows and six old seed services refer to DIFFERENT inventories. They are not authoritative published catalog counts.
- NO checkout for regulated collection/settlement gateways or virtual prepaid cards without explicit legal/provider clearance. NO customer passwords via intake forms.

## Implementation readiness
- **Architectural / agent-brief readiness:** complete within this packet.
- **Actual software built:** no. **Payment merchant credentials:** not supplied. **Supabase/Vercel/GitHub repository:** not identified. **Official domain/logo:** approval pending. **Approved public SKU list:** needs release gate.
- It is possible to implement and test a full self-service experience in sandbox/local mode now. Production financial processing and public marketing publication require the missing business/provider approvals.

## Definition of done for a production launch
A new customer can select an **approved** service, navigate a correctly conditional configurator, obtain a server-calculated price, authenticate/verify ownership, pay through a validated merchant integration, see one idempotently created order, provide secure requirements, track work and receive an accessible handover. A properly authorized admin can manage catalogs, fulfillment, QA and the payment ledger. Deny unauthorized access at both database and application levels; tests pass; no unsupported claims or blocked offers are exposed.
