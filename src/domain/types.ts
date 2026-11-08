// HOOOPLAAA INCORPORATED — CORE DOMAIN TYPES
// Currency representation: all monetary amounts are stored in minor units (Poisha: 1 BDT = 100 Poisha)

export type Currency = 'BDT';
export type BillingPeriod = 'one_time' | 'weekly' | 'monthly' | 'quote';

export type PublicationStatus =
  | 'draft'
  | 'source_listed'
  | 'needs_verification'
  | 'approved_internal'
  | 'published'
  | 'paused'
  | 'retired'
  | 'blocked';

export type UserRole =
  | 'customer'
  | 'staff'
  | 'fulfillment'
  | 'finance'
  | 'admin'
  | 'super_admin';

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  nameBn: string;
  displayOrder: number;
}

export interface Service {
  id: string;
  sku: string;
  slug: string;
  categoryId: string;
  name: string;
  nameBn: string;
  shortDescription: string;
  shortDescriptionBn: string;
  basePriceMinor: number; // in Poisha
  billingPeriod: BillingPeriod;
  publicationStatus: PublicationStatus;
  checkoutEnabled: boolean; // default false per security rules
  requiresQuote: boolean;
  deliveryTarget: string;
  inclusions: string[];
  exclusions: string[];
  prerequisites: string[];
  ownerConfirmedPrice: boolean;
  provenance: string;
}

export interface BusinessProfile {
  id: string;
  ownerUserId: string;
  name: string;
  type: 'retail' | 'ecommerce' | 'service_agency' | 'local_trade' | 'tech_startup' | 'other';
  operatingModel: 'in_person_storefront' | 'service_area_in_person' | 'online_only_no_in_person';
  country: string;
  city?: string;
  websiteUrl?: string;
  hasPhysicalStorefront: boolean;
  conductsInPersonVisits: boolean;
  facebookPageStatus: 'none' | 'existing_unclaimed' | 'existing_claimed' | 'restricted';
  metaPortfolioStatus: 'none' | 'created' | 'unverified' | 'restricted';
  googleProfileStatus: 'none' | 'existing_verified' | 'existing_unverified' | 'duplicate_issue';
  linkedInStatus: 'none' | 'existing_page' | 'personal_profile_only';
  websiteCmsAccess: boolean;
}

export interface EligibilityFlag {
  code: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  messageBn: string;
}

export interface EligibilityEvaluation {
  isEligible: boolean;
  canSelfCheckout: boolean;
  flags: EligibilityFlag[];
  recommendedAlternativeSku?: string;
  customScopeReason?: string;
}

export interface QuoteItem {
  sku: string;
  name: string;
  nameBn: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  billingPeriod: BillingPeriod;
  inclusionsSnapshot: string[];
  exclusionsSnapshot: string[];
  deliveryTarget: string;
}

export interface QuoteSnapshot {
  id: string;
  businessId: string;
  businessName: string;
  createdAt: string;
  expiresAt: string;
  ruleVersion: string;
  termsHash: string;
  items: QuoteItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: Currency;
  eligibility: EligibilityEvaluation;
  status: 'draft' | 'priced' | 'accepted' | 'expired' | 'requires_manual_scope';
  claimToken?: string;
  claimTokenHash?: string;
  clientIp?: string;
  customerId?: string;
  organizationId?: string;
}

export type OrderStatus =
  | 'created'
  | 'awaiting_payment'
  | 'payment_under_review'
  | 'paid'
  | 'awaiting_requirements'
  | 'ready_for_fulfillment'
  | 'in_progress'
  | 'qa_review'
  | 'delivered'
  | 'accepted'
  | 'closed'
  | 'blocked_waiting_customer'
  | 'blocked_external_platform'
  | 'cancelled'
  | 'refunded';

export type FinancialStatus =
  | 'unpaid'
  | 'pending_verification'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'disputed';

export type IntakeStatus =
  | 'not_started'
  | 'partially_completed'
  | 'completed'
  | 'needs_clarification';

export interface OrderItem {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  scopeSnapshot: {
    inclusions: string[];
    exclusions: string[];
    deliveryTarget: string;
  };
}

export interface Order {
  id: string;
  orderNumber: string; // e.g., HI-202611-0012
  businessId: string;
  quoteId: string;
  customerUserId: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  intakeStatus: IntakeStatus;
  totalMinor: number;
  currency: Currency;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  slaStartedAt?: string; // Started ONLY when payment is verified AND intake is complete!
  deliveryTargetDate?: string;
  deliveredAt?: string;
  acceptedAt?: string;
  assignedSpecialistId?: string;
  assignedSpecialistName?: string;
  quoteSnapshot: QuoteSnapshot;
  organizationId?: string;
}

export type PaymentMethod = 'sslcommerz' | 'bkash_direct' | 'manual_mfs' | 'bank_transfer';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  provider: PaymentMethod;
  idempotencyKey: string;
  amountMinor: number;
  currency: Currency;
  status: 'initiated' | 'pending' | 'verified_paid' | 'verified_failed' | 'risk_hold' | 'refunded';
  providerRef?: string;
  gatewayUrl?: string;
  customerPhone?: string;
  transactionReference?: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface PaymentEvent {
  id: string;
  paymentAttemptId: string;
  externalEventId: string;
  rawPayload: Record<string, unknown>;
  payloadHash: string;
  validationStatus: 'valid' | 'invalid_signature' | 'amount_mismatch' | 'currency_mismatch' | 'duplicate';
  receivedAt: string;
}

export interface IntakeSubmission {
  id: string;
  orderId: string;
  businessName: string;
  targetAudience: string;
  brandColors?: string;
  contactEmail: string;
  contactWhatsApp: string;
  existingPageLinks?: string;
  partnerInviteStatus: 'invitation_sent' | 'pending_instructions' | 'not_applicable';
  notes?: string;
  submittedAt: string;
  isComplete: boolean;
}

export interface FileAttachment {
  id: string;
  orderId: string;
  uploadedByUserId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
  isPrivate: boolean;
  uploadedAt: string;
  downloadUrl?: string;
  category?: string;
}

export interface Deliverable {
  id: string;
  orderId: string;
  title: string;
  description: string;
  accessLinks: Array<{ label: string; url: string }>;
  deliverableFileIds: string[];
  deliveredAt: string;
  deliveredByStaffId: string;
  qaApprovedByStaffId: string;
  qaApprovedAt: string;
  clientAcceptanceStatus: 'pending' | 'accepted' | 'revision_requested';
  revisionNote?: string;
}

export interface AuditRequest {
  id: string;
  type: 'pre_sale_initial' | 'post_sale_detailed';
  businessName: string;
  websiteOrPageUrl: string;
  contactEmail: string;
  contactPhone?: string;
  primaryGoal: string;
  stage: 'submitted' | 'triaged' | 'in_review' | 'completed' | 'declined';
  qualificationStatus: 'qualified' | 'disqualified_unclear_scope' | 'pending';
  reviewerId?: string;
  reviewerNotes?: string;
  scoreOverall?: number; // 0-100
  keyFindings?: string[];
  recommendedSku?: string;
  submittedAt: string;
  completedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}
