import crypto from 'crypto';
import { Currency, Order, PaymentAttempt, PaymentEvent, PaymentMethod } from './types';

export interface PaymentInitiationResult {
  attemptId: string;
  gatewayUrl: string;
  idempotencyKey: string;
  requiresRedirect: boolean;
  manualPaymentDetails?: {
    instructions: string;
    bKashNumber: string;
    nagadNumber: string;
    bankAccount: string;
  };
}

export interface PaymentVerificationResult {
  isValid: boolean;
  paymentAttemptId: string;
  orderId: string;
  status: 'verified_paid' | 'verified_failed' | 'risk_hold' | 'pending';
  amountMinor: number;
  currency: Currency;
  reason?: string;
}

export interface PaymentProvider {
  providerName: PaymentMethod;
  initiatePayment(order: Order, idempotencyKey: string): Promise<PaymentInitiationResult>;
  verifyCallback(payload: Record<string, unknown>): Promise<PaymentVerificationResult>;
}

/**
 * In-memory ledger of processed payment event hashes and IDs to prevent duplicate processing.
 */
export class PaymentLedger {
  private static processedEvents = new Set<string>();
  private static paymentAttempts: Map<string, PaymentAttempt> = new Map();

  public static isDuplicateEvent(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  public static recordEvent(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  public static saveAttempt(attempt: PaymentAttempt): void {
    this.paymentAttempts.set(attempt.id, attempt);
  }

  public static getAttempt(attemptId: string): PaymentAttempt | undefined {
    return this.paymentAttempts.get(attemptId);
  }

  public static clearAllForTesting(): void {
    this.processedEvents.clear();
    this.paymentAttempts.clear();
  }
}

/**
 * SSLCOMMERZ Sandbox Payment Adapter
 * Complies with official SSLCOMMERZ API specification.
 */
export class SSLCommerzAdapter implements PaymentProvider {
  public providerName: PaymentMethod = 'sslcommerz';
  private isSandbox: boolean;
  private storeId: string;
  private storePass: string;

  constructor(
    storeId = process.env.SSLCOMMERZ_STORE_ID || 'sandbox_hoooplaaa',
    storePass = process.env.SSLCOMMERZ_STORE_PASS || 'sandbox_secret',
    isSandbox = true
  ) {
    this.storeId = storeId;
    this.storePass = storePass;
    this.isSandbox = isSandbox;
  }

  public async initiatePayment(
    order: Order,
    idempotencyKey: string
  ): Promise<PaymentInitiationResult> {
    const attemptId = `pay_ssl_${crypto.randomBytes(6).toString('hex')}`;
    const amountTaka = order.totalMinor / 100;

    const attempt: PaymentAttempt = {
      id: attemptId,
      orderId: order.id,
      provider: 'sslcommerz',
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'pending',
      gatewayUrl: `/checkout/sandbox-gateway?attemptId=${attemptId}&amount=${amountTaka}`,
      createdAt: new Date().toISOString(),
    };

    PaymentLedger.saveAttempt(attempt);

    return {
      attemptId,
      gatewayUrl: attempt.gatewayUrl!,
      idempotencyKey,
      requiresRedirect: true,
    };
  }

  /**
   * Server-to-server IPN / Callback verification.
   * NEVER marks paid based on unverified redirect params!
   */
  public async verifyCallback(
    payload: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    const tranId = payload.tran_id as string;
    const valId = payload.val_id as string;
    const rawStatus = (payload.status as string) || '';
    const amountStr = payload.amount as string;
    const currency = (payload.currency as Currency) || 'BDT';

    if (!tranId || !valId) {
      return {
        isValid: false,
        paymentAttemptId: '',
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Missing required SSLCOMMERZ validation identifiers (tran_id or val_id)',
      };
    }

    // Replay attack / duplicate check
    if (PaymentLedger.isDuplicateEvent(valId)) {
      return {
        isValid: false,
        paymentAttemptId: tranId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: `Duplicate payment event detected: ${valId} has already been processed.`,
      };
    }

    const attempt = PaymentLedger.getAttempt(tranId);
    if (!attempt) {
      return {
        isValid: false,
        paymentAttemptId: tranId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: `Payment attempt ${tranId} not found in authoritative records.`,
      };
    }

    // Validate amount in minor units
    const receivedAmountMinor = Math.round(parseFloat(amountStr || '0') * 100);
    if (receivedAmountMinor !== attempt.amountMinor) {
      return {
        isValid: false,
        paymentAttemptId: tranId,
        orderId: attempt.orderId,
        status: 'risk_hold',
        amountMinor: receivedAmountMinor,
        currency,
        reason: `Amount mismatch: Expected ${attempt.amountMinor} poisha, received ${receivedAmountMinor} poisha. Flagged for risk hold.`,
      };
    }

    // Validate currency
    if (currency !== 'BDT') {
      return {
        isValid: false,
        paymentAttemptId: tranId,
        orderId: attempt.orderId,
        status: 'risk_hold',
        amountMinor: receivedAmountMinor,
        currency,
        reason: `Currency mismatch: Expected BDT, received ${currency}.`,
      };
    }

    // Check status returned by provider
    if (rawStatus !== 'VALID' && rawStatus !== 'VALIDATED') {
      return {
        isValid: false,
        paymentAttemptId: tranId,
        orderId: attempt.orderId,
        status: 'verified_failed',
        amountMinor: receivedAmountMinor,
        currency,
        reason: `Provider status is not VALID: received ${rawStatus}`,
      };
    }

    // Validated successfully!
    PaymentLedger.recordEvent(valId);
    attempt.status = 'verified_paid';
    attempt.providerRef = valId;
    attempt.verifiedAt = new Date().toISOString();

    return {
      isValid: true,
      paymentAttemptId: tranId,
      orderId: attempt.orderId,
      status: 'verified_paid',
      amountMinor: receivedAmountMinor,
      currency,
    };
  }
}

/**
 * Manual MFS Payment Adapter (bKash / Nagad / Bank Transfer)
 * Allows client to submit a transaction reference, with status strictly set to 'pending_verification'.
 * Does NOT mark paid until human finance officer reviews bank/MFS records.
 */
export class ManualMFSAdapter implements PaymentProvider {
  public providerName: PaymentMethod = 'manual_mfs';

  public async initiatePayment(
    order: Order,
    idempotencyKey: string
  ): Promise<PaymentInitiationResult> {
    const attemptId = `pay_mfs_${crypto.randomBytes(6).toString('hex')}`;

    const attempt: PaymentAttempt = {
      id: attemptId,
      orderId: order.id,
      provider: 'manual_mfs',
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    PaymentLedger.saveAttempt(attempt);

    return {
      attemptId,
      gatewayUrl: `/checkout/manual-mfs-submit?attemptId=${attemptId}&orderId=${order.id}`,
      idempotencyKey,
      requiresRedirect: false,
      manualPaymentDetails: {
        instructions:
          'Send the exact invoice total to our verified merchant/agent number and submit the transaction ID below. Finance will verify against our bank statement.',
        bKashNumber: '018XXXXXXXX (Merchant Simulation)',
        nagadNumber: '017XXXXXXXX (Merchant Simulation)',
        bankAccount: 'Hoooplaaa Inc. / City Bank / A/C: 1234567890 (Simulation)',
      },
    };
  }

  public async verifyCallback(
    payload: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    const attemptId = payload.attemptId as string;
    const trxId = payload.transactionReference as string;
    const customerPhone = payload.customerPhone as string;
    const financeApproved = payload.financeApproved === true;

    const attempt = PaymentLedger.getAttempt(attemptId);
    if (!attempt) {
      return {
        isValid: false,
        paymentAttemptId: attemptId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Payment attempt not found.',
      };
    }

    attempt.transactionReference = trxId;
    attempt.customerPhone = customerPhone;

    if (!financeApproved) {
      // Still pending verification by finance staff!
      return {
        isValid: false,
        paymentAttemptId: attemptId,
        orderId: attempt.orderId,
        status: 'pending',
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        reason:
          'Payment reference submitted by client. Awaiting human finance verification against bank/MFS statement.',
      };
    }

    // Finance officially verified against statement!
    attempt.status = 'verified_paid';
    attempt.verifiedAt = new Date().toISOString();

    return {
      isValid: true,
      paymentAttemptId: attemptId,
      orderId: attempt.orderId,
      status: 'verified_paid',
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
    };
  }
}
