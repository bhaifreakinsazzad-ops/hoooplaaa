import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers/AppProviders';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'HOOOPLAAA INCORPORATED — Digital Infrastructure & Growth Engine',
  description:
    'Attract. Connect. Convert. Grow. Self-service agency commerce platform for Meta Business, Google Business Profile, and LinkedIn Company Page setups.',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'HOOOPLAAA INCORPORATED',
    description: 'Real digital agency commerce without mandatory sales calls.',
    siteName: 'HOOOPLAAA',
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
    <html lang="en" data-theme="concept-c" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-slate-50 text-slate-900">
        <AppProviders>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
