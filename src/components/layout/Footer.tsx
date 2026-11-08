'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '../providers/AppProviders';
import { ShieldAlert, CheckCircle2, Lock, FileText, HelpCircle } from 'lucide-react';

export function Footer() {
  const { locale } = useApp();

  return (
    <footer className="bg-hoooplaaa-navy-950 text-slate-300 border-t border-hoooplaaa-navy-800 text-sm">
      {/* Policy Transparency Banner */}
      <div className="bg-hoooplaaa-navy-900/80 border-b border-hoooplaaa-navy-800 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-hoooplaaa-gold-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">
                {locale === 'en' ? 'Full Asset Ownership' : 'সম্পূর্ণ মালিকানা গ্রাহকের'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {locale === 'en'
                  ? 'All pages, portfolios, and profiles are created in your name. We use secure delegated partner access—never passwords.'
                  : 'সব পেজ ও পোর্টফোলিও আপনার নামে সেটআপ হয়। আমরা নিরাপদ পার্টনার ডেলিগেশন ব্যবহার করি, পাসওয়ার্ড গ্রহণ করি না।'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">
                {locale === 'en' ? 'Transparent Scope Boundaries' : 'স্বচ্ছ স্কোপ নীতিমালা'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {locale === 'en'
                  ? 'No false promises. We do not claim guaranteed Google 1st-page rankings, guaranteed ad approvals, or fabricated ROAS figures.'
                  : 'কোনো অবাস্তব প্রতিশ্রুতি নেই। আমরা কোনো অযৌক্তিক র‍্যাংকিং বা অবাস্তব মুনাফার গ্যারান্টি দাবি করি না।'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider">
                {locale === 'en' ? 'Separate Ad & API Costs' : 'বিজ্ঞাপন ও এপিআই খরচ পৃথক'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {locale === 'en'
                  ? 'Setup fees cover expert implementation. Platform ad budgets and third-party WhatsApp API messaging credits are paid directly to providers.'
                  : 'সার্ভিস ফি আমাদের কাজের জন্য। প্ল্যাটফর্মের নিজস্ব অ্যাড বাজেট ও মেসেজিং ক্রেডিট প্ল্যাটফর্মকে সরাসরি পরিশোধ করতে হয়।'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-hoooplaaa-gold-500 flex items-center justify-center font-black text-hoooplaaa-navy-950 text-lg">
              H
            </div>
            <span className="font-extrabold text-base tracking-wider text-white">
              HOOOPLAAA INCORPORATED
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
            {locale === 'en'
              ? 'Hoooplaaa Incorporated is a multi-service digital marketing agency providing self-service commerce, infrastructure setups, and managed growth solutions.'
              : 'হুপলা ইনকর্পোরেটেড একটি পূর্ণাঙ্গ ডিজিটাল মার্কেটিং এজেন্সি, যা সেলফ-সার্ভিস কমার্স ও গ্রোথ অবকাঠামো সেবা প্রদান করে।'}
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>Operations: Dhaka, Bangladesh • Global Orientation</p>
            <p>Support: support@hoooplaaa.com</p>
            <p>SLA Hours: 10:00 AM – 7:00 PM (Asia/Dhaka)</p>
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
            {locale === 'en' ? 'Services' : 'সার্ভিসসমূহ'}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/services/meta-business-setup" className="hover:text-hoooplaaa-gold-300">
                Meta Business Setup (৳1,500)
              </Link>
            </li>
            <li>
              <Link href="/services/google-business-setup" className="hover:text-hoooplaaa-gold-300">
                Google Business Setup (৳1,500)
              </Link>
            </li>
            <li>
              <Link href="/services/linkedin-company-page-setup" className="hover:text-hoooplaaa-gold-300">
                LinkedIn Company Page (৳1,500)
              </Link>
            </li>
            <li>
              <Link href="/packages" className="hover:text-hoooplaaa-gold-300 font-semibold text-hoooplaaa-gold-400">
                3-Platform Bundle (৳3,000)
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
            {locale === 'en' ? 'Add-ons & Tools' : 'অ্যাড-অন ও অডিট'}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/services/whatsapp-automation-setup" className="hover:text-hoooplaaa-gold-300">
                WhatsApp Setup (৳1,690)
              </Link>
            </li>
            <li>
              <Link href="/services/meta-pixel-tracking-setup" className="hover:text-hoooplaaa-gold-300">
                Meta Pixel Tracking (৳1,500)
              </Link>
            </li>
            <li>
              <Link href="/services/professional-ad-creative-basic-static" className="hover:text-hoooplaaa-gold-300">
                Basic Static Creative (৳990)
              </Link>
            </li>
            <li>
              <Link href="/audit" className="hover:text-hoooplaaa-gold-300">
                Free Readiness Audit
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
            {locale === 'en' ? 'Legal & Compliance' : 'পলিসি ও শর্তাবলী'}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/policies/terms" className="hover:text-white flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className="hover:text-white flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Privacy & Data Policy
              </Link>
            </li>
            <li>
              <Link href="/policies/refund" className="hover:text-white flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Refund & Scope Rules
              </Link>
            </li>
            <li>
              <Link href="/policies/delivery" className="hover:text-white flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Delivery & SLA Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hoooplaaa-navy-900 py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
        <p>
          © 2026 HOOOPLAAA INCORPORATED. All rights reserved. Self-service agency commerce engine.
        </p>
      </div>
    </footer>
  );
}
