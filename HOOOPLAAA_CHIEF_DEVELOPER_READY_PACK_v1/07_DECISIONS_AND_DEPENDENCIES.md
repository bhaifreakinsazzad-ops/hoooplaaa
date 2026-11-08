# 07 — Decisions, Risks, Dependencies & Readiness Checklist

## Decisions ALREADY established by provided records and this conversation
- Brand used for product planning: Hoooplaaa Incorporated; design label HOOOPLAAA.
- Company: full-service digital marketing agency; Business Setup is one line.
- Bangladesh-first, remote/done-for-you with global-ready intent.
- Tagline: Attract. Connect. Convert. Grow.
- Confirmed working prices: Meta 1500; Google 1500; LinkedIn 1500; three-platform 3000; WhatsApp 1690; Pixel 1500; basic static creative 990 BDT.
- Audit is free **both before and after purchase**, with a smaller qualified pre-sale review and detailed included post-sale report.
- Prior handoff stack direction: Next.js + Supabase + Vercel.

## Critical business decisions required BEFORE public launch (NOT blockers for a prototype)
1. Final controlled domain and official business email; logo master, favicon, legal footer and contact method.
2. Company registration/merchant entity and authorized contracting identity; vendor and agency fulfillment agreements if cross-brand.
3. Approve which SKUs are **published + purchasable**, final public prices, scope versions, tax/fees, refund policy, legal terms and actual fulfillment availability.
4. Choose approved merchant method(s), obtain sandbox/live accounts and verify bank/MFS reconciliation; until then demo/sandbox and manual pending verification only.
5. Confirm responsible staff and capacity for delivery, 2–4 day bundle target, customer support, audits and escalation. The web app automates purchase, not expert fulfillment automatically.
6. Approve handling for Google-ineligible three-platform bundle, default eligibility questionnaire and substitute/refund policy.
7. Confirm WhatsApp add-on precise scope: native quick replies vs one API workflow; which provider/channel capabilities and recurring fees are permitted.
8. Decide OTP/email provider, privacy/retention settings, file sizes and anti-spam/abuse policy.
9. SaaS package entitlement matrix, current vendor permissions and weekly/monthly price conflicts before they are enabled.

## Recommended implementation defaults (reversible, not owner-confirmed facts)
- Customer language: Bangla-first with English option.
- Guest explore/configure; verified email or OTP account for sensitive checkout/order access.
- Checkout starts with only the seven current fixed-price service/add-on SKUs after publication approval; custom services are quote requests.
- Approved local gateway integration behind `PaymentProvider` interface; SSLCOMMERZ first sandbox candidate, not a claim of current merchant status.
- Unapproved SaaS products and the 100 proposed allocation appear only in internal admin seed/knowledge, not customer-facing order controls.
- Price/version policy admin approval is manual and recorded; preserve history.

## Key risks
`P0`: mismatched payment, direct unauthorized data access, invented purchasable products, Google ineligibility, false free-audit valuation, secret collection, fake claims. `P1`: provider fees, subscription entitlement, revisions/refunds, manual verification latency, high support burden and customer confusion. `P2`: extreme configurator complexity, too many catalog categories and overbuilt integrations before first-order validation.

## Readiness verdict
**Product brief, architecture, design language, rule logic, safety gates, developer instruction and test plan: READY.**
**Design mockups selected: NOT YET.**
**Application coded, deployed, integrated with merchant/payment accounts, secured/tested in a real environment: NOT YET.**

This pack is ready to hand to a coding agent. Business credential and merchant dependencies only become blockers at their indicated execution/release stages; none require unsafe password sharing.
