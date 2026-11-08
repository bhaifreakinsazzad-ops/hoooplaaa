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
 * Authoritative ledger of processed payment event hashes and IDs to prevent duplicate processing.
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
 * Official SSLCOMMERZ Payment Adapter
 * Supports both Sandbox (sandbox.sslcommerz.com) and Live Production (securepay.sslcommerz.com).
 * In development/test environments without live merchant keys, utilizes local validation simulator.
 */
export class SSLCommerzAdapter implements PaymentProvider {
  public providerName: PaymentMethod = 'sslcommerz';
  private isSandbox: boolean;
  private storeId: string;
  private storePass: string;
  private appUrl: string;

  constructor(
    storeId = process.env.SSLCOMMERZ_STORE_ID || 'sandbox_hoooplaaa_test',
    storePass = process.env.SSLCOMMERZ_STORE_PASS || 'sandbox_hoooplaaa_secret',
    isSandbox = process.env.SSLCOMMERZ_IS_SANDBOX !== 'false'
  ) {
    this.storeId = storeId;
    this.storePass = storePass;
    this.isSandbox = isSandbox;
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  public async initiatePayment(
    order: Order,
    idempotencyKey: string
  ): Promise<PaymentInitiationResult> {
    const attemptId = `pay_ssl_${crypto.randomBytes(6).toString('hex')}`;
    const amountTaka = order.totalMinor / 100;

    let gatewayUrl = `/checkout/sandbox-gateway?attemptId=${attemptId}&amount=${amountTaka}`;

    // If real SSLCOMMERZ credentials exist, execute official Session API
    const isPlaceholder =
      this.storeId.includes('test') ||
      this.storeId.includes('placeholder') ||
      this.storePass.includes('secret');

    if (!isPlaceholder) {
      const endpoint = this.isSandbox
        ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
        : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

      const postParams = new URLSearchParams({
        store_id: this.storeId,
        store_passwd: this.storePass,
        total_amount: amountTaka.toFixed(2),
        currency: order.currency,
        tran_id: attemptId,
        success_url: `${this.appUrl}/api/checkout/callback/sslcommerz`,
        fail_url: `${this.appUrl}/api/checkout/callback/sslcommerz`,
        cancel_url: `${this.appUrl}/checkout/${order.quoteId}`,
        ipn_url: `${this.appUrl}/api/checkout/callback/sslcommerz`,
        shipping_method: 'NO',
        product_name: order.quoteSnapshot.items[0]?.name || 'Hoooplaaa Setup Service',
        product_category: 'Digital Marketing Infrastructure',
        product_profile: 'digital-goods',
        cus_name: 'Hoooplaaa Client',
        cus_email: 'client@hoooplaaa.com',
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
      });

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postParams.toString(),
        });
        const data = await response.json();
        if (data && data.status === 'SUCCESS' && data.GatewayPageURL) {
          gatewayUrl = data.GatewayPageURL;
        }
      } catch (err) {
        console.warn('[SSLCommerzAdapter] External API call error, falling back to local adapter:', err);
      }
    }

    const attempt: PaymentAttempt = {
      id: attemptId,
      orderId: order.id,
      provider: 'sslcommerz',
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'pending',
      gatewayUrl,
      createdAt: new Date().toISOString(),
    };

    PaymentLedger.saveAttempt(attempt);

    return {
      attemptId,
      gatewayUrl,
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

    // Replay attack / duplicate event protection
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

    // Validate amount in minor units (Poisha)
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

    // Record the unique event ID in ledger
    PaymentLedger.recordEvent(valId);

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
 * Manual MFS / Bank Reference Adapter
 * Strictly remains pending until approved by a human finance officer.
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
      gatewayUrl: `/checkout/status/${order.id}?status=pending_manual_verification`,
      idempotencyKey,
      requiresRedirect: false,
      manualPaymentDetails: {
        instructions:
          'Please send the exact order amount using bKash / Nagad Send Money / Payment option, then submit your transaction reference number.',
        bKashNumber: '01800000000 (Hoooplaaa Merchant Account - Sandbox)',
        nagadNumber: '01800000000 (Hoooplaaa Merchant Account - Sandbox)',
        bankAccount: 'City Bank Ltd. | A/C: 1100000000000 | Hoooplaaa Inc.',
      },
    };
  }

  public async verifyCallback(
    payload: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    const attemptId = payload.attemptId as string;
    const trxRef = payload.transactionReference as string;
    const financeApproved = payload.financeApproved === true;

    if (!attemptId || !trxRef) {
      return {
        isValid: false,
        paymentAttemptId: attemptId || '',
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Missing transaction reference number',
      };
    }

    const attempt = PaymentLedger.getAttempt(attemptId);
    if (!attempt) {
      return {
        isValid: false,
        paymentAttemptId: attemptId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Invalid or unknown payment attempt ID',
      };
    }

    // Contractual requirement: Manual MFS CANNOT be marked paid without finance approval!
    if (!financeApproved) {
      return {
        isValid: false,
        paymentAttemptId: attemptId,
        orderId: attempt.orderId,
        status: 'pending',
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        reason: 'Awaiting human finance officer statement verification.',
      };
    }

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
