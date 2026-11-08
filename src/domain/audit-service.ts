import { AuditRequest } from './types';
import crypto from 'crypto';

export class AuditService {
  private static auditRequests: Map<string, AuditRequest> = new Map();

  /**
   * Pre-Sale Initial Business Readiness Audit.
   * Free lead qualification and triage.
   * Truth-in-advertising rule: Does not claim to have accessed inaccessible private analytics!
   */
  public static submitPreSaleAudit(data: {
    businessName: string;
    websiteOrPageUrl: string;
    contactEmail: string;
    contactPhone?: string;
    primaryGoal: string;
  }): AuditRequest {
    if (!data.businessName || !data.contactEmail || !data.websiteOrPageUrl) {
      throw new Error('Business name, contact email, and primary URL are required.');
    }

    const id = `aud_pre_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const auditReq: AuditRequest = {
      id,
      type: 'pre_sale_initial',
      businessName: data.businessName,
      websiteOrPageUrl: data.websiteOrPageUrl,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      primaryGoal: data.primaryGoal,
      stage: 'submitted',
      qualificationStatus: 'pending',
      submittedAt: now,
    };

    this.auditRequests.set(id, auditReq);
    return auditReq;
  }

  /**
   * Post-Sale Detailed Audit.
   * Complimentary deep audit included with eligible business setup packages.
   */
  public static createPostSaleAudit(orderId: string, businessName: string): AuditRequest {
    const id = `aud_post_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const auditReq: AuditRequest = {
      id,
      type: 'post_sale_detailed',
      businessName,
      websiteOrPageUrl: `Order ref: ${orderId}`,
      contactEmail: '',
      primaryGoal: 'Post-Setup Foundation QA & Next-Step Growth Diagnosis',
      stage: 'submitted',
      qualificationStatus: 'qualified',
      submittedAt: now,
    };

    this.auditRequests.set(id, auditReq);
    return auditReq;
  }

  public static getAudit(id: string): AuditRequest | undefined {
    return this.auditRequests.get(id);
  }

  public static completeAuditReview(
    id: string,
    reviewerId: string,
    score: number,
    findings: string[],
    notes: string,
    recommendedSku?: string
  ): AuditRequest {
    const audit = this.auditRequests.get(id);
    if (!audit) throw new Error('Audit request not found.');

    audit.reviewerId = reviewerId;
    audit.scoreOverall = score;
    audit.keyFindings = findings;
    audit.reviewerNotes = notes;
    audit.recommendedSku = recommendedSku;
    audit.stage = 'completed';
    audit.completedAt = new Date().toISOString();

    return audit;
  }
}
