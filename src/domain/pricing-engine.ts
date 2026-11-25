import {
  findServiceBySku,
  formatBdt,
  getActivePricingWindow,
  getEffectivePriceMinor,
} from './catalog';
import {
  BusinessProfile,
  EligibilityEvaluation,
  EligibilityFlag,
  QuoteItem,
  QuoteSnapshot,
  Service,
  SubscriptionRenewalNotice,
} from './types';
import crypto from 'crypto';

export interface ConfiguratorSelections {
  businessId: string;
  businessName: string;
  businessProfile: Partial<BusinessProfile>;
  selectedPlatformSkus: string[]; // Core services, variants, bundles (v3.0 or legacy)
  selectedAddonSkus: string[];    // Specialized add-ons (X01–X22 or legacy HI-ADD-*)
  promoCode?: string;
  clientNotes?: string;
  /** Optional evaluation timestamp (defaults to current server clock; useful for deterministic window testing). */
  evaluatedAt?: Date;
}

const GOOGLE_REQUIRED_SKUS = new Set(['B02', 'PK01', 'HI-SET-GOOGLE', 'HI-BUNDLE-3']);
const META_REQUIRED_SKUS = new Set(['B01', 'PK01', 'HI-SET-META', 'HI-BUNDLE-3']);
const TRACKING_WEBSITE_SKUS = new Set(['T01', 'T02', 'T03', 'PK03', 'HI-ADD-PIXEL']);

/**
 * Server-authoritative eligibility evaluation.
 * Evaluates business profile against Google, Meta, and website/CMS requirements
 * across both v3.0 catalog codes and legacy SKUs.
 */
