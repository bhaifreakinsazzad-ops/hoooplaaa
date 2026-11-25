'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  V3_BUNDLES,
  V3_CORE_SERVICES,
  V3_DEPARTMENTS,
  V3_SPECIALIZED_ADDONS,
  V3_VARIANTS,
  findServiceBySku,
  formatBdt,
  getActivePricingWindow,
  getEffectivePriceMinor,
} from '@/domain/catalog';
import { BRAND_V3 } from '@/domain/brand-v3';
import { QuoteSnapshot } from '@/domain/types';
import { useApp } from '@/components/providers/AppProviders';
import { useT } from '@/lib/i18n';
import { AnimatedBdtCounter } from '@/components/motion/AnimeMotion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';

const BUNDLE_MAP: Record<string, string[]> = {
  PK01: ['B01', 'B02', 'B03'],
  PK02: ['I01', 'I06', 'I10'],
  PK03: ['T01', 'T02'],
};

export function ConfiguratorWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useApp();
  const { t } = useT();

  const [step, setStep] = useState<number>(1);
  const [activeDeptTab, setActiveDeptTab] = useState<string>(V3_DEPARTMENTS[0].id);
  const [activeAddonGroup, setActiveAddonGroup] = useState<string>('Advertising');

  // Step 1: Business Profile & Eligibility State
  const [businessName, setBusinessName] = useState<string>('');
  const [operatingModel, setOperatingModel] = useState<
    'in_person_storefront' | 'service_area_in_person' | 'online_only_no_in_person'
  >('in_person_storefront');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [websiteCmsAccess, setWebsiteCmsAccess] = useState<boolean>(true);
  const [facebookPageStatus, setFacebookPageStatus] = useState<
    'none' | 'existing_unclaimed' | 'existing_claimed' | 'restricted'
  >('none');

  // Step 2 & 3: Selected SKUs
  const [selectedPrimarySkus, setSelectedPrimarySkus] = useState<string[]>(['PK01']);
  const [selectedAddonSkus, setSelectedAddonSkus] = useState<string[]>([]);

  // Step 4: Server Quote State
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renewalConsent, setRenewalConsent] = useState<boolean>(false);

  const pricingWindow = getActivePricingWindow();

  // Initialize selections cleanly from URL params (?preset=PK01|PK02|PK03|bundle, ?sku=B01..X22)
  useEffect(() => {
    const preset = searchParams.get('preset');
    const skuParam = searchParams.get('sku') || searchParams.get('variant');

    if (preset) {
      if (preset === 'bundle' || preset === 'PK01') {
        setSelectedPrimarySkus(['PK01']);
      } else if (preset === 'PK02' || preset === 'PK03') {
        setSelectedPrimarySkus([preset]);
      }
      return;
    }

    if (skuParam) {
      const found = findServiceBySku(skuParam);
      if (found && found.checkoutEnabled) {
        if (found.catalogKind === 'specialized_addon') {
          setSelectedAddonSkus([found.sku]);
          setSelectedPrimarySkus([]);
        } else {
          setSelectedPrimarySkus([found.sku]);
          if (found.categoryId) setActiveDeptTab(found.categoryId);
        }
      }
    }
  }, [searchParams]);

  const togglePrimarySku = (sku: string) => {
    setSelectedPrimarySkus((prev) => {
      const exists = prev.includes(sku);
      if (exists) {
        return prev.filter((s) => s !== sku);
      }

      let next = [...prev, sku];

      // If selecting a signature bundle, remove its individual component SKUs automatically
      if (BUNDLE_MAP[sku]) {
        const comps = new Set(BUNDLE_MAP[sku]);
        next = next.filter((s) => !comps.has(s));
      } else {
        // If selecting an individual component already covered by an active bundle, switch off the conflicting bundle
        for (const [bundleCode, comps] of Object.entries(BUNDLE_MAP)) {
          if (comps.includes(sku) && next.includes(bundleCode)) {
            next = next.filter((s) => s !== bundleCode);
          }
        }
      }

      // Keep VA+ tiers mutually exclusive for clarity
      if (sku.startsWith('V01-MODE-')) {
        next = next.filter((s) => s === sku || !s.startsWith('V01-MODE-'));
      }
      // Keep A01 modes clean (suppress bare A01 if choosing a specific mode)
      if (sku.startsWith('A01-MODE-')) {
        next = next.filter((s) => s !== 'A01');
      }
      // If selecting A01-MODE-2, suppress X05 alias from add-ons
      if (sku === 'A01-MODE-2') {
        setSelectedAddonSkus((addons) => addons.filter((a) => a !== 'X05'));
      }

      return next;
    });
  };

  const toggleAddonSku = (sku: string) => {
    // Alias protection: prevent selecting X05 if A01-MODE-2 is active
    if (sku === 'X05' && selectedPrimarySkus.includes('A01-MODE-2')) {
      return;
    }
    setSelectedAddonSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  // Client-side live preview (authoritative calculation happens on server at Step 4!)
  const liveEstimate = useMemo(() => {
    const allSkus = Array.from(new Set([...selectedPrimarySkus, ...selectedAddonSkus]));
    const items = allSkus
      .map((sku) => findServiceBySku(sku))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const effectiveTotal = items.reduce((acc, item) => acc + getEffectivePriceMinor(item), 0);
    const standardTotal = items.reduce(
      (acc, item) => acc + (item.regularPriceMinor ?? item.basePriceMinor),
      0
    );
    const hasMonthly = items.some((i) => i.billingPeriod === 'monthly');
    return { items, effectiveTotal, standardTotal, hasMonthly };
  }, [selectedPrimarySkus, selectedAddonSkus]);

  const handleGenerateQuote = async () => {
    setErrorMsg(null);
    if (!businessName.trim()) {
      setErrorMsg(
        locale === 'bn'
          ? 'কোট তৈরির জন্য ব্যবসার নাম আবশ্যক।'
          : 'Please enter your Business / Brand Name in Step 1.'
      );
      setStep(1);
      return;
    }

    if (selectedPrimarySkus.length === 0 && selectedAddonSkus.length === 0) {
      setErrorMsg(
        locale === 'bn'
          ? 'অন্তত একটি সার্ভিস, বান্ডেল বা অ্যাড-অন নির্বাচন করুন।'
          : 'Please select at least one service, bundle, or specialist add-on.'
      );
      setStep(2);
      return;
    }

    setLoading(true);
    setRenewalConsent(false);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessProfile: {
            operatingModel,
            hasPhysicalStorefront: operatingModel === 'in_person_storefront',
            conductsInPersonVisits: operatingModel !== 'online_only_no_in_person',
            websiteUrl: websiteUrl.trim(),
            websiteCmsAccess,
            facebookPageStatus,
            metaPortfolioStatus: facebookPageStatus === 'restricted' ? 'restricted' : 'none',
          },
          selectedPlatformSkus: selectedPrimarySkus,
          selectedAddonSkus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not calculate server quote.');
      }
      setQuote(data.quote);
      setStep(4);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error calculating quote.');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestedAlternative = (alt: string) => {
    if (alt === 'B01+B03') {
      setSelectedPrimarySkus(['B01', 'B03']);
      setStep(2);
    } else if (alt === 'HI-SET-META+HI-SET-LINKEDIN') {
      setSelectedPrimarySkus(['HI-SET-META', 'HI-SET-LINKEDIN']);
      setStep(2);
    }
  };

  const departmentServices = useMemo(
    () => V3_CORE_SERVICES.filter((s) => s.categoryId === activeDeptTab),
    [activeDeptTab]
  );

  const groupedAddons = useMemo(
    () => V3_SPECIALIZED_ADDONS.filter((a) => a.addonGroup === activeAddonGroup),
    [activeAddonGroup]
  );

  const needsRenewalConsent = Boolean(
    quote?.subscriptionRenewalNotices && quote.subscriptionRenewalNotices.length > 0
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Progress Bar & Step Header */}
      <div className="mb-8 border border-brand-hairline bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-brand-forest">
          <span>{t(`step${step}` as 'step1' | 'step2' | 'step3' | 'step4')}</span>
          <span className="text-brand-emerald">
            {locale === 'bn' ? pricingWindow.labelBn : pricingWindow.labelEn}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step}
          aria-label="Package configuration progress"
          className="mt-3 h-1.5 w-full bg-brand-ivory"
        >
          <div
            className="h-full bg-brand-gold transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] font-medium">
          {[
            { num: 1, en: '1. Business Profile', bn: '১. ব্যবসা তথ্য' },
            { num: 2, en: '2. Bundles & Services', bn: '২. বান্ডেল ও সার্ভিস' },
            { num: 3, en: '3. Specialist Add-ons', bn: '৩. অ্যাড-অন' },
            { num: 4, en: '4. Authoritative Quote', bn: '৪. সার্ভার কোট' },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (item.num < 4 || quote) setStep(item.num);
              }}
              className={`text-left transition-colors ${
                step === item.num
                  ? 'font-bold text-brand-forest'
                  : item.num < step
                  ? 'text-brand-emerald hover:underline'
                  : 'text-brand-muted'
              }`}
            >
              {locale === 'bn' ? item.bn : item.en}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 flex items-start gap-3 border border-amber-700/40 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Step Canvas */}
        <div className="lg:col-span-8">
          {/* ======================== STEP 1: BUSINESS PROFILE ======================== */}
          {step === 1 && (
            <div className="border border-brand-hairline bg-white p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                  {t('step1')}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-forest">
                  {locale === 'bn'
                    ? 'ব্যবসার প্রোফাইল ও এলিজিবিলিটি যাচাই'
                    : 'Business Profile & Automated Eligibility Check'}
                </h2>
                <p className="mt-1 text-sm text-brand-muted">
                  {locale === 'bn'
                    ? 'আমরা Google, Meta এবং ওয়েবসাইট ট্র্যাকিং নীতিমালা আগেই যাচাই করি যাতে কোনো অযোগ্য অর্ডার না হয়।'
                    : 'We validate Google Business Profile, Meta account health, and website CMS access upfront before issuing an authoritative quote.'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="business-name-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-brand-forest"
                >
                  {t('businessNameLabel')}
                </label>
                <input
                  id="business-name-input"
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Gulshan Heritage Bakery or Bengal Tech Labs"
                  className="mt-2 w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-3 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                  {t('operatingModelLabel')}
                </label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      id: 'in_person_storefront',
                      title: 'Physical Storefront',
                      desc: 'Customers visit our shop, office, or studio in person.',
                    },
                    {
                      id: 'service_area_in_person',
                      title: 'Local Service Area',
                      desc: 'Our team visits customers at their location.',
                    },
                    {
                      id: 'online_only_no_in_person',
                      title: 'Pure Online Only',
                      desc: 'No in-person contact (ineligible for Google Business Profile).',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setOperatingModel(
                          opt.id as
                            | 'in_person_storefront'
                            | 'service_area_in_person'
                            | 'online_only_no_in_person'
                        )
                      }
                      className={`border p-4 text-left transition-colors ${
                        operatingModel === opt.id
                          ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                          : 'border-brand-hairline bg-brand-ivory/30 text-brand-ink hover:border-brand-gold'
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.title}</p>
                      <p
                        className={`mt-1 text-xs leading-relaxed ${
                          operatingModel === opt.id ? 'text-brand-platinum/80' : 'text-brand-muted'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="website-url-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-brand-forest"
                  >
                    {t('websiteUrlLabel')}
                  </label>
                  <input
                    id="website-url-input"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    className="mt-2 w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                  />
                  <label className="mt-2.5 flex items-center gap-2 text-xs text-brand-muted">
                    <input
                      type="checkbox"
                      checked={websiteCmsAccess}
                      onChange={(e) => setWebsiteCmsAccess(e.target.checked)}
                      className="accent-brand-forest"
                    />
                    <span>I have website CMS / Tag Manager / code access</span>
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="fb-status-select"
                    className="block text-xs font-semibold uppercase tracking-wider text-brand-forest"
                  >
                    {t('facebookPageStatusLabel')}
                  </label>
                  <select
                    id="fb-status-select"
                    value={facebookPageStatus}
                    onChange={(e) =>
                      setFacebookPageStatus(
                        e.target.value as
                          | 'none'
                          | 'existing_unclaimed'
                          | 'existing_claimed'
                          | 'restricted'
                      )
                    }
                    className="mt-2 w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                  >
                    <option value="none">No existing Facebook Page yet</option>
                    <option value="existing_claimed">Existing active Page in good standing</option>
                    <option value="existing_unclaimed">Existing Page needs Business Portfolio linking</option>
                    <option value="restricted">Account/Page currently restricted or disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end border-t border-brand-hairline pt-5">
                <button
                  type="button"
                  onClick={() => {
                    if (!businessName.trim()) {
                      setErrorMsg('Please enter your Business / Brand Name to continue.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(2);
                  }}
                  className="inline-flex items-center gap-2 bg-brand-forest px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-ivory hover:bg-brand-teal"
                >
                  <span>{t('continuePlatform')}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================== STEP 2: BUNDLES, MODES, VA+ & 6 DEPARTMENTS ======================== */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Signature Bundles */}
              <div className="border border-brand-hairline bg-white p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                  {t('step2')} · Signature Bundles (Auto-Deduplicated)
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-forest">
                  Select Signature Bundles, Managed Tiers, or Core Services
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {V3_BUNDLES.map((b) => {
                    const selected = selectedPrimarySkus.includes(b.sku);
                    const eff = getEffectivePriceMinor(b);
                    const reg = b.regularPriceMinor ?? b.basePriceMinor;
                    return (
                      <button
                        key={b.sku}
                        type="button"
                        onClick={() => togglePrimarySku(b.sku)}
                        aria-pressed={selected}
                        className={`flex flex-col justify-between border p-4 text-left transition-colors ${
                          selected
                            ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                            : 'border-brand-hairline bg-brand-ivory/35 text-brand-ink hover:border-brand-gold'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                selected ? 'text-brand-gold' : 'text-brand-emerald'
                              }`}
                            >
                              {b.sku} · {b.bundleComponents?.join('+')}
                            </span>
                            {selected && <Check className="h-4 w-4 text-brand-gold" />}
                          </div>
                          <p className="mt-1.5 font-serif text-base font-semibold">
                            {locale === 'bn' ? b.nameBn : b.name}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-current/15">
                          <p className="tabular-price text-xl font-bold">{formatBdt(eff)}</p>
                          {pricingWindow.isLaunchActive && (
                            <p className="tabular-price text-[11px] opacity-70">
                              Standard List: {formatBdt(reg)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advertising Modes & HOOOPLAAA VA+ Tiers */}
              <div className="border border-brand-hairline bg-white p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                  Delivery Modes & Monthly VA+ Tiers
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {V3_VARIANTS.map((v) => {
                    const selected = selectedPrimarySkus.includes(v.sku);
                    const eff = getEffectivePriceMinor(v);
                    const reg = v.regularPriceMinor ?? v.basePriceMinor;
                    return (
                      <button
                        key={v.sku}
                        type="button"
                        onClick={() => togglePrimarySku(v.sku)}
                        aria-pressed={selected}
                        className={`flex items-start justify-between gap-3 border p-4 text-left transition-colors ${
                          selected
                            ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                            : 'border-brand-hairline bg-brand-ivory/25 text-brand-ink hover:border-brand-gold'
                        }`}
                      >
                        <div>
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              selected ? 'text-brand-softgold' : 'text-brand-emerald'
                            }`}
                          >
                            {v.sku} · {v.billingPeriod === 'monthly' ? 'Monthly (1st mo offer)' : 'One-time'}
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {locale === 'bn' ? v.nameBn : v.name}
                          </p>
                          {v.allowance && (
                            <p className="mt-0.5 text-[11px] opacity-80">{v.allowance}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular-price text-base font-bold">
                            {formatBdt(eff)}
                            {v.billingPeriod === 'monthly' ? '/mo' : ''}
                          </p>
                          {pricingWindow.isLaunchActive && (
                            <p className="tabular-price text-[10px] opacity-70">
                              Std {formatBdt(reg)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6 Departments Individual Core Services */}
              <div className="border border-brand-hairline bg-white p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                  Individual Core Services (26 Services Across 6 Departments)
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {V3_DEPARTMENTS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActiveDeptTab(d.id)}
                      className={`border px-3 py-1.5 text-xs font-medium ${
                        activeDeptTab === d.id
                          ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                          : 'border-brand-hairline bg-brand-ivory/40 text-brand-ink hover:border-brand-gold'
                      }`}
                    >
                      {d.code}. {locale === 'bn' ? d.nameBn : d.name}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {departmentServices.map((srv) => {
                    const selected = selectedPrimarySkus.includes(srv.sku);
                    const coveredByBundle = Object.entries(BUNDLE_MAP).find(
                      ([bCode, comps]) =>
                        selectedPrimarySkus.includes(bCode) && comps.includes(srv.sku)
                    )?.[0];
                    const eff = getEffectivePriceMinor(srv);
                    const reg = srv.regularPriceMinor ?? srv.basePriceMinor;

                    return (
                      <button
                        key={srv.sku}
                        type="button"
                        onClick={() => togglePrimarySku(srv.sku)}
                        aria-pressed={selected}
                        className={`flex items-start justify-between gap-3 border p-4 text-left transition-colors ${
                          selected
                            ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                            : coveredByBundle
                            ? 'border-brand-emerald/40 bg-brand-ivory/70 text-brand-ink'
                            : 'border-brand-hairline bg-white text-brand-ink hover:border-brand-gold'
                        }`}
                      >
                        <div>
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              selected ? 'text-brand-gold' : 'text-brand-emerald'
                            }`}
                          >
                            {srv.sku}
                            {coveredByBundle ? ` · Included in ${coveredByBundle}` : ''}
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {locale === 'bn' ? srv.nameBn : srv.name}
                          </p>
                          <p className="mt-1 text-xs opacity-75 line-clamp-2">
                            {locale === 'bn' ? srv.shortDescriptionBn : srv.shortDescription}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular-price text-sm font-bold">
                            {srv.isFromPrice ? 'From ' : ''}
                            {formatBdt(eff)}
                          </p>
                          {pricingWindow.isLaunchActive && (
                            <p className="tabular-price text-[10px] opacity-65">
                              Std {formatBdt(reg)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-brand-hairline pt-5">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 border border-brand-forest/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-forest hover:bg-brand-ivory"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 bg-brand-forest px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-ivory hover:bg-brand-teal"
                  >
                    <span>{t('continueAddons')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================== STEP 3: 22 SPECIALIST ADD-ONS (X01–X22) ======================== */}
          {step === 3 && (
            <div className="border border-brand-hairline bg-white p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                {t('step3')}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-forest">
                {t('addOnHeading')}
              </h2>
              <p className="mt-1 text-sm text-brand-muted">{t('addOnDescription')}</p>

              {/* Group Switcher */}
              <div className="mt-5 flex flex-wrap gap-2">
                {['Advertising', 'VA+', 'Leads & CRM', 'Tracking'].map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setActiveAddonGroup(grp)}
                    className={`border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                      activeAddonGroup === grp
                        ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                        : 'border-brand-hairline bg-brand-ivory/40 text-brand-ink hover:border-brand-gold'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {groupedAddons.map((addon) => {
                  const selected = selectedAddonSkus.includes(addon.sku);
                  const blockedByAlias =
                    addon.sku === 'X05' && selectedPrimarySkus.includes('A01-MODE-2');
                  const eff = getEffectivePriceMinor(addon);
                  const reg = addon.regularPriceMinor ?? addon.basePriceMinor;

                  return (
                    <button
                      key={addon.sku}
                      type="button"
                      disabled={blockedByAlias}
                      onClick={() => toggleAddonSku(addon.sku)}
                      aria-pressed={selected}
                      className={`flex w-full items-start justify-between gap-4 border p-4 text-left transition-colors ${
                        blockedByAlias
                          ? 'cursor-not-allowed border-brand-hairline bg-brand-ivory/70 opacity-65'
                          : selected
                          ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                          : 'border-brand-hairline bg-white text-brand-ink hover:border-brand-gold'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-[10px] font-semibold uppercase tracking-wider ${
                            selected ? 'text-brand-gold' : 'text-brand-emerald'
                          }`}
                        >
                          {addon.sku} · {addon.billingPeriod === 'monthly' ? 'Monthly' : 'One-time'}
                          {blockedByAlias ? ' · Already selected via A01-MODE-2' : ''}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {locale === 'bn' ? addon.nameBn : addon.name}
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          {locale === 'bn' ? addon.shortDescriptionBn : addon.shortDescription}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-price text-base font-bold">
                          {formatBdt(eff)}
                          {addon.billingPeriod === 'monthly' ? '/mo' : ''}
                        </p>
                        {pricingWindow.isLaunchActive && (
                          <p className="tabular-price text-[10px] opacity-65">
                            Std {formatBdt(reg)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-brand-hairline pt-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 border border-brand-forest/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-forest hover:bg-brand-ivory"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGenerateQuote}
                  className="inline-flex items-center gap-2 bg-brand-gold px-7 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold disabled:opacity-60"
                >
                  <span>{loading ? 'Calculating Authoritative Quote...' : t('generateQuote')}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================== STEP 4: AUTHORITATIVE SERVER QUOTE ======================== */}
          {step === 4 && quote && (
            <div className="border border-brand-hairline bg-white p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-hairline pb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                    {quote.id} · {quote.pricingWindow?.labelEn || 'Authoritative Server Quote'}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-forest">
                    Authoritative Quote for {quote.businessName}
                  </h2>
                  <p className="mt-1 text-xs text-brand-muted">
                    Rule version {quote.ruleVersion} · Immutable SHA-256 hash:{' '}
                    <code className="font-mono text-[11px]">{quote.termsHash.slice(0, 16)}…</code>
                  </p>
                </div>
                <span
                  className={`border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    quote.eligibility.canSelfCheckout
                      ? 'border-brand-emerald/40 bg-emerald-50 text-brand-emerald'
                      : 'border-amber-600/40 bg-amber-50 text-amber-800'
                  }`}
                >
                  {quote.eligibility.canSelfCheckout ? 'Ready for Checkout' : 'Manual Scope Review'}
                </span>
              </div>

              {/* Deduplication Notes */}
              {quote.deduplicationNotes && quote.deduplicationNotes.length > 0 && (
                <div className="border border-brand-emerald/35 bg-brand-ivory p-4 text-xs text-brand-ink space-y-1">
                  <p className="font-semibold uppercase tracking-wider text-brand-emerald">
                    Automatic Deduplication Applied
                  </p>
                  {quote.deduplicationNotes.map((note, idx) => (
                    <p key={idx}>• {note}</p>
                  ))}
                </div>
              )}

              {/* Eligibility Flags */}
              {quote.eligibility.flags.length > 0 && (
                <div className="space-y-2.5" aria-live="polite">
                  {quote.eligibility.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 border p-4 text-xs leading-relaxed ${
                        flag.severity === 'blocker'
                          ? 'border-amber-700/40 bg-amber-50 text-amber-950'
                          : 'border-brand-hairline bg-brand-ivory/60 text-brand-ink'
                      }`}
                    >
                      {flag.severity === 'blocker' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald" />
                      )}
                      <div>
                        <p className="font-semibold">{flag.code}</p>
                        <p className="mt-0.5">{locale === 'bn' ? flag.messageBn : flag.message}</p>
                      </div>
                    </div>
                  ))}

                  {quote.eligibility.recommendedAlternativeSku && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border border-brand-gold/50 bg-brand-ivory p-4 text-xs">
                      <span>
                        Suggested eligible configuration:{' '}
                        <strong>{quote.eligibility.recommendedAlternativeSku}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          applySuggestedAlternative(quote.eligibility.recommendedAlternativeSku!)
                        }
                        className="bg-brand-forest px-4 py-2 font-semibold uppercase tracking-wider text-brand-ivory hover:bg-brand-teal"
                      >
                        Switch to Eligible Services
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Itemized Server Quote Breakdown */}
              <div className="divide-y divide-brand-hairline border border-brand-hairline">
                {quote.items.map((item) => (
                  <div key={item.sku} className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-emerald">
                        {item.sku} · {item.billingPeriod.replace('_', ' ')} · {item.deliveryTarget}
                      </p>
                      <p className="mt-0.5 font-semibold text-brand-forest">
                        {locale === 'bn' ? item.nameBn : item.name}
                      </p>
                      {item.offerPolicy && (
                        <p className="mt-1 text-xs text-brand-muted">{item.offerPolicy}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular-price text-base font-bold text-brand-forest">
                        {formatBdt(item.lineTotalMinor)}
                      </p>
                      {item.regularUnitPriceMinor &&
                        item.regularUnitPriceMinor > item.unitPriceMinor && (
                          <p className="tabular-price text-[11px] text-brand-muted">
                            Standard List: {formatBdt(item.regularUnitPriceMinor)}
                          </p>
                        )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Subscription Renewal Disclosure & Consent */}
              {needsRenewalConsent && quote.subscriptionRenewalNotices && (
                <div className="border border-brand-gold/50 bg-brand-ivory p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-forest">
                    Monthly Service Renewal Disclosure (Required)
                  </p>
                  <ul className="space-y-1.5 text-xs text-brand-ink">
                    {quote.subscriptionRenewalNotices.map((n) => (
                      <li key={n.sku}>• {locale === 'bn' ? n.noticeBn : n.noticeEn}</li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2.5 pt-2 text-xs font-medium text-brand-forest">
                    <input
                      type="checkbox"
                      checked={renewalConsent}
                      onChange={(e) => setRenewalConsent(e.target.checked)}
                      className="mt-0.5 accent-brand-forest"
                    />
                    <span>
                      I acknowledge that the 2026 Launch Offer applies to Month 1 only, and any
                      subsequent month renews at the stated Standard List Rate only with my consent.
                    </span>
                  </label>
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-brand-hairline pt-4 space-y-2 text-sm">
                {typeof quote.standardSubtotalMinor === 'number' &&
                  quote.standardSubtotalMinor > quote.totalMinor && (
                    <div className="flex justify-between text-xs text-brand-muted">
                      <span>Planned Standard List Total</span>
                      <span className="tabular-price">{formatBdt(quote.standardSubtotalMinor)}</span>
                    </div>
                  )}
                {typeof quote.launchSavingsMinor === 'number' && quote.launchSavingsMinor > 0 && (
                  <div className="flex justify-between text-xs font-medium text-brand-emerald">
                    <span>2026 Launch Offer Difference</span>
                    <span className="tabular-price">−{formatBdt(quote.launchSavingsMinor)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-brand-hairline pt-3 text-lg font-bold text-brand-forest">
                  <span>Authoritative Total Payable Now</span>
                  <span className="tabular-price">{formatBdt(quote.totalMinor)}</span>
                </div>
              </div>

              {/* Step 4 Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-brand-hairline pt-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border border-brand-forest/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-forest hover:bg-brand-ivory"
                >
                  {t('modifySelections')}
                </button>

                {quote.eligibility.canSelfCheckout ? (
                  <button
                    type="button"
                    disabled={needsRenewalConsent && !renewalConsent}
                    onClick={() => router.push(`/checkout/${quote.id}`)}
                    className="inline-flex items-center gap-2 bg-brand-gold px-7 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{t('proceedCheckout')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <Link
                    href="/audit"
                    className="inline-flex items-center gap-2 bg-brand-forest px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-ivory hover:bg-brand-teal"
                  >
                    <span>{t('requestScope')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Midnight Forest Live Estimate Sidebar */}
        <aside className="lg:col-span-4">
          <div className="sticky top-24 border border-brand-gold/35 bg-brand-forest p-6 text-brand-platinum shadow-forest-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
              {pricingWindow.isLaunchActive ? '2026 Launch Estimate' : 'Standard Estimate'}
            </p>

            <div className="mt-2 flex items-baseline justify-between border-b border-brand-teal pb-4">
              <AnimatedBdtCounter
                amountMinor={quote ? quote.totalMinor : liveEstimate.effectiveTotal}
                className="text-4xl font-bold text-brand-ivory"
              />
              {pricingWindow.isLaunchActive &&
                liveEstimate.standardTotal > liveEstimate.effectiveTotal && (
                  <span className="tabular-price text-xs text-brand-platinum/70">
                    Std {formatBdt(liveEstimate.standardTotal)}
                  </span>
                )}
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-platinum/70">
                Selected Items ({liveEstimate.items.length})
              </p>

              {liveEstimate.items.length === 0 ? (
                <p className="mt-2 text-xs text-brand-platinum/65">
                  No services selected yet. Choose bundles, tiers, or core services in Step 2.
                </p>
              ) : (
                <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1 text-xs">
                  {liveEstimate.items.map((item) => (
                    <li
                      key={item.sku}
                      className="flex items-start justify-between gap-2 border-b border-brand-teal/70 pb-2"
                    >
                      <div>
                        <span className="font-semibold text-brand-softgold">{item.sku}</span>{' '}
                        <span className="text-brand-ivory">{item.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular-price font-semibold text-brand-ivory">
                          {formatBdt(getEffectivePriceMinor(item))}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.sku}`}
                          onClick={() => {
                            setSelectedPrimarySkus((p) => p.filter((s) => s !== item.sku));
                            setSelectedAddonSkus((a) => a.filter((s) => s !== item.sku));
                          }}
                          className="text-brand-platinum/55 hover:text-brand-gold"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-brand-teal pt-4 text-[11px] leading-relaxed text-brand-platinum/75">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold" />
                <span>
                  Final checkout totals are always recalculated and signed server-side via{' '}
                  <code>/api/quote</code>.
                </span>
              </div>
              <p>{BRAND_V3.commercialWindow.standardNoteEn}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
