import { Service, ServiceCategory } from './types';

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'cat-setup',
    slug: 'business-setup',
    name: 'Business Setup & Infrastructure',
    nameBn: 'বিজনেস সেটআপ ও ডিজিটাল অবকাঠামো',
    displayOrder: 1,
  },
  {
    id: 'cat-addon',
    slug: 'add-ons',
    name: 'Growth & Tracking Add-ons',
    nameBn: 'গ্রোথ ও ট্র্যাকিং অ্যাড-অন',
    displayOrder: 2,
  },
  {
    id: 'cat-saas',
    slug: 'saas-tools',
    name: 'Managed Software & Tools (Future)',
    nameBn: 'ম্যানেজড সফটওয়্যার ও টুলস (আসন্ন)',
    displayOrder: 3,
  },
];

export const CANONICAL_SERVICES: Service[] = [
  {
    id: 'srv-meta',
    sku: 'HI-SET-META',
    slug: 'meta-business-setup',
    categoryId: 'cat-setup',
    name: 'Meta Business Setup',
    nameBn: 'মেটা বিজনেস সেটআপ (ফেসবুক ও ইনস্টাগ্রাম)',
    shortDescription:
      'Professional Meta Business Portfolio creation, Facebook Page optimization, Instagram linking, asset security, and delegated ownership handover.',
    shortDescriptionBn:
      'প্রফেশনাল মেটা বিজনেস পোর্টফোলিও তৈরি, ফেসবুক পেজ অপ্টিমাইজেশন, ইনস্টাগ্রাম লিঙ্কিং, নিরাপত্তা এবং মালিকানা হস্তান্তর।',
    basePriceMinor: 150000, // ৳1,500 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved fixed-price entry offer
    requiresQuote: false,
    deliveryTarget: '1–2 business days',
    inclusions: [
      'Meta Business Portfolio creation & configuration',
      'Facebook Business Page complete setup with branding',
      'Instagram Professional Account linking',
      'Partner access delegation (secure, no password exchange)',
      'Security review and 2FA guidance',
      'Direct handover walkthrough and checklist',
    ],
    exclusions: [
      'Ad spend or third-party ad budget',
      'Ongoing daily post management or community moderation',
      'Guaranteed policy ban removals or ownership dispute resolution',
    ],
    prerequisites: [
      'Valid owner personal Facebook account in good standing',
      'Basic business information and logo/brand materials',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-google',
    sku: 'HI-SET-GOOGLE',
    slug: 'google-business-setup',
    categoryId: 'cat-setup',
    name: 'Google Business Profile Setup',
    nameBn: 'গুগল বিজনেস প্রোফাইল সেটআপ',
    shortDescription:
      'Complete Google Business Profile setup for eligible local storefronts and service-area businesses, category optimization, and verification roadmap.',
    shortDescriptionBn:
      'উপযুক্ত লোকাল শপ ও সার্ভিস-এরিয়ার জন্য গুগল বিজনেস প্রোফাইল সেটআপ, ক্যাটাগরি অপ্টিমাইজেশন এবং ভেরিফিকেশন গাইডলাইন।',
    basePriceMinor: 150000, // ৳1,500 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved fixed-price entry offer
    requiresQuote: false,
    deliveryTarget: '1–2 business days',
    inclusions: [
      'Google Business Profile setup with primary & secondary categories',
      'Accurate NAP (Name, Address, Phone) consistency setup',
      'Hours, service catalog, business description, and photo tagging',
      'Map pin geocoding and designated service-area boundary definition',
      'Official verification guidance (video/postcard/email instructions)',
    ],
    exclusions: [
      'Guaranteed Google automated verification (Google controls approval)',
      'Google Ads / Local Services Ads budget',
      'Pure online-only businesses without physical interaction (ineligible by Google)',
    ],
    prerequisites: [
      'Real physical storefront OR active local service area with in-person customer visits',
      'Official business phone number and trade documentation if requested by Google',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-linkedin',
    sku: 'HI-SET-LINKEDIN',
    slug: 'linkedin-company-page-setup',
    categoryId: 'cat-setup',
    name: 'LinkedIn Company Page Setup',
    nameBn: 'লিঙ্কডইন কোম্পানি পেজ সেটআপ',
    shortDescription:
      'Corporate LinkedIn Company Page establishment, banner/logo optimization, headline positioning, and company administrator assignment.',
    shortDescriptionBn:
      'কর্পোরেট লিঙ্কডইন কোম্পানি পেজ তৈরি, ব্যানার ও লোগো অপ্টিমাইজেশন, হেডলাইন পজিশনিং এবং অ্যাডমিন অ্যাক্সেস সেটআপ।',
    basePriceMinor: 150000, // ৳1,500 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved fixed-price entry offer
    requiresQuote: false,
    deliveryTarget: '1 business day',
    inclusions: [
      'LinkedIn Company Page creation or full claim',
      'Branded cover banner and avatar placement',
      'Industry tagging, company size, website URL, and custom CTA button',
      'Foundational "About" section and key services listing',
      'Multi-admin role delegation and handover',
    ],
    exclusions: [
      'LinkedIn Recruiter or Sales Navigator subscriptions',
      'Sponsored content / campaign ad spend',
      'Personal profile ghostwriting or outbound lead generation',
    ],
    prerequisites: [
      'Active personal LinkedIn profile of the business owner',
      'Company logo and website/business description',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-bundle-3',
    sku: 'HI-BUNDLE-3',
    slug: 'complete-3-platform-business-setup',
    categoryId: 'cat-setup',
    name: 'Complete 3-Platform Business Setup (Hero Offer)',
    nameBn: 'কমপ্লিট ৩-প্ল্যাটফর্ম বিজনেস সেটআপ (হিরো অফার)',
    shortDescription:
      'Unified omni-channel infrastructure across Meta (Facebook + IG), Google Business, and LinkedIn. Save ৳1,500 compared to individual setups.',
    shortDescriptionBn:
      'মেটা (ফেসবুক ও ইনস্টাগ্রাম), গুগল বিজনেস এবং লিঙ্কডইনে সমন্বিত ডিজিটাল অবকাঠামো। আলাদা কেনার চেয়ে ৳১,৫০০ সাশ্রয়ী।',
    basePriceMinor: 300000, // ৳3,000 in poisha (Bundle price, 33.3% savings vs ৳4,500)
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved hero bundle
    requiresQuote: false,
    deliveryTarget: '2–4 business days',
    inclusions: [
      'Complete Meta Business Portfolio + Facebook Page + Instagram linking',
      'Google Business Profile setup with category and verification roadmap',
      'LinkedIn Company Page creation and executive branding',
      'Brand consistency audit across all three platforms',
      'Unified partner delegation setup (no passwords exchanged)',
      'Complimentary Post-Sale Detailed Business Audit included',
    ],
    exclusions: [
      'Ad spend on any platform',
      'Ineligible Google profiles (pure dropshipping / virtual without service area)',
      'Ongoing post generation or community management',
    ],
    prerequisites: [
      'Business must be eligible for Google Business Profile (physical storefront or service area)',
      'Active personal accounts for owner verification',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-addon-wa',
    sku: 'HI-ADD-WA',
    slug: 'whatsapp-automation-setup',
    categoryId: 'cat-addon',
    name: 'WhatsApp Automation Setup',
    nameBn: 'হোয়াটসঅ্যাপ অটোমেশন সেটআপ',
    shortDescription:
      'Turn inquiries into instant conversations with automated welcome, away messages, interactive catalog routing, and quick replies.',
    shortDescriptionBn:
      'অটোমেটেড ওয়েলকাম, অ্যাওয়ে মেসেজ এবং কুইক রিপ্লাই দিয়ে গ্রাহকের মেসেজের তাৎক্ষণিক উত্তর নিশ্চিত করুন।',
    basePriceMinor: 169000, // ৳1,690 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved add-on
    requiresQuote: false,
    deliveryTarget: '2 business days',
    inclusions: [
      'WhatsApp Business App or Cloud API foundational setup',
      'Automated greeting / welcome message sequence',
      'Away message with business hours schedule',
      'Up to 5 custom Quick Reply templates for frequent questions',
      'Catalog or website link integration in chat profile',
    ],
    exclusions: [
      'Meta WhatsApp Cloud API messaging conversation fees (paid to Meta)',
      'Custom third-party CRM webhook development',
      'Mass unsolicited outbound spam broadcast campaigns',
    ],
    prerequisites: [
      'Dedicated phone number not currently tied to personal WhatsApp',
      'Business hours and common FAQ answers provided',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-addon-pixel',
    sku: 'HI-ADD-PIXEL',
    slug: 'meta-pixel-tracking-setup',
    categoryId: 'cat-addon',
    name: 'Meta Pixel Tracking Setup',
    nameBn: 'মেটা পিক্সেল ট্র্যাকিং সেটআপ',
    shortDescription:
      'Standard event tracking for your website to measure visitors, page views, leads, and purchases for high-ROI ad attribution.',
    shortDescriptionBn:
      'ভিজিটর, লিড ও সেলস নির্ভুলভাবে ট্র্যাক করতে ওয়েবসাইটে স্ট্যান্ডার্ড মেটা পিক্সেল ইভেন্ট সেটআপ।',
    basePriceMinor: 150000, // ৳1,500 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved add-on
    requiresQuote: false,
    deliveryTarget: '1–2 business days',
    inclusions: [
      'Meta Pixel generation within client Business Portfolio',
      'Base pixel code installation on 1 website / domain',
      'Standard event setup: PageView, ViewContent, Contact, Lead',
      'Live test event verification via Meta Pixel Helper and Events Manager',
      'Domain verification in Meta Business Suite',
    ],
    exclusions: [
      'Complex server-side Conversions API (CAPI) on custom backends',
      'Third-party cookie consent banner custom development',
      'Websites without CMS or codebase admin access',
    ],
    prerequisites: [
      'Live, active website (WordPress, Shopify, Next.js, or custom)',
      'Admin or developer access to website tag manager / header scripts',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  {
    id: 'srv-addon-creative',
    sku: 'HI-ADD-CREATIVE',
    slug: 'professional-ad-creative-basic-static',
    categoryId: 'cat-addon',
    name: 'Professional Ad Creative (Basic Static)',
    nameBn: 'প্রফেশনাল অ্যাড ক্রিয়েটিভ (স্ট্যাটিক ব্যানার)',
    shortDescription:
      'High-converting, bespoke static ad creative designed to stop the scroll and drive clicks on Facebook, Instagram, and LinkedIn.',
    shortDescriptionBn:
      'সোশ্যাল মিডিয়ায় নজর কাড়তে ও কাস্টমার আকৃষ্ট করতে ১টি কনভার্সন-ফোকাসড প্রফেশনাল স্ট্যাটিক ব্যানার।',
    basePriceMinor: 99000, // ৳990 in poisha
    billingPeriod: 'one_time',
    publicationStatus: 'published',
    checkoutEnabled: true, // Approved add-on
    requiresQuote: false,
    deliveryTarget: '1–2 business days',
    inclusions: [
      '1 original bespoke static visual design concept',
      'Multi-placement adaptation (1:1 Square + 9:16 Story format)',
      'Compelling marketing headline, subtext, and clear CTA button styling',
      '1 included revision cycle based on client feedback',
      'High-resolution export (PNG/JPG optimized for ad platforms)',
    ],
    exclusions: [
      'Video animation or motion design',
      'Raw layered source files (.PSD / .AI) unless separately licensed',
      'Stock image or model licensing fees (client provides or royalty-free used)',
    ],
    prerequisites: [
      'Product/service brief, target audience, and primary promotion message',
      'High-resolution logo and brand imagery if available',
    ],
    ownerConfirmedPrice: true,
    provenance: 'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv',
  },
  // Future / Proposed SaaS Catalog Items (Supported in data model ONLY; checkout_enabled = false per Principle 3)
  {
    id: 'srv-saas-01',
    sku: 'HI-SAAS-01',
    slug: 'unified-inbox-social-manager',
    categoryId: 'cat-saas',
    name: 'Unified Inbox & Social Media Manager',
    nameBn: 'ইউনিফাইড ইনবক্স ও সোশ্যাল মিডিয়া ম্যানেজার',
    shortDescription:
      'Centralized multi-channel customer communications hub connecting Facebook, Instagram, and WhatsApp into a single inbox.',
    shortDescriptionBn:
      'ফেসবুক, ইনস্টাগ্রাম এবং হোয়াটসঅ্যাপের সব মেসেজ একটি প্ল্যাটফর্ম থেকে ম্যানেজ করার সফটওয়্যার।',
    basePriceMinor: 19900, // ৳199/week in poisha
    billingPeriod: 'weekly',
    publicationStatus: 'source_listed',
    checkoutEnabled: false, // Strictly false: internal proposed only
    requiresQuote: true,
    deliveryTarget: 'Requires deployment sign-off',
    inclusions: ['Unified social inbox access', 'Contact management', 'Basic auto-tagging'],
    exclusions: ['Unverified platform APIs', 'Third party messaging credits'],
    prerequisites: ['Active Hoooplaaa Business Setup on Meta'],
    ownerConfirmedPrice: false,
    provenance: 'D1/D2 Source Allocation Archive',
  },
];
