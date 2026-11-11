'use client';

import React, { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { useApp } from '../providers/AppProviders';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import { BusinessProfile, QuoteSnapshot } from '@/domain/types';
import {
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  Clock,
  Check,
  Building2,
  Globe,
  Lock,
} from 'lucide-react';

export function ConfiguratorWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useApp();
  const { t } = useT();

  const [step, setStep] = useState<number>(1);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);

  // Form State
  const [businessName, setBusinessName] = useState<string>('');
  const [operatingModel, setOperatingModel] = useState<BusinessProfile['operatingModel']>(
    'in_person_storefront'
  );
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [websiteCmsAccess, setWebsiteCmsAccess] = useState<boolean>(true);
  const [facebookPageStatus, setFacebookPageStatus] =
    useState<BusinessProfile['facebookPageStatus']>('none');

  // Selections
  const [selectedPlatformSkus, setSelectedPlatformSkus] = useState<string[]>(['HI-BUNDLE-3']);
  const [selectedAddonSkus, setSelectedAddonSkus] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // Server Quote Result
  const [serverQuote, setServerQuote] = useState<QuoteSnapshot | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Initialize preset from URL query params
  useEffect(() => {
    const preset = searchParams.get('preset');
    const sku = searchParams.get('sku');

    if (preset === 'bundle') {
      setSelectedPlatformSkus(['HI-BUNDLE-3']);
    } else if (sku) {
      setSelectedPlatformSkus([sku]);
    }
  }, [searchParams]);

  // Handle bundle vs individual platform toggle
  const handlePlatformToggle = (sku: string) => {
    if (sku === 'HI-BUNDLE-3') {
      // Selecting bundle clears individual platform setups
      setSelectedPlatformSkus(['HI-BUNDLE-3']);
      return;
    }

    // Selecting individual removes bundle
    const filtered = selectedPlatformSkus.filter((s) => s !== 'HI-BUNDLE-3');
    if (filtered.includes(sku)) {
      setSelectedPlatformSkus(filtered.filter((s) => s !== sku));
    } else {
      setSelectedPlatformSkus([...filtered, sku]);
    }
  };

  const handleAddonToggle = (sku: string) => {
    if (selectedAddonSkus.includes(sku)) {
      setSelectedAddonSkus(selectedAddonSkus.filter((s) => s !== sku));
    } else {
      setSelectedAddonSkus([...selectedAddonSkus, sku]);
    }
  };

  // Check Google Profile eligibility locally for instant UI feedback
  const isGoogleRequested =
    selectedPlatformSkus.includes('HI-BUNDLE-3') ||
    selectedPlatformSkus.includes('HI-SET-GOOGLE');
  const isGoogleIneligible =
    isGoogleRequested && operatingModel === 'online_only_no_in_person';

  // Check Pixel prerequisite locally
  const isPixelRequested = selectedAddonSkus.includes('HI-ADD-PIXEL');
  const isPixelPrerequisiteMissing =
    isPixelRequested && (!websiteUrl.trim() || !websiteCmsAccess);

  // Calculate live draft total for UI display (non-authoritative estimate)
  const draftEstimateTaka = (() => {
    let sum = 0;
    if (selectedPlatformSkus.includes('HI-BUNDLE-3')) {
      sum += 3000;
    } else {
      if (selectedPlatformSkus.includes('HI-SET-META')) sum += 1500;
      if (selectedPlatformSkus.includes('HI-SET-GOOGLE')) sum += 1500;
      if (selectedPlatformSkus.includes('HI-SET-LINKEDIN')) sum += 1500;
    }
    if (selectedAddonSkus.includes('HI-ADD-WA')) sum += 1690;
    if (selectedAddonSkus.includes('HI-ADD-PIXEL')) sum += 1500;
    if (selectedAddonSkus.includes('HI-ADD-CREATIVE')) sum += 990;
    return sum;
  })();

  // Request Server-Authoritative Quote on Step 4
  const fetchAuthoritativeQuote = async () => {
    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: `biz_${Date.now()}`,
          businessName: businessName || 'My Business',
          businessProfile: {
            name: businessName,
            operatingModel,
            hasPhysicalStorefront: operatingModel === 'in_person_storefront',
            conductsInPersonVisits: operatingModel !== 'online_only_no_in_person',
            websiteUrl,
            websiteCmsAccess,
            facebookPageStatus,
          },
          selectedPlatformSkus,
          selectedAddonSkus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate authoritative quote.');
      }

      setServerQuote(data.quote);
      setStep(4);
    } catch (err: any) {
      setQuoteError(err.message || 'Error communicating with quote server.');
    } finally {
      setLoadingQuote(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Wizard Progress Bar */}
      <div className="mb-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span className={step >= 1 ? 'text-hoooplaaa-gold-600 font-bold' : ''}>
            1. Business Profile
          </span>
          <span className={step >= 2 ? 'text-hoooplaaa-gold-600 font-bold' : ''}>
            2. Choose Setups
          </span>
          <span className={step >= 3 ? 'text-hoooplaaa-gold-600 font-bold' : ''}>
            3. Add-on Upgrades
          </span>
          <span className={step >= 4 ? 'text-hoooplaaa-gold-600 font-bold' : ''}>
            4. Authoritative Quote
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step}
          className="h-2 w-full bg-slate-200 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-hoooplaaa-gold-500 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Wizard Form Steps */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {/* STEP 1: Business Profile & Model */}
          {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-hoooplaaa-gold-600 uppercase tracking-wider">
                {t('step1')}
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {locale === 'en' ? 'Tell us about your business' : 'আপনার ব্যবসা সম্পর্কে জানান'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'en'
                  ? 'Required to deterministically evaluate Google and Meta platform eligibility.'
                  : 'গুগল ও মেটা প্ল্যাটফর্মের অধিকার নির্ধারণের জন্য প্রয়োজন।'}
              </p>
            </div>


              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business / Brand Name *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Dhaka Artisan Coffee, Sylhet Textiles"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating Model (Crucial for Google Business Profile) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setOperatingModel('in_person_storefront')}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        operatingModel === 'in_person_storefront'
                          ? 'border-hoooplaaa-gold-500 bg-amber-50/50 ring-1 ring-hoooplaaa-gold-500'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-hoooplaaa-navy-900 mb-1" />
                      <div className="font-bold text-xs text-slate-900">Physical Storefront</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Customers visit my physical shop or office
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOperatingModel('service_area_in_person')}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        operatingModel === 'service_area_in_person'
                          ? 'border-hoooplaaa-gold-500 bg-amber-50/50 ring-1 ring-hoooplaaa-gold-500'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-hoooplaaa-navy-900 mb-1" />
                      <div className="font-bold text-xs text-slate-900">Service Area Business</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        I visit customers at their location in a local zone
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOperatingModel('online_only_no_in_person')}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        operatingModel === 'online_only_no_in_person'
                          ? 'border-hoooplaaa-gold-500 bg-amber-50/50 ring-1 ring-hoooplaaa-gold-500'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      }`}
                    >
                      <Lock className="w-4 h-4 text-hoooplaaa-navy-900 mb-1" />
                      <div className="font-bold text-xs text-slate-900">Online Only / Delivery</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        No in-person contact (e-commerce/dropship)
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Website URL (Optional, needed for Pixel)
                    </label>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Existing Facebook Page Status
                    </label>
                    <select
                      value={facebookPageStatus}
                      onChange={(e) => setFacebookPageStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 bg-white"
                    >
                      <option value="none">No page yet (Start from scratch)</option>
                      <option value="existing_unclaimed">Have a page, needs professional optimization</option>
                      <option value="existing_claimed">Have a business page & portfolio</option>
                      <option value="restricted">Have account with policy restriction/ban</option>
                    </select>
                  </div>
                </div>

                {operatingModel === 'online_only_no_in_person' && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Google Policy Note:</strong>
                      <span>
                        Pure online businesses are not eligible for Google Business Profile under
                        official Google guidelines. You will be able to select Meta and LinkedIn
                        setups.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!businessName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
                >
                  <span>{t('continuePlatform')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Platform Setups */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-hoooplaaa-gold-600 uppercase tracking-wider">
                  {t('step2')}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Select your digital platforms
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the complete 3-platform hero bundle or customize individual platforms.
                </p>
              </div>

              {/* Hero Bundle Option */}
              <div
                onClick={() => handlePlatformToggle('HI-BUNDLE-3')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition relative ${
                  selectedPlatformSkus.includes('HI-BUNDLE-3')
                    ? 'border-hoooplaaa-gold-500 bg-amber-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 text-[10px] font-extrabold uppercase tracking-wider">
                        Hero Offer
                      </span>
                      <h3 className="font-bold text-base text-slate-900">
                        Complete 3-Platform Business Setup
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 max-w-xl">
                      Meta Portfolio + Facebook Page + Instagram + Google Business Profile +
                      LinkedIn Company Page. Includes brand consistency audit and post-sale detailed audit.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold text-slate-900">৳3,000</div>
                    <div className="text-[11px] text-emerald-600 font-bold">Save ৳1,500</div>
                  </div>
                </div>

                {isGoogleIneligible && selectedPlatformSkus.includes('HI-BUNDLE-3') && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-100/70 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Google Ineligibility Detected:</strong>
                      <span>
                        Your business operates purely online. Google policy does not allow GBP creation
                        without in-person customer visits. We recommend unchecking the bundle and
                        selecting Meta + LinkedIn individually (Total ৳3,000).
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  OR CHOOSE INDIVIDUAL PLATFORMS
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Individual Platform Cards */}
              <div className="space-y-3">
                {/* Meta */}
                <div
                  onClick={() => handlePlatformToggle('HI-SET-META')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedPlatformSkus.includes('HI-SET-META')
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedPlatformSkus.includes('HI-SET-META')
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedPlatformSkus.includes('HI-SET-META') && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Meta Business Setup</h4>
                      <p className="text-[11px] text-slate-500">
                        Portfolio, Facebook Page, Instagram Linking, Delegated Handover
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳1,500</span>
                  </div>
                </div>

                {/* Google */}
                <div
                  onClick={() => {
                    if (operatingModel === 'online_only_no_in_person') return;
                    handlePlatformToggle('HI-SET-GOOGLE');
                  }}
                  className={`p-4 rounded-xl border transition flex items-center justify-between ${
                    operatingModel === 'online_only_no_in_person'
                      ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200'
                      : selectedPlatformSkus.includes('HI-SET-GOOGLE')
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 cursor-pointer'
                      : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedPlatformSkus.includes('HI-SET-GOOGLE')
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedPlatformSkus.includes('HI-SET-GOOGLE') && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        Google Business Profile Setup
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {operatingModel === 'online_only_no_in_person'
                          ? 'Ineligible for online-only businesses (Google policy requirement)'
                          : 'Storefront or Service-area setup with category & verification guidance'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳1,500</span>
                  </div>
                </div>

                {/* LinkedIn */}
                <div
                  onClick={() => handlePlatformToggle('HI-SET-LINKEDIN')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedPlatformSkus.includes('HI-SET-LINKEDIN')
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedPlatformSkus.includes('HI-SET-LINKEDIN')
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedPlatformSkus.includes('HI-SET-LINKEDIN') && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">LinkedIn Company Page</h4>
                      <p className="text-[11px] text-slate-500">
                        Corporate Page, executive cover, about narrative, admin delegation
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳1,500</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={selectedPlatformSkus.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
                >
                  <span>Continue to Add-on Options</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Add-on Upgrades */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-hoooplaaa-gold-600 uppercase tracking-wider">
                  {t('step3')}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Add-on growth & tracking tools
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Optional additions to enhance customer conversion and tracking.
                </p>
              </div>

              <div className="space-y-3">
                {/* WhatsApp */}
                <div
                  onClick={() => handleAddonToggle('HI-ADD-WA')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedAddonSkus.includes('HI-ADD-WA')
                      ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedAddonSkus.includes('HI-ADD-WA')
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedAddonSkus.includes('HI-ADD-WA') && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        WhatsApp Automation Setup
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        1 core welcome sequence, away message schedule, quick replies
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳1,690</span>
                  </div>
                </div>

                {/* Meta Pixel */}
                <div
                  onClick={() => handleAddonToggle('HI-ADD-PIXEL')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedAddonSkus.includes('HI-ADD-PIXEL')
                      ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedAddonSkus.includes('HI-ADD-PIXEL')
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedAddonSkus.includes('HI-ADD-PIXEL') && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        Meta Pixel Tracking Setup
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Base code installation, standard events (PageView, Lead), event testing
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳1,500</span>
                  </div>
                </div>

                {isPixelPrerequisiteMissing && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Prerequisite Warning:</strong>
                      <span>
                        Meta Pixel requires an active website. Please ensure you provide your website
                        URL in Step 1 or uncheck the pixel add-on.
                      </span>
                    </div>
                  </div>
                )}

                {/* Ad Creative */}
                <div
                  onClick={() => handleAddonToggle('HI-ADD-CREATIVE')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedAddonSkus.includes('HI-ADD-CREATIVE')
                      ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        selectedAddonSkus.includes('HI-ADD-CREATIVE')
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedAddonSkus.includes('HI-ADD-CREATIVE') && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        Professional Ad Creative (Basic Static)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        1 original bespoke static ad visual (Square + Story) + 1 revision
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900">৳990</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={fetchAuthoritativeQuote}
                  disabled={loadingQuote}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
                >
                  {loadingQuote ? (
                    <span>Validating on Server...</span>
                  ) : (
                    <>
                      <span>Generate Server Quote</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Authoritative Server Quote Review */}
          {step === 4 && serverQuote && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-hoooplaaa-gold-600 uppercase tracking-wider">
                  Step 4 of 4
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Server-Authoritative Quote Snapshot
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>Quote Ref: {serverQuote.id}</span>
                  <span>•</span>
                  <span>Rule Version: {serverQuote.ruleVersion}</span>
                </div>
              </div>

              {quoteError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                  {quoteError}
                </div>
              )}

              {/* Eligibility Flags */}
              {serverQuote.eligibility.flags.length > 0 && (
                <div className="space-y-2">
                  {serverQuote.eligibility.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                        flag.severity === 'blocker'
                          ? 'bg-red-50 border border-red-200 text-red-900'
                          : 'bg-amber-50 border border-amber-200 text-amber-900'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold block">{flag.code}</strong>
                        <span>{flag.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-700 flex justify-between">
                  <span>Item & Scope Snapshot</span>
                  <span>Price (BDT)</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {serverQuote.items.map((item, idx) => (
                    <div key={idx} className="p-4 flex justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-500">SKU: {item.sku}</div>
                        <div className="text-[11px] text-slate-600">
                          Delivery: {item.deliveryTarget}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        ৳{(item.lineTotalMinor / 100).toLocaleString('en-US')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>৳{(serverQuote.subtotalMinor / 100).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                    <span>Total Authoritative Quote:</span>
                    <span>৳{(serverQuote.totalMinor / 100).toLocaleString('en-US')}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Inclusions Acknowledgement */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-hoooplaaa-gold-500 focus:ring-hoooplaaa-gold-500"
                  />
                  <span>
                    I confirm that I am the authorized representative of{' '}
                    <strong>{businessName}</strong>, accept the defined scope and exclusions
                    (including separate ad budgets and WhatsApp API costs), and agree to provide
                    delegated partner access upon checkout.
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modify Selections</span>
                </button>

                {serverQuote.eligibility.canSelfCheckout ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/checkout/${serverQuote.id}`)}
                    disabled={!agreedToTerms}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 disabled:opacity-50 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-gold-glow transition"
                  >
                    <span>Proceed to Secure Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={`/audit?reason=${encodeURIComponent(serverQuote.eligibility.customScopeReason || 'Manual review required')}`}
                    className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition"
                  >
                    <span>Request Custom Scope Review</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Sidebar Summary */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-2xl bg-slate-900 text-white p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-400">
                Live Draft Estimate
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {step < 4 ? 'Preliminary' : 'Server Validated'}
              </span>
            </div>

            <div>
              <div className="text-3xl font-extrabold text-white">
                ৳{draftEstimateTaka.toLocaleString('en-US')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {locale === 'en'
                  ? 'One-time investment • BDT'
                  : 'এককালীন ইনভেস্টমেন্ট • বিডিটি'}
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
              <div className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                Current Selections:
              </div>
              {selectedPlatformSkus.map((sku) => {
                const s = CANONICAL_SERVICES.find((srv) => srv.sku === sku);
                return (
                  <div key={sku} className="flex justify-between text-slate-300 text-[11px]">
                    <span className="truncate pr-2">{s ? s.name : sku}</span>
                    <span className="font-mono">
                      ৳{s ? (s.basePriceMinor / 100).toLocaleString() : ''}
                    </span>
                  </div>
                );
              })}
              {selectedAddonSkus.map((sku) => {
                const s = CANONICAL_SERVICES.find((srv) => srv.sku === sku);
                return (
                  <div key={sku} className="flex justify-between text-slate-300 text-[11px]">
                    <span className="truncate pr-2">{s ? s.name : sku}</span>
                    <span className="font-mono">
                      ৳{s ? (s.basePriceMinor / 100).toLocaleString() : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-hoooplaaa-gold-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Sales Call Friction</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Prices and eligibility rules are deterministic. You will never be asked for raw passwords.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
