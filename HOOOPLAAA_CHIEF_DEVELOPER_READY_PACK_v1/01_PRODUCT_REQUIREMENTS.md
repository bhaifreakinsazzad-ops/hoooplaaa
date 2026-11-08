# 01 — Product Requirements Document (PRD)

## 1. Product definition
A conversion-focused **Digital Services Marketplace + Intelligent Service Configurator + Order Management + Client Workspace + Admin Control Center**. Core user outcome is to complete service selection and order placement without speaking to a human, while staff may perform the actual setup and expert review after payment. This is **self-service commerce**, not a false promise of fully autonomous fulfillment.

## 2. Primary audiences
- New SME, retail, local service and startup owners seeking professional Meta/Google/LinkedIn infrastructure.
- Existing page/account owners with missing ownership, security, consistency and tracking foundations.
- E-commerce/lead-driven businesses buying pixel, automation or creative add-ons, where technically applicable.
- Future growth customers buying approved managed services, specialist strategy and verified SaaS products.
- Internal finance, fulfillment, audit and catalog administrators.

## 3. Public entry paths
A. Goal-first guided path: **Tell us what you're trying to achieve** (business legitimacy, local discovery, reach, enquiries, tracking, growth).
B. Category path: **Explore services** filtered by category, price type and availability.
C. Hero-offer path: **3-Platform Setup — ৳3,000**, with clear Google eligibility rules.
D. Audit path: **Free Initial Business Readiness Audit** (not a purchased service).
E. Saved/pending order path: resume configuration and complete payment after identity verification.

## 4. Canonical customer journey / acceptance
1. Browse offerings without account; show only `published` product detail and permitted pricing. Proposed offerings may be hidden or labelled "Coming soon" with NO payment CTA.
2. Select service and open service-specific wizard; save anonymous draft locally with expiry, server-side draft only after verified identity.
3. Supply essential profile: business type, online/offline storefront, geography, website status, existing account URLs, desired outcome and deadlines.
4. Eligibility checks happen BEFORE the checkout commitment. Google Business Profile only for eligible businesses; flags for no website before Pixel.
5. Choose compatible add-ons. Dynamic price panel updates instantly, but the authoritative quote comes from the server with an expiry, price version, scope/terms snapshot and eligibility result.
6. Review inclusions, exclusions, client responsibilities, deadlines, third-party costs, privacy and policy acknowledgement. Never hide a service requirement behind late surprise fees.
7. Sign up/sign in via verified email magic link or OTP to securely own the order; no mandatory human call. Guest quote optional; anonymous access to orders prohibited.
8. Pay via approved provider if activated; otherwise launch-safe manual payment submission with an explicit **verification pending** status. A screenshot alone never proves payment.
9. Order confirmation, unique ID, invoice/receipt status, onboarding checklist and secure upload interface appear immediately.
10. Customer supplies details, logo/assets, consent and delegated platform access instructions. Form NEVER asks for raw Meta/Google/LinkedIn passwords.
11. Dashboard shows the exact workflow state, due dates, incomplete inputs, approval questions, QA/revisions and final handover.
12. After delivery, offer relevant next service based on diagnosed gaps, without implying a guarantee of revenue.

## 5. Functional areas (MVP P0)
**Marketing site** — homepage, solution/category discovery, service detail, platform eligibility guidance, pricing, about, process, FAQs, policies, audit and accessible global navigation.
**Configurator** — goal guidance; conditional questions; bundled services/add-ons; live draft price; server quote; save/resume; validation; review screen; capability and availability gates; "custom quote required" for unknowns.
**Checkout** — order summary, verified identity, immutable quote snapshot, payment-method selection, provider checkout or manual reference, T&Cs acceptance, provider callback validation, no double order processing.
**Client portal** — profile/businesses, quotes, orders, payment state, requirements checklist, upload, approvals, deliverables, revisions, support inbox, notification preferences.
**Admin** — product catalog + lifecycle approval; price versions; orders; payment review; intake builder; deliverables; assigned jobs; staff roles; audit logs; customer businesses; analytics; site content.
**Audit** — public/eligibility-focused pre-sale audit request/triage; paid-client detailed audit workflow with reviewer approvals and generated summary PDF/report in later phase (may start with downloadable HTML/PDF through server).

## 6. Functional areas (P1 / P2, not required to initiate first paid order)
- P1: plan subscriptions, cancellation/renewal rules, supported SaaS provisioning; integrations only after provider authorization.
- P1: promo codes with usage limits, referral campaign tracking, optional product recommendation logic, localized transactional emails.
- P1: scheduled milestones, SLA pause/resume, change orders, exports, detailed reporting, customer satisfaction tracking.
- P2: AI requirement co-pilot, AI draft audit suggestions with mandatory human signoff, intelligent package recommendations, broader marketplace and cross-brand fulfillment automation.
- P2: recurring billing only when local provider mandate + API capabilities have been verified. Manual renewal invoices are acceptable otherwise.

## 7. Product lifecycle labels
`draft`, `source_listed`, `needs_verification`, `approved_internal`, `published`, `paused`, `retired`, `blocked`.
A **published** offer also needs `checkout_enabled=true`, tested delivery capability, valid price version and required legal/provider clearance. Do not derive publication directly from a source's price.

## 8. Site policies
No guaranteed Google ranking, Meta/Google approval, guaranteed ROAS or "best marketer" claim. Provider software, ad spend, API/WhatsApp message charges and custom work are separate unless a scoped approved offer says otherwise. Customers own their underlying social accounts/business assets. Tax statements require reviewed tax settings, not assumed percentages. User data use requires a clear privacy notice, consent where required and retention controls.

## 9. Primary KPIs (only from actual tracked events)
Configurator start → price view → quote created → checkout initiated → verified payment → intake completed → fulfilled → accepted; audit application → qualified → purchase; revenue by SKU; refund rate; time to first response; fulfillment time; subscription renewal only for genuinely active paid subscriptions. Label missing data "Not measured".

## 10. Explicit non-goals
Not a static brochure, a Photoshop mockup, a fabricated fully automated ad agency, an unlicensed payment processor, an unlimited-chatbot service, a guaranteed account approval system or a published store containing every proposed 388/100 inventory row.
