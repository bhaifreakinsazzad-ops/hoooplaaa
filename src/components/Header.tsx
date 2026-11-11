'use client';
// Header component implementing the navigation from the design prototype
import Link from "next/link";
import { useState, useEffect } from "react";
import LocaleSwitcher from "./LocaleSwitcher";
import { useApp } from '@/components/providers/AppProviders';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { id: "home", labelEn: "Home", labelBn: "হোম", path: "/" },
  { id: "services", labelEn: "Services", labelBn: "সার্ভিস", path: "/services" },
  { id: "builder", labelEn: "Build package", labelBn: "প্যাকেজ তৈরি", path: "/builder" },
  { id: "checkout", labelEn: "Checkout", labelBn: "চেকআউট", path: "/checkout" },
  { id: "customer", labelEn: "Client workspace", labelBn: "ক্লায়েন্ট পোর্টাল", path: "/dashboard" },
  { id: "admin", labelEn: "Operations", labelBn: "অপারেশনস", path: "/admin" },
];

export default function Header() {
  const { locale } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const toggleMobile = () => {
    setMobileOpen(prev => !prev);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="main-nav bg-hoooplaaa-navy-950 text-hoooplaaa-ink-primary" role="navigation">
      <div className="wrap nav-flex">
        <Link href="/" className="brand" aria-label="HOOOPLAAA homepage">
          <span className="mark">H</span>
          <span className="brandtext">
            <b>HOOOPLAAA</b>
            <small>INCORPORATED</small>
          </span>
        </Link>
        {/* Desktop navigation */}
        <nav className="desktop-links" aria-label="Primary navigation">
          {navItems.map(item => (
            <Link
              key={item.id}
              href={item.path}
              className={`${isActive(item.path) ? "active" : ""} focus:outline-none focus-visible:ring-2 focus-visible:ring-hoooplaaa-gold-500`}
            >
              {locale === "en" ? item.labelEn : item.labelBn}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <LocaleSwitcher />
          <Link href="/builder" className="btn btn-gold btn-sm">
            {locale === "en" ? "Build a package ↗" : "প্যাকেজ তৈরি করুন ↗"}
          </Link>
          <button
            className="hamb focus:outline-none focus-visible:ring-2 focus-visible:ring-hoooplaaa-gold-500"
            id="menu-toggle"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={toggleMobile}
          >
            ☰
          </button>
        </div>
      </div>
      {/* Mobile navigation */}
      <nav
        className={`mobile-nav ${mobileOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        id="mobile-nav"
      >
        {navItems.map(item => (
          <Link
            key={item.id}
            href={item.path}
            className={`${isActive(item.path) ? "active" : ""} focus:outline-none focus-visible:ring-2 focus-visible:ring-hoooplaaa-gold-500`}
            onClick={() => setMobileOpen(false)}
          >
            {locale === "en" ? item.labelEn : item.labelBn}
          </Link>
        ))}
      </nav>
    </header>
  );
}
