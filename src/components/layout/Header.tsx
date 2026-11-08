'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '../providers/AppProviders';
import {
  ShieldCheck,
  Globe,
  Menu,
  X,
  Layers,
  Sparkles,
  UserCheck,
  Lock,
  ArrowRight,
} from 'lucide-react';

export function Header() {
  const { locale, setLocale } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-opacity-95 transition-colors duration-200 border-b border-hoooplaaa-navy-700/30 bg-hoooplaaa-navy-950 text-white">
      {/* Top micro bar for trust, credentials & locale */}
      <div className="bg-hoooplaaa-navy-900/90 border-b border-hoooplaaa-navy-800 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="inline-flex items-center gap-1 font-semibold text-hoooplaaa-gold-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              HOOOPLAAA INCORPORATED
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline text-slate-400">
              {locale === 'en'
                ? 'Attract. Connect. Convert. Grow.'
                : 'অ্যাট্রাক্ট • কানেক্ট • কনভার্ট • গ্রো'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-emerald-400 font-medium hidden md:inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Direct Commerce Engine Online
            </span>

            {/* Locale Switcher */}
            <button
              onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1 text-slate-300 hover:text-white text-xs px-2.5 py-0.5 rounded bg-hoooplaaa-navy-800 border border-hoooplaaa-navy-700 hover:border-hoooplaaa-gold-500/50 transition"
              aria-label="Switch Language"
            >
              <Globe className="w-3 h-3 text-hoooplaaa-gold-400" />
              <span>{locale === 'en' ? 'বাংলা' : 'English'}</span>
            </button>

            {/* Admin shortcut */}
            <Link
              href="/admin"
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
            >
              <Lock className="w-3 h-3 text-hoooplaaa-gold-500" />
              <span>Admin Desk</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-hoooplaaa-gold-400 via-hoooplaaa-gold-500 to-hoooplaaa-gold-600 flex items-center justify-center font-black text-hoooplaaa-navy-950 text-xl tracking-tighter shadow-gold-glow group-hover:scale-105 transition-transform">
            H
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-wider text-white group-hover:text-hoooplaaa-gold-300 transition">
              HOOOPLAAA
            </span>
            <span className="text-[9px] uppercase tracking-widest text-hoooplaaa-gold-400/80 -mt-1 font-semibold">
              INCORPORATED
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link
            href="/services"
            className="text-slate-200 hover:text-hoooplaaa-gold-300 transition"
          >
            {locale === 'en' ? 'Services' : 'সার্ভিসসমূহ'}
          </Link>
          <Link
            href="/packages"
            className="text-slate-200 hover:text-hoooplaaa-gold-300 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-hoooplaaa-gold-400" />
            <span>{locale === 'en' ? '3-Platform Bundle' : '৩-প্ল্যাটফর্ম বান্ডেল'}</span>
          </Link>
          <Link
            href="/build"
            className="text-slate-200 hover:text-hoooplaaa-gold-300 transition flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{locale === 'en' ? 'Custom Builder' : 'প্যাকেজ বিল্ডার'}</span>
          </Link>
          <Link
            href="/audit"
            className="text-slate-200 hover:text-hoooplaaa-gold-300 transition"
          >
            {locale === 'en' ? 'Free Audit' : 'ফ্রি অডিট'}
          </Link>
          <Link
            href="/how-it-works"
            className="text-slate-300 hover:text-white transition"
          >
            {locale === 'en' ? 'How It Works' : 'কাজের প্রক্রিয়া'}
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-hoooplaaa-navy-800 transition flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 text-hoooplaaa-gold-400" />
            <span>{locale === 'en' ? 'Client Workspace' : 'ক্লায়েন্ট পোর্টাল'}</span>
          </Link>
          <Link
            href="/build"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow transition flex items-center gap-1.5"
          >
            <span>{locale === 'en' ? 'Build Package' : 'প্যাকেজ শুরু করুন'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-300 hover:text-white"
          aria-label="Toggle Mobile Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-hoooplaaa-navy-900 border-b border-hoooplaaa-navy-800 px-4 py-4 space-y-3">
          <Link
            href="/services"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-200 font-medium hover:text-hoooplaaa-gold-300"
          >
            {locale === 'en' ? 'Services' : 'সার্ভিসসমূহ'}
          </Link>
          <Link
            href="/packages"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-200 font-medium hover:text-hoooplaaa-gold-300"
          >
            {locale === 'en' ? '3-Platform Bundle (৳3,000)' : '৩-প্ল্যাটফর্ম বান্ডেল (৳৩,০০০)'}
          </Link>
          <Link
            href="/build"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-200 font-medium hover:text-hoooplaaa-gold-300"
          >
            {locale === 'en' ? 'Guided Package Builder' : 'গাইডেড প্যাকেজ বিল্ডার'}
          </Link>
          <Link
            href="/audit"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-200 font-medium hover:text-hoooplaaa-gold-300"
          >
            {locale === 'en' ? 'Free Initial Business Audit' : 'ফ্রি বিজনেস অডিট'}
          </Link>
          <Link
            href="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-slate-200 font-medium hover:text-hoooplaaa-gold-300"
          >
            {locale === 'en' ? 'How It Works' : 'কাজের প্রক্রিয়া'}
          </Link>
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-xs font-semibold rounded-lg border border-slate-700 text-slate-200"
            >
              {locale === 'en' ? 'Client Workspace' : 'ক্লায়েন্ট পোর্টাল'}
            </Link>
            <Link
              href="/build"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-xs font-bold rounded-lg bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 uppercase tracking-wider"
            >
              {locale === 'en' ? 'Build Package Online' : 'প্যাকেজ শুরু করুন'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
