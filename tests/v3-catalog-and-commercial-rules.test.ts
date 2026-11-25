import { describe, it, expect } from 'vitest';
import {
  V3_BUNDLES,
  V3_CORE_SERVICES,
  V3_DEPARTMENTS,
  V3_SPECIALIZED_ADDONS,
  V3_STOREFRONT_CATALOG,
  V3_VARIANTS,
  findServiceBySku,
  getActivePricingWindow,
} from '../src/domain/catalog';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { PARTNER_ECOSYSTEM_BOUNDARIES } from '../src/domain/brand-v3';

describe('HOOOPLAAA Brand Book v3.0 & Commercial Catalog Rev 4.4 Verification', () => {
  it('1. Enforces exact 57 approved price rows across 6 departments (26 core + 6 variants + 3 bundles + 22 add-ons)', () => {
    expect(V3_DEPARTMENTS).toHaveLength(6);
    expect(V3_CORE_SERVICES).toHaveLength(26);
    expect(V3_VARIANTS).toHaveLength(6);
    expect(V3_BUNDLES).toHaveLength(3);
    expect(V3_SPECIALIZED_ADDONS).toHaveLength(22);
    expect(V3_STOREFRONT_CATALOG).toHaveLength(57);
  });

  it('2. Verifies exact regular & 2026 launch prices on canonical rows across all categories', () => {
    const checks: Array<{ sku: string; regularMinor: number; launchMinor: number }> = [
      { sku: 'B01', regularMinor: 350000, launchMinor: 150000 },
      { sku: 'B04', regularMinor: 250000, launchMinor: 149000 },
      { sku: 'A01-MODE-1', regularMinor: 790000, launchMinor: 479000 },
      { sku: 'A01-MODE-2', regularMinor: 1190000, launchMinor: 749000 },
      { sku: 'V01-MODE-3', regularMinor: 249000, launchMinor: 99000 },
      { sku: 'V01-MODE-4', regularMinor: 479000, launchMinor: 199000 },
      { sku: 'V01-MODE-5', regularMinor: 749000, launchMinor: 349000 },
      { sku: 'V01-MODE-6', regularMinor: 1290000, launchMinor: 619000 },
      { sku: 'L01', regularMinor: 1190000, launchMinor: 679000 },
      { sku: 'I10', regularMinor: 990000, launchMinor: 569000 },
      { sku: 'T01', regularMinor: 390000, launchMinor: 169000 },
      { sku: 'PK01', regularMinor: 890000, launchMinor: 300000 },
      { sku: 'PK02', regularMinor: 1990000, launchMinor: 1099000 },
      { sku: 'PK03', regularMinor: 990000, launchMinor: 459000 },
      { sku: 'X05', regularMinor: 1190000, launchMinor: 749000 },
      { sku: 'X22', regularMinor: 299000, launchMinor: 169000 },
    ];

    for (const c of checks) {
      const srv = findServiceBySku(c.sku);
      expect(srv, `Missing SKU ${c.sku}`).toBeDefined();
      expect(srv?.regularPriceMinor).toBe(c.regularMinor);
      expect(srv?.launchPriceMinor).toBe(c.launchMinor);
    }
  });

  it('3. Auto-switches between 2026 Launch Offer (20 Nov–31 Dec 2026 Asia/Dhaka) and Standard List Rates', () => {
    const beforeLaunch = new Date('2026-11-19T23:59:59+06:00');
    const insideLaunch = new Date('2026-11-24T12:00:00+06:00');
    const lastSecondLaunch = new Date('2026-12-31T23:59:59+06:00');
    const afterLaunch = new Date('2027-01-01T00:00:00+06:00');

    expect(getActivePricingWindow(beforeLaunch).isLaunchActive).toBe(false);
    expect(getActivePricingWindow(insideLaunch).isLaunchActive).toBe(true);
    expect(getActivePricingWindow(lastSecondLaunch).isLaunchActive).toBe(true);
    expect(getActivePricingWindow(afterLaunch).isLaunchActive).toBe(false);

    const launchQuote = calculateServerQuote({
      businessId: 'biz-win-1',
      businessName: 'Dhaka Studio',
      businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
      selectedPlatformSkus: ['PK01'],
      selectedAddonSkus: [],
      evaluatedAt: insideLaunch,
    });
    expect(launchQuote.pricingTierApplied).toBe('launch_2026');
    expect(launchQuote.totalMinor).toBe(300000); // ৳3,000 Launch
    expect(launchQuote.standardSubtotalMinor).toBe(890000); // ৳8,900 Standard List

    const standardQuote = calculateServerQuote({
      businessId: 'biz-win-2',
      businessName: 'Dhaka Studio',
      businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
      selectedPlatformSkus: ['PK01'],
      selectedAddonSkus: [],
      evaluatedAt: afterLaunch,
    });
    expect(standardQuote.pricingTierApplied).toBe('standard_list');
    expect(standardQuote.totalMinor).toBe(890000); // ৳8,900 Standard List
  });

  it('4. Deduplicates bundle components automatically across PK01, PK02, and PK03', () => {
    const insideLaunch = new Date('2026-11-24T12:00:00+06:00');

    const quote = calculateServerQuote({
      businessId: 'biz-dedup',
      businessName: 'Multi-Department Co',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        websiteUrl: 'https://example.com',
        websiteCmsAccess: true,
      },
      selectedPlatformSkus: ['PK01', 'B01', 'B02', 'PK02', 'I01', 'I10', 'PK03', 'T01'],
      selectedAddonSkus: [],
      evaluatedAt: insideLaunch,
    });

    const skus = quote.items.map((i) => i.sku);
    expect(skus).toEqual(['PK01', 'PK02', 'PK03']);
    // 300,000 + 1,099,000 + 459,000 = 1,858,000 poisha (৳18,580)
    expect(quote.totalMinor).toBe(1858000);
    expect(quote.deduplicationNotes?.length).toBeGreaterThanOrEqual(5);
  });

  it('5. Enforces X05 alias non-double-billing when A01-MODE-2 is selected', () => {
    const insideLaunch = new Date('2026-11-24T12:00:00+06:00');

    const quote = calculateServerQuote({
      businessId: 'biz-alias',
      businessName: 'Ad Performance Co',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['A01-MODE-2'],
      selectedAddonSkus: ['X05'],
      evaluatedAt: insideLaunch,
    });

    expect(quote.items.map((i) => i.sku)).toEqual(['A01-MODE-2']);
    expect(quote.totalMinor).toBe(749000); // ৳7,490 once, never doubled
    expect(quote.deduplicationNotes?.some((n) => n.includes('X05'))).toBe(true);
    expect(quote.subscriptionRenewalNotices?.length).toBe(1);
    expect(quote.subscriptionRenewalNotices?.[0].standardMonthlyMinor).toBe(1190000);
  });

  it('6. Emits explicit first-month-only renewal notices for HOOOPLAAA VA+ tiers and preserves partner boundaries', () => {
    const insideLaunch = new Date('2026-11-24T12:00:00+06:00');
    const quote = calculateServerQuote({
      businessId: 'biz-va',
      businessName: 'Growth Ops BD',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['V01-MODE-5'], // Pro
      selectedAddonSkus: [],
      evaluatedAt: insideLaunch,
    });

    expect(quote.totalMinor).toBe(349000); // ৳3,490 Launch Month 1
    expect(quote.subscriptionRenewalNotices?.[0].launchFirstMonthMinor).toBe(349000);
    expect(quote.subscriptionRenewalNotices?.[0].standardMonthlyMinor).toBe(749000);

    // Partner boundaries cleanly distinguish owned vs separate partner companies
    expect(PARTNER_ECOSYSTEM_BOUNDARIES.map((p) => p.brand)).toEqual([
      'HOOOPLAAA INCORPORATED',
      'Freakin’s Studio',
      'NotRealEngine',
      'How To Keep It Simple (HTKIS)',
    ]);
  });
});
