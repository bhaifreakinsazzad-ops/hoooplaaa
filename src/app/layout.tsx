import type { Metadata } from 'next';
import { Montserrat, Noto_Sans_Bengali, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/providers/AppProviders';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HOOOPLAAA INCORPORATED — Marketing • Sales • Growth',
  description:
    'Measured Momentum. Premium digital marketing, performance growth, audience intelligence, tracking analytics, and HOOOPLAAA VA+ managed digital support with transparent BDT self-service checkout.',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'HOOOPLAAA INCORPORATED — Marketing • Sales • Growth',
    description:
      'Attract. Connect. Convert. Grow. Specialist-led digital infrastructure, advertising, VA+ managed support, CRM, and analytics with upfront BDT pricing.',
    siteName: 'HOOOPLAAA INCORPORATED',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${montserrat.variable} ${notoBengali.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col font-sans antialiased bg-brand-ivory text-brand-ink selection:bg-brand-gold/30 selection:text-brand-forest">
        <AppProviders>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
