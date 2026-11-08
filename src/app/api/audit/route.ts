import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/domain/audit-service';
import { persistentDB } from '@/domain/persistent-db';
import { authenticateRequest, requireRole } from '@/domain/auth-guard';

/**
 * POST /api/audit
 * Submits a Pre-Sale Initial Readiness Audit request and awaits database persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, websiteOrPageUrl, contactEmail, contactPhone, primaryGoal } = body;

    const auth = await authenticateRequest(req);
    const customerId = auth.authenticated ? auth.user.id : undefined;

    const audit = AuditService.submitPreSaleAudit({
      businessName,
      websiteOrPageUrl,
      contactEmail,
      contactPhone,
      primaryGoal: primaryGoal || 'Business Readiness Review',
    });

    await persistentDB.saveAuditRequest(audit, customerId);

    return NextResponse.json({
      success: true,
      message: 'Initial readiness audit request submitted. We will inspect your public URLs.',
      audit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error submitting audit request.' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/audit
 * Confidential audit listing restricted to authenticated staff roles ('admin', 'finance', 'engineer').
 * Unauthenticated -> 401. Customer -> 403.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'finance', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const audits = await persistentDB.listAuditRequests();
  return NextResponse.json({ success: true, audits });
}
