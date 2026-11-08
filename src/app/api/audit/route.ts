import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/domain/audit-service';
import { auditListStore } from '@/domain/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, websiteOrPageUrl, contactEmail, contactPhone, primaryGoal } = body;

    const audit = AuditService.submitPreSaleAudit({
      businessName,
      websiteOrPageUrl,
      contactEmail,
      contactPhone,
      primaryGoal: primaryGoal || 'Business Readiness Review',
    });

    auditListStore.set(audit.id, audit);

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

export async function GET() {
  const audits = Array.from(auditListStore.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  return NextResponse.json({ success: true, audits });
}
