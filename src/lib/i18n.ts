import { useApp } from '@/components/providers/AppProviders';

type Dict = Record<string, { en: string; bn: string }>;

const dict: Dict = {
  step1: { en: 'Step 1 of 4', bn: 'ধাপ ১ / ৪' },
  step2: { en: 'Step 2 of 4', bn: 'ধাপ ২ / ৪' },
  step3: { en: 'Step 3 of 4', bn: 'ধাপ ৩ / ৪' },
  step4: { en: 'Step 4 of 4', bn: 'ধাপ ৪ / ৪' },
  businessNameLabel: { en: 'Business / Brand Name *', bn: 'ব্যবসা / ব্র্যান্ডের নাম *' },
  operatingModelLabel: { en: 'Operating Model (Crucial for Google Business Profile) *', bn: 'অপারেটিং মডেল (গুগল বিজনেস প্রোফাইলের জন্য গুরুত্বপূর্ণ) *' },
  websiteUrlLabel: { en: 'Website URL (Optional, needed for Pixel)', bn: 'ওয়েবসাইট URL (ঐচ্ছিক, পিক্সেল জন্য প্রয়োজন)' },
  facebookPageStatusLabel: { en: 'Existing Facebook Page Status', bn: 'ফেসবুক পেজের অবস্থা' },
  continuePlatform: { en: 'Continue to Platform Selection', bn: 'প্ল্যাটফর্ম নির্বাচন এগিয়ে যান' },
  continueAddons: { en: 'Continue to Add-on Options', bn: 'অ্যাড‑অন অপশন এগিয়ে যান' },
  generateQuote: { en: 'Generate Server Quote', bn: 'সার্ভার কোট তৈরি করুন' },
  modifySelections: { en: 'Modify Selections', bn: 'সিলেকশন পরিবর্তন করুন' },
  proceedCheckout: { en: 'Proceed to Secure Checkout', bn: 'নিরাপদ চেকআউট চালিয়ে যান' },
  requestScope: { en: 'Request Custom Scope Review', bn: 'কাস্টম স্কোপ রিভিউ অনুরোধ' },
  addOnHeading: { en: 'Add-on growth & tracking tools', bn: 'অ্যাড‑অন বৃদ্ধি ও ট্র্যাকিং টুলস' },
  addOnDescription: { en: 'Optional additions to enhance customer conversion and tracking.', bn: 'গ্রাহক রূপান্তর ও ট্র্যাকিং বাড়াতে ঐচ্ছিক অতিরিক্ত সেবা।' },
};

export function useT() {
  const { locale } = useApp();
  const t = (key: keyof typeof dict) => dict[key][locale] ?? dict[key].en;
  return { t };
}
