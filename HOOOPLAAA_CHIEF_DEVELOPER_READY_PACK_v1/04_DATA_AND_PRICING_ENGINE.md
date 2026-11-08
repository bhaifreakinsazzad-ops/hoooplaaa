# 04 — Data Model, Dynamic Configurator Rules, Prices and States

## Product model
Do **not** hardcode the entire catalog into JSX. Make admin-editable, auditable data for services, compatible add-ons, dynamic form schema, price versions and publication status. Support one-time, weekly, monthly and custom-quote service families, but launch ONE-TIME fixed-scope first.

Core object inventory (logical schema; not a reviewed SQL migration):
- `profiles(user_id, display_name, contact, locale)`
- `businesses(id, owner_user_id, name, type, operating_model, country, website_url, eligibility_fields)`
- `business_memberships(business_id, user_id, member_role, status)`
- `staff_roles(user_id, role, assignment_scope)`
- `service_categories(id, slug, display_order)`
- `services(id, sku, slug, category_id, fulfillment_owner, publication_status, checkout_enabled, requires_quote, base_billing_model)`
- `service_versions(id, service_id, version, inclusion_json, exclusion_json, prerequisites_json, terms_version, delivery_target, starts_at, expires_at)`
- `price_versions(id, service_version_id, currency, amount_minor, period, effective_from, effective_to, approved_by)`
- `service_options(id, service_id, option_code, field_schema, constraint_json, delta_rule, option_version)`
- `compatibility_rules(id, parent_sku, addon_sku, outcome, condition_json, reason)`
- `audit_requests(id, business_id, stage, review_status, reviewer_id, report_id)` / `audit_findings(...)`
- `configurations(id, customer_id, business_id, selection_json, state, created_at)`
- `quotes(id, configuration_id, status, valid_until, line_snapshot_json, total_minor, currency, terms_hash, approved_scope)`
- `orders(id, business_id, quote_id, order_number, status, financial_status, intake_status, sla_started_at, customer_acceptance_at)`
- `order_items(id, order_id, sku, service_version, price_snapshot_json, normalized_scope_json)`
- `payment_attempts(id, order_id, provider, idempotency_key, amount_minor, status, provider_ref)`
- `payment_events(id, payment_attempt_id, external_event_id UNIQUE, payload_hash, validation_status, received_at)`
- `intake_templates(...)`, `intake_responses(...)`, `requirements(...)`, `uploads(...)`, `access_grants(...)`
- `work_items(...)`, `assignments(...)`, `qa_checks(...)`, `deliverables(...)`, `revision_requests(...)`
- `notifications(...)`, `messages(...)`, `consent_records(...)`, `activity_events(...)`, `audit_logs(...)`, `settings(...)`

All tenant-owned tables require explicit `business_id` or equivalent ownership path and tested RLS. `payment_events` and `audit_logs` are append-only for ordinary users. Use `uuid` internal IDs and separate opaque human-readable order numbers.

## Price semantics
- BDT currency stored as integer `amount_minor` (poisha, i.e. `৳1,500` → `150000`) or a consistent decimal numeric representation; choose once and enforce it throughout all gateway + DB code. Do not mix integer taka with poisha.
- `billing_period` is `one_time | weekly | monthly | quote` and always visible next to the price.
- Current owner-confirmed setup + add-on prices are **working** values; import but keep public checkout disabled pending production release sign-off.
- For a fixed scope: `total = approved_base_package_price + sum(compatible chosen addons + approved options) - approved discounts + applicable reviewed taxes/fees`.
- **Bundle is one SKU.** Do not bill the 3 single services on top of ৳3,000. The displayed ৳1,500 savings is separate-item comparison only.
- Add-ons may be optional and scoped. Current add-ons can be standalone only if a sales/fulfillment rule approves it. Never imply Meta Pixel works without compatible website/property/access.
- If a configuration requires undocumented work, do not guess a price. Change quote state to `requires_manual_scope` with a structured request, or offer only documented and approved alternatives.
- Snapshot selected questions/responses, eligibility evidence, ruleset version, price version, exclusions, delivery target, customer acknowledgements and tax configuration into each quote/order.
- Payment status is reconciled to actual received BDT amount; reject mismatched amount/currency; process refunds as separate tracked movements.

