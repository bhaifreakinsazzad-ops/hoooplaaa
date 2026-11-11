import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer bg-hoooplaaa-canvas-cream text-hoooplaaa-ink-primary" role="contentinfo">
      <div className="wrap footer-grid">
        <div>
          <div className="brand">
            <span className="mark">H</span>
            <span className="brandtext">
              <b>HOOOPLAAA</b>
              <small>INCORPORATED</small>
            </span>
          </div>
          <p>Attract. Connect. Convert. Grow. Premium digital infrastructure services for ambitious businesses.</p>
        </div>
        <div>
          <b>Explore</b>
          <div className="footer-links">
            <Link href="/services" className="footer-link focus:outline-none focus-visible:ring-2 focus-visible:ring-hoooplaaa-gold-500">Services</Link>
            <Link href="/builder" className="footer-link">Package configurator</Link>
            <Link href="/checkout" className="footer-link">Checkout preview</Link>
          </div>
        </div>
        <div>
          <b>Workspaces</b>
          <div className="footer-links">
            <Link href="/dashboard" className="footer-link">Client workspace</Link>
            <Link href="/admin" className="footer-link">Operations desk</Link>
            <Link href="/design-system" className="footer-link">Design system</Link>
          </div>
        </div>
      </div>
      <div className="footer-end">
        <span>© {year} HOOOPLAAA INCORPORATED · Interactive design reference, not a payment service.</span>
        <span>Design tokens · WCAG 2.2 AA target · English / বাংলা</span>
      </div>
    </footer>
  );
}
