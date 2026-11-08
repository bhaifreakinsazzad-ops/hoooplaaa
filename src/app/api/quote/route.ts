import { NextRequest, NextResponse } from 'next/server';
import { calculateServerQuote, ConfiguratorSelections } from '@/domain/pricing-engine';
import { quoteStore } from '@/domain/store';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConfiguratorSelections;

    if (!body || !body.selectedPlatformSkus) {
      return NextResponse.json(
        { error: 'Invalid configuration payload: selectedPlatformSkus is required.' },
        { status: 400 }
      );
    }

    const quote = calculateServerQuote(body);
    quoteStore.set(quote.id, quote);

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to calculate server quote.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get('id');
  if (!quoteId) {
    return NextResponse.json({ error: 'Quote ID is required.' }, { status: 400 });
  }

  const quote = quoteStore.get(quoteId);
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found or expired.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, quote });
}
