import { describe, it, expect } from 'vitest';
import { calculateServerQuote, evaluateEligibility } from '../src/domain/pricing-engine';
import { findServiceBySku } from '../src/domain/catalog';

describe('Server Pricing & Eligibility Engine Tests (P0 Test Matrix)', () => {
  // Test 1: Visitor chooses Meta only -> ৳1,500 one time
  it('1. Calculates Meta Business Setup correctly at ৳1,500 (150,000 poisha)', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-01',
      businessName: 'Dhaka Artisans',
      businessProfile: {
        facebookPageStatus: 'none',
        metaPortfolioStatus: 'none',
        operatingModel: 'online_only_no_in_person',
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    expect(quote.totalMinor).toBe(150000);
    expect(quote.currency).toBe('BDT');
    expect(quote.items.length).toBe(1);
    expect(quote.items[0].sku).toBe('HI-SET-META');
    expect(quote.status).toBe('priced');
    expect(quote.eligibility.canSelfCheckout).toBe(true);
  });

  // Test 2: Visitor chooses Google only with eligible storefront -> ৳1,500
  it('2. Calculates Google Business Setup at ৳1,500 for eligible storefront', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-02',
      businessName: 'Gulshan Cafe & Bakery',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-SET-GOOGLE'],
      selectedAddonSkus: [],
    });

    expect(quote.totalMinor).toBe(150000);
    expect(quote.items[0].sku).toBe('HI-SET-GOOGLE');
    expect(quote.eligibility.isEligible).toBe(true);
    expect(quote.eligibility.canSelfCheckout).toBe(true);
    expect(quote.status).toBe('priced');
  });

  // Test 3: Pure online-only chooses Google -> cannot complete standard checkout
  it('3. Rejects Google Business Setup for pure online-only business without physical contact', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-03',
      businessName: 'Dropship Express BD',
      businessProfile: {
        operatingModel: 'online_only_no_in_person',
        hasPhysicalStorefront: false,
        conductsInPersonVisits: false,
      },
      selectedPlatformSkus: ['HI-SET-GOOGLE'],
      selectedAddonSkus: [],
    });

    expect(quote.eligibility.isEligible).toBe(false);
    expect(quote.eligibility.canSelfCheckout).toBe(false);
    expect(quote.status).toBe('requires_manual_scope');
    expect(
      quote.eligibility.flags.some((f) => f.code === 'GOOGLE_ONLINE_ONLY_INELIGIBLE')
    ).toBe(true);
  });

  // Test 4: LinkedIn Company Page -> ৳1,500
  it('4. Calculates LinkedIn Company Page at ৳1,500', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-04',
      businessName: 'Apex Advisory Group',
      businessProfile: {
        linkedInStatus: 'none',
      },
      selectedPlatformSkus: ['HI-SET-LINKEDIN'],
      selectedAddonSkus: [],
    });

    expect(quote.totalMinor).toBe(150000);
    expect(quote.items[0].sku).toBe('HI-SET-LINKEDIN');
    expect(quote.status).toBe('priced');
  });

  // Test 5: 3-Platform eligible bundle -> ৳3,000 exactly, not ৳4,500
  it('5. Charges exactly ৳3,000 (300,000 poisha) for 3-Platform bundle and does NOT double-charge individual services', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-05',
      businessName: 'Banani Dental Care',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-BUNDLE-3', 'HI-SET-META', 'HI-SET-GOOGLE'], // even if individual keys passed
      selectedAddonSkus: [],
    });

    expect(quote.totalMinor).toBe(300000);
    expect(quote.items.length).toBe(1);
    expect(quote.items[0].sku).toBe('HI-BUNDLE-3');
    expect(quote.status).toBe('priced');
    expect(quote.eligibility.canSelfCheckout).toBe(true);
  });

  // Test 6: 3-Platform bundle with ineligible Google -> scope intervention, blocks auto bundle
  it('6. Blocks 3-Platform bundle for Google-ineligible business and suggests alternative', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-06',
      businessName: 'Digital Software BD',
      businessProfile: {
        operatingModel: 'online_only_no_in_person',
        hasPhysicalStorefront: false,
        conductsInPersonVisits: false,
      },
      selectedPlatformSkus: ['HI-BUNDLE-3'],
      selectedAddonSkus: [],
    });

    expect(quote.eligibility.canSelfCheckout).toBe(false);
    expect(quote.status).toBe('requires_manual_scope');
    expect(quote.eligibility.recommendedAlternativeSku).toBe('HI-SET-META+HI-SET-LINKEDIN');
  });

  // Test 7: Meta (৳1,500) + Basic Static Creative (৳990) -> ৳2,490
  it('7. Combines Meta Setup (৳1,500) and Ad Creative (৳990) for exactly ৳2,490 (249,000 poisha)', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-07',
      businessName: 'Silk & Saree Boutique',
      businessProfile: {
        operatingModel: 'online_only_no_in_person',
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: ['HI-ADD-CREATIVE'],
    });

    expect(quote.totalMinor).toBe(249000);
    expect(quote.items.length).toBe(2);
    expect(quote.status).toBe('priced');
    expect(quote.eligibility.canSelfCheckout).toBe(true);
  });

  // Test 8: Meta Pixel chosen without active website -> blocked from checkout
  it('8. Blocks Pixel add-on when website is missing or CMS access is false', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-08',
      businessName: 'No Website Enterprise',
      businessProfile: {
        websiteUrl: '',
        websiteCmsAccess: false,
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: ['HI-ADD-PIXEL'],
    });

    expect(quote.eligibility.canSelfCheckout).toBe(false);
    expect(
      quote.eligibility.flags.some((f) => f.code === 'PIXEL_PREREQUISITE_MISSING')
    ).toBe(true);
  });

  // Test 9: Meta Policy Restriction / Dispute -> requires manual scope
  it('9. Intercepts Meta account restrictions and flags for manual scope', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-09',
      businessName: 'Restricted Page Owner',
      businessProfile: {
        facebookPageStatus: 'restricted',
        metaPortfolioStatus: 'restricted',
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    expect(quote.eligibility.canSelfCheckout).toBe(false);
    expect(quote.status).toBe('requires_manual_scope');
    expect(
      quote.eligibility.flags.some((f) => f.code === 'META_RESTRICTION_MANUAL_SCOPE')
    ).toBe(true);
  });

  // Test 10: Owner-Confirmed Delivery Timelines & Pricing Registry Reconciliation
  it('10. Reconciles all 7 live SKUs against owner-approved pricing and delivery targets (HOOOPLAAA_Service_Registry_2026-11-08.csv)', () => {
    const expectedRegistry = [
      { sku: 'HI-SET-META', priceMinor: 150000, deliveryTarget: '1–2 business days' },
      { sku: 'HI-SET-GOOGLE', priceMinor: 150000, deliveryTarget: '1–2 days submission' },
      { sku: 'HI-SET-LINKEDIN', priceMinor: 150000, deliveryTarget: '1 business day' },
      { sku: 'HI-BUNDLE-3', priceMinor: 300000, deliveryTarget: '2–4 business days' },
      { sku: 'HI-ADD-WA', priceMinor: 169000, deliveryTarget: '2 business days' },
      { sku: 'HI-ADD-PIXEL', priceMinor: 150000, deliveryTarget: 'Scope dependent (1–2 business days standard)' },
      { sku: 'HI-ADD-CREATIVE', priceMinor: 99000, deliveryTarget: '1–2 business days' },
    ];

    for (const expected of expectedRegistry) {
      const item = findServiceBySku(expected.sku);
      expect(item).toBeDefined();
      expect(item?.basePriceMinor).toBe(expected.priceMinor);
      expect(item?.deliveryTarget).toBe(expected.deliveryTarget);
      expect(item?.ownerConfirmedPrice).toBe(true);
      expect(item?.checkoutEnabled).toBe(true);
    }
  });
});