export function evaluateEligibility(
  profile: Partial<BusinessProfile>,
  selectedPlatformSkus: string[],
  selectedAddonSkus: string[]
): EligibilityEvaluation {
  const flags: EligibilityFlag[] = [];
  let isEligible = true;
  let canSelfCheckout = true;
  let recommendedAlternativeSku: string | undefined = undefined;
  let customScopeReason: string | undefined = undefined;

  const allSelected = [...selectedPlatformSkus, ...selectedAddonSkus];

  // Rule 1: Google Business Profile physical interaction requirement
  const isGoogleRequested = allSelected.some((sku) => GOOGLE_REQUIRED_SKUS.has(sku));
  if (isGoogleRequested) {
    const isPureOnline =
      profile.operatingModel === 'online_only_no_in_person' ||
      (!profile.hasPhysicalStorefront && !profile.conductsInPersonVisits);

    if (isPureOnline) {
      isEligible = false;
      canSelfCheckout = false;
      flags.push({
        code: 'GOOGLE_ONLINE_ONLY_INELIGIBLE',
        severity: 'blocker',
        message:
          'Google Business Profile strictly requires in-person customer visits (physical shop or local service area). Pure online/e-commerce businesses cannot be registered under Google policy.',
        messageBn:
          'গুগল বিজনেস প্রোফাইলের জন্য কাস্টমারের সাথে সরাসরি দেখা হওয়া (দোকান বা সার্ভিস এরিয়া) বাধ্যতামূলক। শুধুমাত্র অনলাইন ভিত্তিক ব্যবসার জন্য গুগল প্রোফাইল অনুমোদিত নয়।',
      });

      if (selectedPlatformSkus.includes('HI-BUNDLE-3')) {
        recommendedAlternativeSku = 'HI-SET-META+HI-SET-LINKEDIN';
        customScopeReason =
          '3-Platform bundle cannot be auto-fulfilled due to Google Business Profile ineligibility. Select Meta + LinkedIn individually (৳3,000 total) or request custom quotation.';
      } else if (selectedPlatformSkus.includes('PK01')) {
        recommendedAlternativeSku = 'B01+B03';
        customScopeReason =
          'PK01 (Complete 3-Platform Business Setup) requires Google Business Profile eligibility. Select B01 (Meta) + B03 (LinkedIn) individually instead.';
      }
    }
  }

  // Rule 2: Meta Policy Restrictions / Ownership Disputes
  const isMetaRequested = allSelected.some((sku) => META_REQUIRED_SKUS.has(sku));
  if (isMetaRequested) {
    if (
      profile.facebookPageStatus === 'restricted' ||
      profile.metaPortfolioStatus === 'restricted'
    ) {
      isEligible = false;
      canSelfCheckout = false;
      customScopeReason =
        'Your Meta account has existing policy bans or asset ownership disputes. These require bespoke manual scope review.';
      flags.push({
        code: 'META_RESTRICTION_MANUAL_SCOPE',
        severity: 'blocker',
        message:
          'Existing Meta policy restrictions or page ownership disputes require manual consultation and cannot proceed through standard fixed-fee setup.',
        messageBn:
          'আপনার মেটা অ্যাকাউন্টে পূর্বের রেস্ট্রিকশন বা মালিকানা জটিলতা রয়েছে, যা ফিক্সড প্রাইসে সমাধান সম্ভব নয়। স্পেশালিস্ট পর্যালোচনার প্রয়োজন।',
      });
    }
  }

  // Rule 3: Website Tracking (Pixel / GA4 / CAPI / PK03) requires active website + CMS/Tag access
  const isTrackingRequested = allSelected.some((sku) => TRACKING_WEBSITE_SKUS.has(sku));
  if (isTrackingRequested) {
    const hasWebsite = Boolean(profile.websiteUrl && profile.websiteUrl.trim().length > 0);
    const hasAccess = profile.websiteCmsAccess === true;

    if (!hasWebsite || !hasAccess) {
      canSelfCheckout = false;
      flags.push({
        code: 'PIXEL_PREREQUISITE_MISSING',
        severity: 'blocker',
        message:
          'Website Tracking Setup (Meta Pixel, GA4/GTM, CAPI, or Tracking Essentials) requires an active website with admin CMS or tag manager access. Please add your website or uncheck tracking items.',
        messageBn:
          'ওয়েবসাইট ট্র্যাকিং সেটআপের (মেটা পিক্সেল, GA4/GTM বা CAPI) জন্য সক্রিয় ওয়েবসাইট এবং অ্যাডমিন/কোড অ্যাক্সেস থাকা বাধ্যতামূলক।',
      });
    }
  }

  // Informational flags
  if (selectedAddonSkus.includes('HI-ADD-WA')) {
    flags.push({
      code: 'WHATSAPP_API_COSTS_EXCLUDED',
      severity: 'info',
      message:
        'WhatsApp Setup covers 1 core workflow configuration. Meta API per-conversation messaging costs are billed directly by Meta and excluded from this fee.',
      messageBn:
        'হোয়াটসঅ্যাপ সেটআপে ১টি ওয়ার্কফ্লো অন্তর্ভুক্ত। মেটার প্রতি মেসেজের অফিসিয়াল খরচ মেটাকে সরাসরি প্রদান করতে হবে।',
    });
  }

  if (
    allSelected.some((sku) =>
      ['A01', 'A01-MODE-1', 'A01-MODE-2', 'X05', 'L01'].includes(sku)
    )
  ) {
    flags.push({
      code: 'SEPARATE_MEDIA_BUDGET_NOTICE',
      severity: 'info',
      message:
        'Ad spend / paid media budgets are paid directly by the client to ad platforms (Meta, Google, LinkedIn) and are not included in HOOOPLAAA service fees.',
      messageBn:
        'বিজ্ঞাপনের মিডিয়া বাজেট সরাসরি অ্যাড প্ল্যাটফর্মকে (Meta, Google, LinkedIn) পরিশোধ করতে হবে; এটি সার্ভিস ফি-এর বাইরে।',
    });
  }

  return {
    isEligible,
    canSelfCheckout,
    flags,
    recommendedAlternativeSku,
    customScopeReason,
  };
}

/**
 * Resolves deduplicated list of SKUs applying:
 * 1. Bundle component suppression (PK01 -> B01/B02/B03, PK02 -> I01/I06/I10, PK03 -> T01/T02, HI-BUNDLE-3 -> HI-SET-*)
 * 2. Alias protection (X05 cannot be double-billed alongside A01-MODE-2)
 * 3. Variant parent suppression (A01-MODE-* supersedes bare A01; V01-MODE-* supersedes bare V01)
 */
