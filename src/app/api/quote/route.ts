import { NextRequest, NextResponse } from 'next/server';
import { calculateServerQuote } from '@/domain/pricing-engine';
import { persistentDB } from '@/domain/persistent-db';
import { authenticateRequest } from '@/domain/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      businessId = 'biz_guest',
      businessName,
      businessProfile = {},
      selectedPlatformSkus = [],
      selectedAddonSkus = [],
    } = body;

    if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
      return NextResponse.json(
        { error: 'Business Name is required to generate an authoritative quote.' },
        { status: 400 }
      );
    }

    const auth = await authenticateRequest(req);

    // Server-authoritative pricing & eligibility calculation (ignores any client price inputs)
    const quote = calculateServerQuote({
      businessId: auth.authenticated ? auth.user.organizationId : businessId,
      businessName: businessName.trim(),
      businessProfile,
      selectedPlatformSkus,
      selectedAddonSkus,
    });

    // Await durable relational persistence
    await persistentDB.saveQuote(
      quote,
      auth.authenticated ? auth.user.id : undefined,
      auth.authenticated ? auth.user.organizationId : undefined
    );

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error calculating server quote.' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get('id');
  if (!quoteId) {
    return NextResponse.json({ error: 'Quote ID is required.' }, { status: 400 });
  }

  const quote = await persistentDB.getQuote(quoteId);
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found or expired.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, quote });
}
