'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/providers/AppProviders';
import { useT } from '@/lib/i18n';
import { Menu, X } from 'lucide-react';

export function Header() {
  const { locale, setLocale } = useApp();
  const { t } = useT();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/services', label: t('navServices') },
    { href: '/packages', label: t('navPackages') },
    { href: '/build', label: t('navBuild') },
    { href: '/audit', label: t('navAudit') },
    { href: '/how-it-works', label: t('navHowItWorks') },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-50 border-b border-brand-gold/20 bg-brand-forest text-brand-platinum">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Clean single-line brand wordmark */}
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap font-serif text-lg font-semibold tracking-[0.18em] text-brand-ivory transition-colors hover:text-brand-softgold sm:text-xl"
          aria-label="HOOOPLAAA INCORPORATED Home"
        >
          HOOOPLAAA
        </Link>

        {/* Zone 2: Single-row editorial text navigation */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap text-[13px] font-medium tracking-wide transition-colors ${
                isActive(item.href)
                  ? 'text-brand-gold'
                  : 'text-brand-platinum/85 hover:text-brand-ivory'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: Compact EN/BN toggle + Workspace + 1 primary CTA */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
            aria-label={locale === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}
            className="whitespace-nowrap border border-brand-gold/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-softgold transition-colors hover:border-brand-gold hover:text-brand-ivory"
          >
            {locale === 'en' ? 'BN' : 'EN'}
          </button>

          <Link
            href="/dashboard"
            className="hidden sm:inline-block whitespace-nowrap text-[13px] font-medium text-brand-platinum/85 transition-colors hover:text-brand-ivory"
          >
            {t('navWorkspace')}
          </Link>

          <Link
            href="/build"
            className="hidden sm:inline-flex whitespace-nowrap items-center justify-center bg-brand-gold px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-brand-forest transition-colors hover:bg-brand-softgold"
          >
            {t('navBuild')}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center border border-brand-gold/30 p-2 text-brand-ivory lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-brand-gold/20 bg-brand-forest px-4 pb-5 pt-3 lg:hidden">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2.5 text-sm font-medium border-b border-brand-teal/60 ${
                  isActive(item.href) ? 'text-brand-gold' : 'text-brand-platinum'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 text-sm font-medium text-brand-platinum border-b border-brand-teal/60"
            >
              {t('navWorkspace')}
            </Link>
            <div className="pt-3">
              <Link
                href="/build"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full bg-brand-gold py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-brand-forest"
              >
                {t('navBuild')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
