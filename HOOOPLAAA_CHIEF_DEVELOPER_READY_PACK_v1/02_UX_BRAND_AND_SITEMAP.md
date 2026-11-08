# 02 — UX Strategy, Premium Design System & Sitemap

## Design ambition
**A premium, trust-first business operating interface, not a cheap gig marketplace.** An exceptionally polished, functional agency-commerce product with quick self-discovery and zero-call checkout. Style inspiration is the recorded Hoooplaaa navy/ivory/gold brand system; the generated service-menu poster is stylistic reference only, NOT a confirmed logo or an authoritative all-live catalog.

## Visual tokens — source direction + proposed implementation
- Navy base: `#071525`; deeper navy: `#0B1A2A`; midnight panel: `#10283E` (proposed).
- Muted gold: `#D9B45E`; pale gold: `#F4D58D`; light canvas: `#F7F8FA`; cream: `#FFFCF5` (proposed).
- Text on light: `#102033` (proposed), on navy: `#F7F8FA`.
- Fonts: English **Manrope** or **Inter**; Bangla **Hind Siliguri** or **Noto Sans Bengali**. Choose one pair, self-host with legal font licenses as applicable.
- Spacing: 8px grid, 24–32px desktop card padding, 16–20px mobile, 12–20px rounding; restrained shadows and 1px stroke.
- Motion: 120–240ms microinteraction; no blocking splash screens or distracting scroll takeover; respect `prefers-reduced-motion`.
- WCAG 2.2 AA target for contrast, keyboard navigation, form errors, focus, touch targets and text resizing. Performance budgets verified via Lighthouse and real devices.

## UX signature interactions
1. Full-width hero with clear promise and CTAs **Build My Package** and **Explore Services**; trust through verifiable process/guarantees of workflow, not fake testimonials.
2. Sticky progress wizard: `Your Business → Choose Setup → Customize → Review Price → Checkout` (mobile collapsible).
3. Live price summary sticky on desktop / bottom summary sheet on mobile; currency BDT and exact recurrence/one-time separation.
4. Clear states: eligible / not applicable / needs verification / quote only. Tooltips explain the reason in plain Bangla and English terms.
5. Cross-service recommendation **based on stated needs**, not pressure or invented benefits.
6. All input validated inline, with save/resume, keyboard-accessible conditional sections and descriptive next-step errors.
7. Receipt/order detail timeline with clear owner, handover checklist, countdown only when SLA actually started, blockers and pending provider approval.
8. Dual-language design architecture: Bangla-first Bangladesh pages, English opt-in and stored locale; never fake untranslated admin/customer notices.

## Information architecture
PUBLIC
- `/` — conversion homepage
- `/services` — approved catalog with filters
- `/services/[slug]` — scope, price, who eligible, FAQ, configuration CTA
- `/solutions/[slug]` — jobs-to-be-done / industry solution pages
- `/packages` — approved bundles only
- `/build` — guided discovery, choose goals
- `/configure/[slug]` — dynamic per-service wizard
- `/audit` — free pre-sale initial readiness request
- `/how-it-works`, `/about`, `/faq`, `/contact`
- `/policies/privacy`, `/policies/terms`, `/policies/refund`, `/policies/delivery`
AUTH + CUSTOMER
- `/auth/sign-in`, `/auth/callback`
- `/checkout/[quoteId]`, `/checkout/return`, `/checkout/status/[orderId]`
- `/dashboard`, `/dashboard/businesses`, `/dashboard/quotes`, `/dashboard/orders`, `/dashboard/orders/[id]`, `/dashboard/files`, `/dashboard/notifications`, `/dashboard/account`
ADMIN
- `/admin` overview
- `/admin/catalog`, `/admin/catalog/[id]`, `/admin/pricing`, `/admin/rules`, `/admin/orders`, `/admin/payments`, `/admin/quotes`, `/admin/audits`, `/admin/customers`, `/admin/fulfillment`, `/admin/files`, `/admin/notifications`, `/admin/content`, `/admin/analytics`, `/admin/team`, `/admin/audit-logs`, `/admin/settings`

## Key UI components
`Header`, `MobileNav`, `LocaleSwitcher`, `ServiceCard`, `BundleCard`, `TrustFacts`, `GoalSelector`, `QuestionRenderer`, `ConditionalStep`, `EligibilityAlert`, `AddOnToggle`, `LivePriceSummary`, `PriceBreakdown`, `QuoteReview`, `PaymentMethodSelector`, `UploadDropzone`, `ClientOrderTimeline`, `RequirementChecklist`, `AdminDataTable`, `StatusBadge`, `ActivityLog`, `ConfirmationDialog`, `Toast`.

## Brand content principles
- First screen: **Build your business foundation. Choose what you need. Order online.** (proposed copy, needs copy approval).
- Hero bundle: **Meta + eligible Google + LinkedIn, ৳3,000 one-time**; show Google platform eligibility clearly.
- Advertised complimentary audit: pre-sale initial review vs detailed post-sale audit; place conditions in the same viewport/FAQ.
- Show `৳1,500` as BDT numerals consistently and avoid fake crossed-out prices.
- No fabricated reviews, clients, results, certified partnerships or 24/7 human availability.

## First visual-review gate
Before production UI build, create **3 distinct visual concepts** (not just palette swaps), present homepage + configurator desktop/mobile frames, select one direction, and lock component/token system. Until the user chooses, treat the design spec as a direction rather than an approved pixel-perfect visual target.