function resolveDeduplicatedServices(
  selectedPlatformSkus: string[],
  selectedAddonSkus: string[]
): { services: Service[]; notes: string[] } {
  const notes: string[] = [];
  const rawOrder = Array.from(new Set([...selectedPlatformSkus, ...selectedAddonSkus]));
  const rawSet = new Set(rawOrder);
  const suppressed = new Set<string>();

  // 1. Legacy HI-BUNDLE-3 supersedes individual HI-SET-* items
  if (rawSet.has('HI-BUNDLE-3')) {
    for (const comp of ['HI-SET-META', 'HI-SET-GOOGLE', 'HI-SET-LINKEDIN']) {
      if (rawSet.has(comp)) {
        suppressed.add(comp);
        notes.push(`${comp} is already included inside HI-BUNDLE-3 and was not billed separately.`);
      }
    }
  }

  // 2. v3.0 Signature Bundles supersede their included components
  const bundleRules: Array<{ bundle: string; components: string[] }> = [
    { bundle: 'PK01', components: ['B01', 'B02', 'B03'] },
    { bundle: 'PK02', components: ['I01', 'I06', 'I10'] },
    { bundle: 'PK03', components: ['T01', 'T02'] },
  ];

  for (const rule of bundleRules) {
    if (rawSet.has(rule.bundle)) {
      for (const comp of rule.components) {
        if (rawSet.has(comp)) {
          suppressed.add(comp);
          notes.push(
            `${comp} is included inside bundle ${rule.bundle} — automatically deduplicated to prevent double billing.`
          );
        }
      }
    }
  }

  // 3. Variant supersedes parent base row if both selected
  if (rawSet.has('A01') && (rawSet.has('A01-MODE-1') || rawSet.has('A01-MODE-2'))) {
    suppressed.add('A01');
    notes.push('Base A01 listing superseded by specific selected Advertising delivery mode.');
  }
  if (
    rawSet.has('V01') &&
    ['V01-MODE-3', 'V01-MODE-4', 'V01-MODE-5', 'V01-MODE-6'].some((v) => rawSet.has(v))
  ) {
    suppressed.add('V01');
    notes.push('Base V01 listing superseded by specific selected HOOOPLAAA VA+ tier.');
  }

  // 4. Ledger Alias Guard: X05 === A01-MODE-2 (Ongoing Campaign Management)
  if (rawSet.has('A01-MODE-2') && rawSet.has('X05')) {
    suppressed.add('X05');
    notes.push(
      'X05 (Campaign Performance Management / month) is a catalog alias of A01-MODE-2 (Ongoing Campaign Management) and was not double-billed.'
    );
  }

  const services: Service[] = [];
  for (const sku of rawOrder) {
    if (suppressed.has(sku)) continue;
    const srv = findServiceBySku(sku);
    if (srv && srv.checkoutEnabled && srv.publicationStatus === 'published') {
      services.push(srv);
    }
  }

  return { services, notes };
}

/**
 * Server-authoritative quote calculation.
 * Never trust client prices or client totals!
 * Auto-applies 2026 Launch Prices during 20 Nov–31 Dec 2026 (Asia/Dhaka)
 * and falls back to Planned Standard List Rates automatically afterward.
 */
