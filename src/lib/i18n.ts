'use client';

import { useApp } from '@/components/providers/AppProviders';

type Dict = Record<string, { en: string; bn: string }>;

const dict: Dict = {
  // Configurator steps & form controls
  step1: { en: 'Step 1 of 4', bn: 'ধাপ ১ / ৪' },
  step2: { en: 'Step 2 of 4', bn: 'ধাপ ২ / ৪' },
  step3: { en: 'Step 3 of 4', bn: 'ধাপ ৩ / ৪' },
  step4: { en: 'Step 4 of 4', bn: 'ধাপ ৪ / ৪' },
  businessNameLabel: { en: 'Business / Brand Name *', bn: 'ব্যবসা / ব্র্যান্ডের নাম *' },
  operatingModelLabel: {
    en: 'Operating Model (Required for Google Business Profile Eligibility) *',
    bn: 'অপারেটিং মডেল (গুগল বিজনেস প্রোফাইলের যোগ্যতার জন্য বাধ্যতামূলক) *',
  },
  websiteUrlLabel: {
    en: 'Website URL (Required for Pixel, GA4/GTM & CAPI Tracking)',
    bn: 'ওয়েবসাইট URL (পিক্সেল, GA4/GTM এবং CAPI ট্র্যাকিংয়ের জন্য প্রয়োজন)',
  },
  facebookPageStatusLabel: { en: 'Existing Facebook Page Status', bn: 'বিদ্যমান ফেসবুক পেজের অবস্থা' },
  continuePlatform: { en: 'Continue to Services & Bundles', bn: 'সার্ভিস ও বান্ডেল নির্বাচনে যান' },
  continueAddons: { en: 'Continue to Specialist Add-ons', bn: 'অ্যাড-অন অপশনে এগিয়ে যান' },
  generateQuote: { en: 'Generate Authoritative Quote', bn: 'সার্ভার কোট তৈরি করুন' },
  modifySelections: { en: 'Modify Selections', bn: 'সিলেকশন পরিবর্তন করুন' },
  proceedCheckout: { en: 'Proceed to Secure Checkout', bn: 'নিরাপদ চেকআউট চালিয়ে যান' },
  requestScope: { en: 'Request Custom Scope Review', bn: 'কাস্টম স্কোপ রিভিউ অনুরোধ' },
  addOnHeading: { en: 'Specialist Add-ons & Operational Extensions', bn: 'স্পেশালিস্ট অ্যাড-অন ও অপারেশনাল এক্সটেনশন' },
  addOnDescription: {
    en: '22 approved add-on modules across Advertising, VA+, Leads & CRM, and Tracking. Automatic deduplication prevents double billing.',
    bn: 'অ্যাডভার্টাইজিং, VA+, লিডস ও সিআরএম এবং ট্র্যাকিং জুড়ে ২২টি অনুমোদিত অ্যাড-অন। ডাবল বিলিং প্রতিরোধে স্বয়ংক্রিয় ডি-ডুপ্লিকেশন সক্রিয়।',
  },

  // Navigation & Global Actions
  navServices: { en: 'Services', bn: 'সার্ভিস সমূহ' },
  navPackages: { en: 'Bundles & VA+', bn: 'বান্ডেল ও VA+' },
  navBuild: { en: 'Build Package', bn: 'প্যাকেজ তৈরি করুন' },
  navAudit: { en: 'Free Audit', bn: 'ফ্রি অডিট' },
  navHowItWorks: { en: 'How It Works', bn: 'কাজের প্রক্রিয়া' },
  navWorkspace: { en: 'Workspace', bn: 'ওয়ার্কস্পেস' },

  // Pricing & Commercial Disclosures
  launchOfferBadge: {
    en: '2026 Launch Offer · 20 Nov – 31 Dec 2026 (Asia/Dhaka)',
    bn: '২০২৬ লঞ্চ অফার · ২০ নভেম্বর – ৩১ ডিসেম্বর ২০২৬ (ঢাকা সময়)',
  },
  standardListRateLabel: { en: 'Standard List Rate', bn: 'স্ট্যান্ডার্ড লিস্ট রেট' },
  launchPriceLabel: { en: '2026 Launch Price', bn: '২০২৬ লঞ্চ মূল্য' },
  firstMonthOnly: { en: 'First month only', bn: 'শুধুমাত্র ১ম মাস' },
  oneTimeLabel: { en: 'One-time', bn: 'এককালীন' },
  monthlyLabel: { en: 'Monthly', bn: 'মাসিক' },
  variableLabel: { en: 'Scoped / Variable', bn: 'স্কোপভিত্তিক' },
};

export function useT() {
  const { locale } = useApp();
  const t = (key: keyof typeof dict) => dict[key][locale] ?? dict[key].en;
  return { t, locale };
}
