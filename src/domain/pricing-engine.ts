import { CANONICAL_SERVICES } from './catalog';
import {
  BusinessProfile,
  EligibilityEvaluation,
  EligibilityFlag,
  QuoteItem,
  QuoteSnapshot,
} from './types';
import crypto from 'crypto';

export interface ConfiguratorSelections {
  businessId: string;
  businessName: string;
  businessProfile: Partial<BusinessProfile>;
  selectedPlatformSkus: string[]; // e.g. ['HI-BUNDLE-3'] or ['HI-SET-META', 'HI-SET-LINKEDIN']
  selectedAddonSkus: string[]; // e.g. ['HI-ADD-PIXEL', 'HI-ADD-CREATIVE']
  promoCode?: string;
  clientNotes?: string;
}

/**
 * Server-authoritative eligibility evaluation.
 * Evaluates business profile against Google, Meta, and website requirements.
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

  const isGoogleRequested =
    selectedPlatformSkus.includes('HI-SET-GOOGLE') ||
    selectedPlatformSkus.includes('HI-BUNDLE-3');

  // Rule 1: Google Business Profile physical interaction requirement
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
      }
    }
  }

  // Rule 2: Meta Policy Restrictions / Ownership Disputes
  const isMetaRequested =
    selectedPlatformSkus.includes('HI-SET-META') ||
    selectedPlatformSkus.includes('HI-BUNDLE-3');

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

  // Rule 3: Meta Pixel requires an active website with CMS / Codebase access
  if (selectedAddonSkus.includes('HI-ADD-PIXEL')) {
    const hasWebsite = profile.websiteUrl && profile.websiteUrl.trim().length > 0;
    const hasAccess = profile.websiteCmsAccess === true;

    if (!hasWebsite || !hasAccess) {
      canSelfCheckout = false;
      flags.push({
        code: 'PIXEL_PREREQUISITE_MISSING',
        severity: 'blocker',
        message:
          'Meta Pixel Tracking Setup requires an active website with admin CMS or code access. Please add your website or uncheck this add-on.',
        messageBn:
          'মেটা পিক্সেল সেটআপের জন্য সক্রিয় ওয়েবসাইট এবং অ্যাডমিন/কোড অ্যাক্সেস থাকা বাধ্যতামূলক।',
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

  return {
    isEligible,
    canSelfCheckout,
    flags,
    recommendedAlternativeSku,
    customScopeReason,
  };
}

/**
 * Server-authoritative quote calculation.
 * Never trust client prices or client totals!
 */
export function calculateServerQuote(selections: ConfiguratorSelections): QuoteSnapshot {
  const quoteId = `QUO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

  const eligibility = evaluateEligibility(
    selections.businessProfile,
    selections.selectedPlatformSkus,
    selections.selectedAddonSkus
  );

  const items: QuoteItem[] = [];

  // Determine platforms:
  // If HI-BUNDLE-3 is selected, it supersedes individual setup SKUs
  const hasBundle = selections.selectedPlatformSkus.includes('HI-BUNDLE-3');

  if (hasBundle) {
    const bundleService = CANONICAL_SERVICES.find((s) => s.sku === 'HI-BUNDLE-3');
    if (bundleService) {
      items.push({
        sku: bundleService.sku,
        name: bundleService.name,
        nameBn: bundleService.nameBn,
        unitPriceMinor: bundleService.basePriceMinor,
        quantity: 1,
        lineTotalMinor: bundleService.basePriceMinor,
        billingPeriod: bundleService.billingPeriod,
        inclusionsSnapshot: [...bundleService.inclusions],
        exclusionsSnapshot: [...bundleService.exclusions],
        deliveryTarget: bundleService.deliveryTarget,
      });
    }
  } else {
    // Add individual platform setups
    for (const sku of selections.selectedPlatformSkus) {
      const srv = CANONICAL_SERVICES.find((s) => s.sku === sku);
      if (srv && srv.checkoutEnabled && srv.publicationStatus === 'published') {
        items.push({
          sku: srv.sku,
          name: srv.name,
          nameBn: srv.nameBn,
          unitPriceMinor: srv.basePriceMinor,
          quantity: 1,
          lineTotalMinor: srv.basePriceMinor,
          billingPeriod: srv.billingPeriod,
          inclusionsSnapshot: [...srv.inclusions],
          exclusionsSnapshot: [...srv.exclusions],
          deliveryTarget: srv.deliveryTarget,
        });
      }
    }
  }

  // Add chosen add-ons
  for (const sku of selections.selectedAddonSkus) {
    const srv = CANONICAL_SERVICES.find((s) => s.sku === sku);
    if (srv && srv.checkoutEnabled && srv.publicationStatus === 'published') {
      items.push({
        sku: srv.sku,
        name: srv.name,
        nameBn: srv.nameBn,
        unitPriceMinor: srv.basePriceMinor,
        quantity: 1,
        lineTotalMinor: srv.basePriceMinor,
        billingPeriod: srv.billingPeriod,
        inclusionsSnapshot: [...srv.inclusions],
        exclusionsSnapshot: [...srv.exclusions],
        deliveryTarget: srv.deliveryTarget,
      });
    }
  }

  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const discountMinor = 0; // Promo codes can be validated server-side if present
  const taxMinor = 0; // Tax rate must be reviewed before applying
  const totalMinor = subtotalMinor - discountMinor + taxMinor;

  // Generate SHA-256 terms hash for immutability
  const termsPayload = JSON.stringify({
    items: items.map((i) => ({ sku: i.sku, total: i.lineTotalMinor, inclusions: i.inclusionsSnapshot })),
    totalMinor,
    ruleVersion: '2026-11-08-v1',
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
    ruleVersion: '2026-11-08-v1',
    termsHash,
    items,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    currency: 'BDT',
    eligibility,
    status,
  };
}
