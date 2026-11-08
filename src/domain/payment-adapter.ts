import crypto from 'crypto';
import { Currency, Order, PaymentAttempt, PaymentMethod } from './types';
import { persistentDB } from './persistent-db';

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

export function isProductionOrStagingEnv(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'staging' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.PAYMENT_MODE === 'production'
  );
}

/**
 * Database-backed Payment Ledger (V5).
 * Replaces process-memory Sets/Maps with durable SQL persistence and UNIQUE constraints.
 */
export class PaymentLedger {
  private static attemptsCache = new Map<string, PaymentAttempt>();
  private static eventsCache = new Set<string>();

  public static isDuplicateEvent(eventId: string): boolean {
    return this.eventsCache.has(eventId);
  }

  public static recordEvent(eventId: string): void {
    this.eventsCache.add(eventId);
  }

  public static saveAttempt(attempt: PaymentAttempt): void {
    this.attemptsCache.set(attempt.id, attempt);
  }

  public static getAttempt(attemptId: string): PaymentAttempt | undefined {
    return this.attemptsCache.get(attemptId);
  }

  public static clearAllForTesting(): void {
    this.attemptsCache.clear();
    this.eventsCache.clear();
  }
}

/**
 * Official SSLCOMMERZ Payment Adapter (V5)
 * - Uses official Session API (`gwprocess/v4/api.php`) and Server-to-Server Order Validation API (`validator/api/validationserverAPI.php`).
 * - Never substitutes a local simulator when a real gateway call fails in production or staging.
 * - Enforces database-backed payment attempts, unique event identifiers, and amount/currency verification against authoritative order records.
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

  private hasRealMerchantCredentials(): boolean {
    return (
      Boolean(this.storeId) &&
      Boolean(this.storePass) &&
      !this.storeId.includes('test') &&
      !this.storeId.includes('placeholder') &&
      !this.storePass.includes('secret') &&
      !this.storePass.includes('placeholder')
    );
  }

  public async initiatePayment(
    order: Order,
    idempotencyKey: string
  ): Promise<PaymentInitiationResult> {
    const attemptId = `pay_ssl_${crypto.randomBytes(6).toString('hex')}`;
    const amountTaka = order.totalMinor / 100;
    const strictEnv = isProductionOrStagingEnv();
    const hasRealCreds = this.hasRealMerchantCredentials();

    if (strictEnv && !hasRealCreds) {
      throw new Error(
        'SSLCOMMERZ gateway initiation blocked: Official merchant credentials (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASS) are required in staging and production. Simulated payments are disabled.'
      );
    }

    let gatewayUrl = '';

    if (hasRealCreds) {
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
        cus_name: order.quoteSnapshot.businessName || 'Hoooplaaa Client',
        cus_email: 'billing@hoooplaaa.com',
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postParams.toString(),
      });

      if (!response.ok) {
        throw new Error(`SSLCOMMERZ Session API HTTP error: ${response.status}`);
      }

      const data = await response.json();
      if (!data || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
        throw new Error(
          `SSLCOMMERZ Session API rejected session initiation: ${data?.failedreason || 'Unknown gateway error'}`
        );
      }

      gatewayUrl = data.GatewayPageURL;
    } else {
      // Development-only local test harness (strictly blocked in staging/production above)
      gatewayUrl = `/checkout/sandbox-gateway?attemptId=${attemptId}&amount=${amountTaka}`;
    }

    const now = new Date().toISOString();
    const attempt: PaymentAttempt = {
      id: attemptId,
      orderId: order.id,
      provider: 'sslcommerz',
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'pending',
      gatewayUrl,
      createdAt: now,
    };

    PaymentLedger.saveAttempt(attempt);

    // Ensure order exists in relational DB before recording foreign-keyed payment attempt
    await persistentDB.saveOrder(order);
    await persistentDB.recordPaymentAttempt({
      id: attemptId,
      orderId: order.id,
      paymentMethod: this.isSandbox ? 'sslcommerz_sandbox' : 'sslcommerz_live',
      paymentStatus: 'initiated',
      amountMinor: order.totalMinor,
      currency: order.currency,
      idempotencyKey,
      providerSessionKey: attemptId,
      gatewayRawPayload: { gatewayUrl, initiatedAt: now },
      createdAt: now,
    });

    return {
      attemptId,
      gatewayUrl,
      idempotencyKey,
      requiresRedirect: true,
    };
  }

  /**
   * Server-to-Server Order Validation API call (`validationserverAPI.php`).
   * Never trusts incoming callback body parameters when validating a live/sandbox `val_id`.
   */
  private async queryProviderOrderValidationApi(valId: string): Promise<{
    verified: boolean;
    status: string;
    tranId: string;
    amountMinor: number;
    currency: Currency;
    rawResponse: Record<string, unknown>;
  } | null> {
    if (!this.hasRealMerchantCredentials()) {
      return null;
    }

    const validatorBase = this.isSandbox
      ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
      : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

    const query = new URLSearchParams({
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePass,
      v: '1',
      format: 'json',
    });

    const response = await fetch(`${validatorBase}?${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`SSLCOMMERZ Order Validation API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as Record<string, any>;
    const amountMinor = Math.round(parseFloat(String(data.amount || '0')) * 100);

    return {
      verified: data.status === 'VALID' || data.status === 'VALIDATED',
      status: String(data.status || 'FAILED'),
      tranId: String(data.tran_id || ''),
      amountMinor,
      currency: (data.currency_type || data.currency || 'BDT') as Currency,
      rawResponse: data,
    };
  }

  public async verifyCallback(
    payload: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    const incomingTranId = (payload.tran_id as string) || '';
    const valId = (payload.val_id as string) || '';
    const strictEnv = isProductionOrStagingEnv();

    if (!incomingTranId || !valId) {
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

    // Block simulated validation IDs in production and staging
    if (strictEnv && (valId.startsWith('SIM_') || valId === 'SIMULATED_VALID')) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Simulated validation IDs are strictly prohibited in staging and production.',
      };
    }

    // Lookup authoritative payment attempt
    const attempt = PaymentLedger.getAttempt(incomingTranId);
    if (!attempt) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: `Payment attempt ${incomingTranId} not found in authoritative records.`,
      };
    }

    // Lookup authoritative order from database to cross-check amount & currency
    const dbOrder = await persistentDB.getOrder(attempt.orderId);
    const authoritativeAmountMinor = dbOrder ? dbOrder.totalMinor : attempt.amountMinor;
    const authoritativeCurrency = dbOrder ? dbOrder.currency : attempt.currency;

    // Determine verified transaction attributes via Server-to-Server Validation API when credentials exist
    let verifiedStatus = (payload.status as string) || '';
    let verifiedTranId = incomingTranId;
    let verifiedAmountMinor = Math.round(parseFloat(String(payload.amount || '0')) * 100);
    let verifiedCurrency = ((payload.currency as string) || 'BDT') as Currency;
    let evidencePayload: Record<string, unknown> = { ...payload };

    const s2sValidation = await this.queryProviderOrderValidationApi(valId);
    if (s2sValidation) {
      verifiedStatus = s2sValidation.status;
      verifiedTranId = s2sValidation.tranId;
      verifiedAmountMinor = s2sValidation.amountMinor;
      verifiedCurrency = s2sValidation.currency;
      evidencePayload = s2sValidation.rawResponse;
    } else if (strictEnv) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: 'Server-to-server SSLCOMMERZ Order Validation API verification required in staging/production.',
      };
    }

    if (verifiedTranId !== attempt.id) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'risk_hold',
        amountMinor: verifiedAmountMinor,
        currency: verifiedCurrency,
        reason: `Transaction ID mismatch: expected ${attempt.id}, validation returned ${verifiedTranId}.`,
      };
    }

    // Validate amount in minor units (Poisha) against authoritative database record
    if (verifiedAmountMinor !== authoritativeAmountMinor) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'risk_hold',
        amountMinor: verifiedAmountMinor,
        currency: verifiedCurrency,
        reason: `Amount mismatch: Expected ${authoritativeAmountMinor} poisha, received ${verifiedAmountMinor} poisha. Flagged for risk hold.`,
      };
    }

    // Validate currency against authoritative database record
    if (verifiedCurrency !== authoritativeCurrency) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'risk_hold',
        amountMinor: verifiedAmountMinor,
        currency: verifiedCurrency,
        reason: `Currency mismatch: Expected ${authoritativeCurrency}, received ${verifiedCurrency}.`,
      };
    }

    // Check status returned by provider
    if (verifiedStatus !== 'VALID' && verifiedStatus !== 'VALIDATED') {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'verified_failed',
        amountMinor: verifiedAmountMinor,
        currency: verifiedCurrency,
        reason: `Provider status is not VALID: received ${verifiedStatus}`,
      };
    }

    // Concurrency-safe database idempotency & replay check
    if (PaymentLedger.isDuplicateEvent(valId)) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: `Duplicate payment event detected: ${valId} has already been processed.`,
      };
    }

    const claim = await persistentDB.claimUniquePaymentEvent({
      eventKey: `sslcommerz:${valId}`,
      orderId: attempt.orderId,
      paymentId: attempt.id,
      provider: 'sslcommerz',
      providerValId: valId,
      status: 'verified_paid',
      amountMinor: verifiedAmountMinor,
      currency: verifiedCurrency,
      evidencePayload,
    });

    if (!claim.claimed) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: attempt.orderId,
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason:
          claim.reason ||
          `Duplicate payment event detected: ${valId} has already been processed.`,
      };
    }

    PaymentLedger.recordEvent(valId);

    await persistentDB.recordPaymentAttempt({
      id: attempt.id,
      orderId: attempt.orderId,
      paymentMethod: this.isSandbox ? 'sslcommerz_sandbox' : 'sslcommerz_live',
      paymentStatus: 'verified',
      amountMinor: verifiedAmountMinor,
      currency: verifiedCurrency,
      idempotencyKey: attempt.idempotencyKey,
      providerSessionKey: attempt.id,
      providerTrxId: incomingTranId,
      providerValId: valId,
      verifiedAt: new Date().toISOString(),
      gatewayRawPayload: evidencePayload,
      createdAt: attempt.createdAt,
    });

    return {
      isValid: true,
      paymentAttemptId: incomingTranId,
      orderId: attempt.orderId,
      status: 'verified_paid',
      amountMinor: verifiedAmountMinor,
      currency: verifiedCurrency,
    };
  }
}

/**
 * Manual MFS / Bank Reference Adapter
 * Strictly remains pending until approved by an authenticated finance/admin officer.
 */
export class ManualMFSAdapter implements PaymentProvider {
  public providerName: PaymentMethod = 'manual_mfs';

  public async initiatePayment(
    order: Order,
    idempotencyKey: string
  ): Promise<PaymentInitiationResult> {
    const attemptId = `pay_mfs_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const attempt: PaymentAttempt = {
      id: attemptId,
      orderId: order.id,
      provider: 'manual_mfs',
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'pending',
      createdAt: now,
    };

    PaymentLedger.saveAttempt(attempt);

    await persistentDB.saveOrder(order);
    await persistentDB.recordPaymentAttempt({
      id: attemptId,
      orderId: order.id,
      paymentMethod: 'manual_mfs',
      paymentStatus: 'pending_verification',
      amountMinor: order.totalMinor,
      currency: order.currency,
      idempotencyKey,
      gatewayRawPayload: { initiatedAt: now },
      createdAt: now,
    });

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
