-- ============================================================================
-- HOOOPLAAA INCORPORATED — CANONICAL SEED DATA
-- Version: 3.0.0-PROD
-- Date: 2026-11-08 (Asia/Dhaka)
-- ============================================================================

INSERT INTO public.service_catalog (
  sku, slug, title, title_bn, short_description, short_description_bn,
  category, base_price_minor, billing_period, publication_status,
  checkout_enabled, requires_quote, turnaround_target, inclusions, exclusions,
  prerequisites, owner_confirmed_working_price, provenance
) VALUES
(
  'HI-SET-META',
  'meta-business-setup',
  'Meta Business Setup',
  'মেটা বিজনেস সেটআপ (ফেসবুক ও ইনস্টাগ্রাম)',
  'Professional Meta Business Portfolio creation, Facebook Page optimization, Instagram linking, asset security, and delegated ownership handover.',
  'প্রফেশনাল মেটা বিজনেস পোর্টফোলিও তৈরি, ফেসবুক পেজ অপ্টিমাইজেশন, ইনস্টাগ্রাম লিঙ্কিং, নিরাপত্তা এবং মালিকানা হস্তান্তর।',
  'business-setup',
  150000, -- ৳1,500
  'one_time',
  'published',
  true,
  false,
  '1–2 business days',
  '["Meta Business Portfolio creation & configuration", "Facebook Business Page complete setup with branding", "Instagram Professional Account linking", "Partner access delegation (secure, no password exchange)", "Security review and 2FA guidance", "Direct handover walkthrough and checklist"]'::jsonb,
  '["Ad spend or third-party ad budget", "Ongoing daily post management or community moderation", "Guaranteed policy ban removals or ownership dispute resolution"]'::jsonb,
  '["Valid owner personal Facebook account in good standing", "Basic business information and logo/brand materials"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-SET-GOOGLE',
  'google-business-setup',
  'Google Business Profile Setup',
  'গুগল বিজনেস প্রোফাইল সেটআপ',
  'Complete Google Business Profile setup for eligible local storefronts and service-area businesses, category optimization, and verification roadmap.',
  'উপযুক্ত লোকাল শপ ও সার্ভিস-এরিয়ার জন্য গুগল বিজনেস প্রোফাইল সেটআপ, ক্যাটাগরি অপ্টিমাইজেশন এবং ভেরিফিকেশন গাইডলাইন।',
  'business-setup',
  150000, -- ৳1,500
  'one_time',
  'published',
  true,
  false,
  '1–2 business days',
  '["Google Business Profile setup with primary & secondary categories", "Accurate NAP consistency setup", "Hours, service catalog, business description, and photo tagging", "Map pin geocoding and designated service-area boundary definition", "Official verification guidance (video/postcard/email instructions)"]'::jsonb,
  '["Guaranteed Google automated verification (Google controls approval)", "Google Ads / Local Services Ads budget", "Pure online-only businesses without physical interaction (ineligible by Google)"]'::jsonb,
  '["Real physical storefront OR active local service area with in-person customer visits", "Official business phone number and trade documentation if requested by Google"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-SET-LINKEDIN',
  'linkedin-company-page-setup',
  'LinkedIn Company Page Setup',
  'লিঙ্কডইন কোম্পানি পেজ সেটআপ',
  'Corporate LinkedIn Company Page establishment, banner/logo optimization, headline positioning, and company administrator assignment.',
  'কর্পোরেট লিঙ্কডইন কোম্পানি পেজ তৈরি, ব্যানার ও লোগো অপ্টিমাইজেশন, হেডলাইন পজিশনিং এবং অ্যাডমিন অ্যাক্সেস সেটআপ।',
  'business-setup',
  150000, -- ৳1,500
  'one_time',
  'published',
  true,
  false,
  '1 business day',
  '["LinkedIn Company Page creation or full claim", "Branded cover banner and avatar placement", "Industry tagging, company size, website URL, and custom CTA button", "Foundational About section and key services listing", "Multi-admin role delegation and handover"]'::jsonb,
  '["LinkedIn Recruiter or Sales Navigator subscriptions", "Sponsored content / campaign ad spend", "Personal profile ghostwriting or outbound lead generation"]'::jsonb,
  '["Active personal LinkedIn profile of the business owner", "Company logo and website/business description"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-BUNDLE-3',
  'complete-3-platform-business-setup',
  'Complete 3-Platform Business Setup (Hero Offer)',
  'কমপ্লিট ৩-প্ল্যাটফর্ম বিজনেস সেটআপ (হিরো অফার)',
  'Unified omni-channel infrastructure across Meta (Facebook + IG), Google Business, and LinkedIn. Save ৳1,500 compared to individual setups.',
  'মেটা (ফেসবুক ও ইনস্টাগ্রাম), গুগল বিজনেস এবং লিঙ্কডইনে সমন্বিত ডিজিটাল অবকাঠামো। আলাদা কেনার চেয়ে ৳১,৫০০ সাশ্রয়ী।',
  'business-setup',
  300000, -- ৳3,000 (saves ৳1,500 vs ৳4,500)
  'one_time',
  'published',
  true,
  false,
  '2–4 business days',
  '["Complete Meta Business Portfolio + Facebook Page + Instagram linking", "Google Business Profile setup with category and verification roadmap", "LinkedIn Company Page creation and executive branding", "Brand consistency audit across all three platforms", "Unified partner delegation setup (no passwords exchanged)", "Complimentary Post-Sale Detailed Business Audit included"]'::jsonb,
  '["Ad spend on any platform", "Ineligible Google profiles (pure dropshipping / virtual without service area)", "Ongoing post generation or community management"]'::jsonb,
  '["Business must be eligible for Google Business Profile (physical storefront or service area)", "Active personal accounts for owner verification"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-ADD-WA',
  'whatsapp-automation-setup',
  'WhatsApp Automation Setup',
  'হোয়াটসঅ্যাপ অটোমেশন সেটআপ',
  'Turn inquiries into instant conversations with automated welcome, away messages, interactive catalog routing, and quick replies.',
  'অটোমেটেড ওয়েলকাম, অ্যাওয়ে মেসেজ এবং কুইক রিপ্লাই দিয়ে গ্রাহকের মেসেজের তাৎক্ষণিক উত্তর নিশ্চিত করুন।',
  'add-ons',
  169000, -- ৳1,690
  'one_time',
  'published',
  true,
  false,
  '2 business days',
  '["WhatsApp Business App or Cloud API foundational setup", "Automated greeting / welcome message sequence", "Away message with business hours schedule", "Up to 5 custom Quick Reply templates for frequent questions", "Catalog or website link integration in chat profile"]'::jsonb,
  '["Meta WhatsApp Cloud API messaging conversation fees (paid to Meta)", "Custom third-party CRM webhook development", "Mass unsolicited outbound spam broadcast campaigns"]'::jsonb,
  '["Dedicated phone number not currently tied to personal WhatsApp", "Business hours and common FAQ answers provided"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-ADD-PIXEL',
  'meta-pixel-tracking-setup',
  'Meta Pixel Tracking Setup',
  'মেটা পিক্সেল ট্র্যাকিং সেটআপ',
  'Standard event tracking for your website to measure visitors, page views, leads, and purchases for high-ROI ad attribution.',
  'ভিজিটর, লিড ও সেলস নির্ভুলভাবে ট্র্যাক করতে ওয়েবসাইটে স্ট্যান্ডার্ড মেটা পিক্সেল ইভেন্ট সেটআপ।',
  'add-ons',
  150000, -- ৳1,500
  'one_time',
  'published',
  true,
  false,
  '1–2 business days',
  '["Meta Pixel generation within client Business Portfolio", "Base pixel code installation on 1 website / domain", "Standard event setup: PageView, ViewContent, Contact, Lead", "Live test event verification via Meta Pixel Helper and Events Manager", "Domain verification in Meta Business Suite"]'::jsonb,
  '["Complex server-side Conversions API (CAPI) on custom backends", "Third-party cookie consent banner custom development", "Websites without CMS or codebase admin access"]'::jsonb,
  '["Live, active website (WordPress, Shopify, Next.js, or custom)", "Admin or developer access to website tag manager / header scripts"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
(
  'HI-ADD-CREATIVE',
  'professional-ad-creative-basic-static',
  'Professional Ad Creative (Basic Static)',
  'প্রফেশনাল অ্যাড ক্রিয়েটিভ (স্ট্যাটিক ব্যানার)',
  'High-converting, bespoke static ad creative designed to stop the scroll and drive clicks on Facebook, Instagram, and LinkedIn.',
  'সোশ্যাল মিডিয়ায় নজর কাড়তে ও কাস্টমার আকৃষ্ট করতে ১টি কনভার্সন-ফোকাসড প্রফেশনাল স্ট্যাটিক ব্যানার।',
  'add-ons',
  99000, -- ৳990
  'one_time',
  'published',
  true,
  false,
  '1–2 business days',
  '["1 original bespoke static visual design concept", "Multi-placement adaptation (1:1 Square + 9:16 Story format)", "Compelling marketing headline, subtext, and clear CTA button styling", "1 included revision cycle based on client feedback", "High-resolution export (PNG/JPG optimized for ad platforms)"]'::jsonb,
  '["Video animation or motion design", "Raw layered source files (.PSD / .AI) unless separately licensed", "Stock image or model licensing fees"]'::jsonb,
  '["Product/service brief, target audience, and primary promotion message", "High-resolution logo and brand imagery if available"]'::jsonb,
  true,
  'U-2026-11-08 / HOOOPLAAA_Service_Registry_2026-11-08.csv'
),
-- Future / Proposed SaaS item: Stored in catalog for future expansion, checkout_enabled strictly false
(
  'HI-SAAS-01',
  'unified-inbox-social-manager',
  'Unified Inbox & Social Media Manager',
  'ইউনিফাইড ইনবক্স ও সোশ্যাল মিডিয়া ম্যানেজার',
  'Centralized multi-channel customer communications hub connecting Facebook, Instagram, and WhatsApp into a single inbox.',
  'ফেসবুক, ইনস্টাগ্রাম এবং হোয়াটসঅ্যাপের সব মেসেজ একটি প্ল্যাটফর্ম থেকে ম্যানেজ করার সফটওয়্যার।',
  'saas-tools',
  19900, -- ৳199/week
  'weekly',
  'source_listed',
  false, -- STRICTLY FALSE per Principle 3
  true,
  'Requires deployment sign-off',
  '["Unified social inbox access", "Contact management", "Basic auto-tagging"]'::jsonb,
  '["Unsupported channel claims", "Third party messaging credits"]'::jsonb,
  '["Active Hoooplaaa Business Setup on Meta"]'::jsonb,
  false,
  'D1/D2 Source Allocation Archive'
)
ON CONFLICT (sku) DO NOTHING;