## Concrete configurator rules
**Meta Business Setup:** ask existing page/portfolio, Instagram usage, authorized owner, restrictions/ownership disputes. Restriction or dispute → scope review, not auto-claim of guaranteed resolution.
**Google Business Setup:** ask service area/storefront, whether the business conducts in-person customer contact, official address/privacy preference, existing Google profile/duplicate, verified owner. Pure online-only / lead-gen company → Google Business Profile ineligible; remove or block this part, explain and offer revised approved scope **before payment**.
**LinkedIn Company Page:** ask existing company profile, admin owner, logo/cover, official web identity; consumer personal account is not the purchasable business target.
**3-Platform:** ask per-platform questions and enforce Google eligibility. If not eligible, do NOT silently charge ৳3,000 for an altered bundle; hold for an explicitly approved alternate and accepted scope or choose individual services.
**WhatsApp Add-on:** distinguish native business welcome/away/quick-reply setup vs API automation; current paid one-workflow scope needs compatible provider, opt-in and clear channel costs. Do not conflate static auto-replies and API automation.
**Meta Pixel:** website/property, CMS access, supported events and consent; unsupported access or absent website → `needs_prerequisite` / revised quote (no auto-executed promise).
**Static Ad Creative:** 1 original static concept, 1 included revision, brief and asset rights; variants, animation and source file quoted separately.
**Pre-sale Audit:** lead form collects necessary public URLs, goal and consent; return submission receipt / queue state without pretending full report instant or verified. Qualified cases can receive a reviewed follow-up report later.
**Post-sale Audit:** create a separate included audit job after eligible order is paid, with assigned reviewer and evidence-based findings. Never count it as a second paid line.

## Order state machines
`QUOTE: draft → priced → accepted → expired | cancelled | requires_manual_scope`
`ORDER: created → awaiting_payment → payment_under_review | paid → awaiting_requirements → ready_for_fulfillment → in_progress → qa_review → delivered → accepted → closed`
`ORDER EXCEPTIONS: blocked_waiting_customer, blocked_external_platform, change_order_required, payment_failed, cancelled, refunded, disputed`
`PAYMENT: initiated → pending → verified_paid | verified_failed | risk_hold | refund_pending → refunded`
`AUDIT: requested → eligible_review → assigned → in_review → approved → delivered | declined`
`SERVICE: draft → needs_verification → approved_internal → published → paused → retired` (+ permanently blocked until explicit authority clearance).

Transitions must be server-enforced and logged with previous/new state, actor, timestamp, reason. **Never begin a contractual delivery SLA until payment verified, permissions/assets delivered and requirements complete**; log pause intervals separately.

## Example quote calculation
Input: Meta Business Setup (৳1,500) + eligible Basic Static Ad Creative (৳990) → subtotal ৳2,490, excluding approved explicit external costs and taxes. Quote server revalidates both items. This example is arithmetic, not a published bundle discount.

## Data events
Record: `view_service`, `start_configurator`, `complete_step`, `get_server_quote`, `accept_quote`, `start_checkout`, `payment_verified`, `requirements_completed`, `sla_started`, `qa_passed`, `deliverable_sent`, `order_accepted` with consent/privacy-aware event payloads; **no raw PII in analytics**.

## Migration / database governance
No old Gemini SQL draft is safe by default. Generate fresh versioned migrations and pgTAP RLS tests, review privileges and service-role usage, and apply to local/staging before production. Do not treat this logical schema as executed SQL or a guarantee it fits a vendor's current package versions.