export function calculateServerQuote(selections: ConfiguratorSelections): QuoteSnapshot {
  const quoteId = `QUO-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
  const now = selections.evaluatedAt ? new Date(selections.evaluatedAt) : new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL
  const pricingWindow = getActivePricingWindow(now);

  const eligibility = evaluateEligibility(
    selections.businessProfile,
    selections.selectedPlatformSkus,
    selections.selectedAddonSkus
  );

  const { services, notes: deduplicationNotes } = resolveDeduplicatedServices(
    selections.selectedPlatformSkus,
    selections.selectedAddonSkus
  );

  const items: QuoteItem[] = [];
  const subscriptionRenewalNotices: SubscriptionRenewalNotice[] = [];

  let standardSubtotalMinor = 0;

  for (const srv of services) {
    const unitPriceMinor = getEffectivePriceMinor(srv, now);
    const regularUnitPriceMinor = srv.regularPriceMinor ?? srv.basePriceMinor;
    standardSubtotalMinor += regularUnitPriceMinor;

    items.push({
      sku: srv.sku,
      name: srv.name,
      nameBn: srv.nameBn,
      unitPriceMinor,
      regularUnitPriceMinor,
      pricingTier: pricingWindow.activeTier,
      quantity: 1,
      lineTotalMinor: unitPriceMinor,
      billingPeriod: srv.billingPeriod,
      offerPolicy: srv.offerPolicy,
      inclusionsSnapshot: [...srv.inclusions],
      exclusionsSnapshot: [...srv.exclusions],
      deliveryTarget: srv.deliveryTarget,
    });

    if (srv.billingPeriod === 'monthly' && typeof srv.regularPriceMinor === 'number') {
      const launchMinor = srv.launchPriceMinor ?? unitPriceMinor;
      subscriptionRenewalNotices.push({
        sku: srv.sku,
        name: srv.name,
        launchFirstMonthMinor: launchMinor,
        standardMonthlyMinor: srv.regularPriceMinor,
        noticeEn: pricingWindow.isLaunchActive
          ? `${srv.name}: 2026 Launch Offer (${formatBdt(launchMinor)}) applies to Month 1 only. Renewal from Month 2 is at Standard List Rate (${formatBdt(srv.regularPriceMinor)}/month) only with explicit client consent.`
          : `${srv.name}: Monthly service billed at Standard List Rate (${formatBdt(srv.regularPriceMinor)}/month). Renewals require client consent.`,
        noticeBn: pricingWindow.isLaunchActive
          ? `${srv.name}: ২০২৬ লঞ্চ অফার (${formatBdt(launchMinor)}) শুধুমাত্র ১ম মাসের জন্য। ২য় মাস থেকে সম্মতিতে স্ট্যান্ডার্ড রেট (${formatBdt(srv.regularPriceMinor)}/মাস)।`
          : `${srv.name}: মাসিক সার্ভিস স্ট্যান্ডার্ড লিস্ট রেটে (${formatBdt(srv.regularPriceMinor)}/মাস) বিল হবে।`,
      });
    }
  }

  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const launchSavingsMinor = Math.max(0, standardSubtotalMinor - subtotalMinor);
  const discountMinor = 0; // Promo codes can be validated server-side if present
  const taxMinor = 0;      // Tax rate confirmed at invoice time
  const totalMinor = subtotalMinor - discountMinor + taxMinor;

  const ruleVersion = '2026-11-21-v3.0-rev4.4';

  // Generate SHA-256 terms hash for immutability
  const termsPayload = JSON.stringify({
    items: items.map((i) => ({
      sku: i.sku,
      total: i.lineTotalMinor,
      inclusions: i.inclusionsSnapshot,
    })),
    totalMinor,
    pricingTier: pricingWindow.activeTier,
    ruleVersion,
  });
  const termsHash = crypto.createHash('sha256').update(termsPayload).digest('hex');

  let status: QuoteSnapshot['status'] = 'priced';
  if (!eligibility.canSelfCheckout) {
    status = 'requires_manual_scope';
  }

  return {
    id: quoteId,
    businessId: selections.businessId || 'anonymous-draft',
    businessName: selections.businessName || 'Business Owner',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ruleVersion,
    termsHash,
    items,
    subtotalMinor,
    standardSubtotalMinor,
    launchSavingsMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    currency: 'BDT',
    pricingTierApplied: pricingWindow.activeTier,
    pricingWindow,
    deduplicationNotes: deduplicationNotes.length > 0 ? deduplicationNotes : undefined,
    subscriptionRenewalNotices:
      subscriptionRenewalNotices.length > 0 ? subscriptionRenewalNotices : undefined,
    eligibility,
    status,
  };
}
