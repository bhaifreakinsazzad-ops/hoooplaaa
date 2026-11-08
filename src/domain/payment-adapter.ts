import crypto from 'crypto';
import { Currency, Order, PaymentMethod } from './types';
import { persistentDB, DbPaymentRecord } from './persistent-db';

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
  /** Present only when isValid: data the trusted server passes to the atomic settlement RPC. */
  providerValId?: string;
  settlementSource?: 'sslcommerz_s2s_validated' | 'local_simulator';
  evidence?: Record<string, unknown>;
}

export interface PaymentProvider {
  providerName: PaymentMethod;
  initiatePayment(order: Order, idempotencyKey?: string): Promise<PaymentInitiationResult>;
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

const OPEN_GATEWAY_SESSION_MAX_AGE_MS = 25 * 60 * 1000;

/**
 * Stable logical payment-session idempotency.
 *  - At most ONE open attempt exists per (order, payment method) — enforced by a partial unique index.
 *  - A repeated/concurrent checkout request re-uses that open attempt instead of creating a new one.
 *  - A new attempt is created only after the previous one is terminal (failed) or a gateway session
 *    went stale; its idempotency key is derived from the attempt sequence (never Date.now()).
 */
async function acquirePaymentAttempt(params: {
  order: Order;
  paymentMethod: string;
  attemptPrefix: string;
  idempotencyKeyHint?: string;
  initialStatus: 'initiated' | 'pending_verification';
  initialPayload: Record<string, unknown>;
}): Promise<{ attempt: DbPaymentRecord; created: boolean }> {
  const { order, paymentMethod } = params;
  const existingOrder = await persistentDB.getOrder(order.id);
  if (!existingOrder) {
    await persistentDB.saveOrder(order);
  }

  const history = (await persistentDB.getPaymentsForOrder(order.id)).filter(
    (p) => p.paymentMethod === paymentMethod
  );
  const open = history.find(
    (p) => p.paymentStatus === 'initiated' || p.paymentStatus === 'pending_verification'
  );
  if (open) {
    const ageMs = Date.now() - new Date(open.createdAt).getTime();
    const stale =
      paymentMethod !== 'manual_mfs' &&
      open.paymentStatus === 'initiated' &&
      ageMs > OPEN_GATEWAY_SESSION_MAX_AGE_MS;
    if (!stale) {
      return { attempt: open, created: false };
    }
    await persistentDB.recordPaymentAttempt({
      ...open,
      paymentStatus: 'failed',
      rejectionReason: 'gateway_session_expired',
    });
  }

  const now = new Date().toISOString();
  const idempotencyKey =
    params.idempotencyKeyHint || `idemp_${order.id}_${paymentMethod}_${history.length}`;
  const created = await persistentDB.createPaymentAttemptOnce({
    id: `${params.attemptPrefix}${crypto.randomBytes(6).toString('hex')}`,
    orderId: order.id,
    paymentMethod,
    paymentStatus: params.initialStatus,
    amountMinor: order.totalMinor,
    currency: order.currency,
    idempotencyKey,
    gatewayRawPayload: { ...params.initialPayload, initiatedAt: now },
    createdAt: now,
  });
  return { attempt: created.record, created: created.created };
}

/**
 * Stateless PostgreSQL-backed Payment Ledger (V6).
 * All in-memory Maps and Sets have been eliminated.
 * Every payment attempt and replay-protection event is persisted in PostgreSQL (`payments` & `payment_events`).
 */
export class PaymentLedger {
  public static async clearAllForTesting(): Promise<void> {
    await persistentDB.clearAllForTesting();
  }
}

/**
 * Official SSLCOMMERZ Payment Adapter (V6)
 * - Uses official Session API (`gwprocess/v4/api.php`) and Server-to-Server Order Validation API (`validator/api/validationserverAPI.php`).
 * - Never substitutes a local simulator when a real gateway call fails in production or staging.
 * - Reads payment attempts and enforces unique replay protection strictly from PostgreSQL (`payments` and `payment_events`).
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
    // Credentials are "real" unless they are empty or the documented placeholders from .env.example.
    return (
      Boolean(this.storeId) &&
      Boolean(this.storePass) &&
      this.storeId !== 'sandbox_hoooplaaa_test' &&
      this.storePass !== 'sandbox_hoooplaaa_secret' &&
      !this.storeId.includes('placeholder') &&
      !this.storePass.includes('placeholder')
    );
  }

  public async initiatePayment(
    order: Order,
    idempotencyKey?: string
  ): Promise<PaymentInitiationResult> {
    const strictEnv = isProductionOrStagingEnv();
    const hasRealCreds = this.hasRealMerchantCredentials();

    if (strictEnv && !hasRealCreds) {
      throw new Error(
        'SSLCOMMERZ gateway initiation blocked: Official merchant credentials (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASS) are required in staging and production. Simulated payments are disabled.'
      );
    }

    const paymentMethod = this.isSandbox ? 'sslcommerz_sandbox' : 'sslcommerz_live';
    const { attempt, created } = await acquirePaymentAttempt({
      order,
      paymentMethod,
      attemptPrefix: 'pay_ssl_',
      idempotencyKeyHint: idempotencyKey,
      initialStatus: 'initiated',
      initialPayload: {},
    });

    if (!created) {
      const existingUrl = attempt.gatewayRawPayload?.gatewayUrl as string | undefined;
      if (!existingUrl) {
        throw new Error('Payment session is being prepared. Please retry in a moment.');
      }
      return {
        attemptId: attempt.id,
        gatewayUrl: existingUrl,
        idempotencyKey: attempt.idempotencyKey,
        requiresRedirect: true,
      };
    }

    const attemptId = attempt.id;
    const amountTaka = order.totalMinor / 100;
    let gatewayUrl = '';

    try {
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
    } catch (gatewayError) {
      await persistentDB.recordPaymentAttempt({
        ...attempt,
        paymentStatus: 'failed',
        rejectionReason: 'gateway_session_creation_failed',
      });
      throw gatewayError;
    }

    await persistentDB.recordPaymentAttempt({
      ...attempt,
      providerSessionKey: attemptId,
      gatewayRawPayload: { ...attempt.gatewayRawPayload, gatewayUrl },
    });

    return {
      attemptId,
      gatewayUrl,
      idempotencyKey: attempt.idempotencyKey,
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

    // Lookup authoritative payment attempt directly from PostgreSQL `public.payments`
    const attempt = await persistentDB.getPaymentByAttemptId(incomingTranId);
    if (!attempt) {
      return {
        isValid: false,
        paymentAttemptId: incomingTranId,
        orderId: '',
        status: 'verified_failed',
        amountMinor: 0,
        currency: 'BDT',
        reason: `Payment attempt ${incomingTranId} not found in authoritative PostgreSQL records.`,
      };
    }

    // Lookup authoritative order from PostgreSQL `public.orders` to cross-check amount & currency
    const dbOrder = await persistentDB.getOrder(attempt.orderId);
    const authoritativeAmountMinor = dbOrder ? dbOrder.totalMinor : attempt.amountMinor;
    const authoritativeCurrency = (dbOrder ? dbOrder.currency : attempt.currency) as Currency;

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

    // verifyCallback is READ-ONLY. Replay protection, the payment_events row, the payment
    // status and the order status are written together, atomically, by the settle_order_payment_paid
    // RPC (a failed settlement therefore leaves nothing half-written and the IPN can safely retry).
    const providerValidated = Boolean(s2sValidation);
    return {
      isValid: true,
      paymentAttemptId: incomingTranId,
      orderId: attempt.orderId,
      status: 'verified_paid',
      amountMinor: verifiedAmountMinor,
      currency: verifiedCurrency,
      providerValId: valId,
      settlementSource: providerValidated ? 'sslcommerz_s2s_validated' : 'local_simulator',
      evidence: {
        providerValidated,
        status: verifiedStatus,
        tranId: verifiedTranId,
        valId,
        amountMinor: verifiedAmountMinor,
        currency: verifiedCurrency,
        validatedAt: new Date().toISOString(),
        raw: evidencePayload,
      },
    };
  }
}

/**
 * Manual MFS / Bank Reference Adapter (V6)
 * Strictly remains pending until approved by an authenticated finance/admin officer.
 * Reads and persists payment attempts in PostgreSQL (`public.payments`).
 */
export class ManualMFSAdapter implements PaymentProvider {
  public providerName: PaymentMethod = 'manual_mfs';

  public async initiatePayment(
    order: Order,
    idempotencyKey?: string
  ): Promise<PaymentInitiationResult> {
    // The attempt starts as 'initiated'. It only becomes 'pending_verification' once the customer
    // submits a transaction reference (POST /api/checkout/manual-mfs). Finance can never approve an
    // attempt that has no submitted reference.
    const { attempt } = await acquirePaymentAttempt({
      order,
      paymentMethod: 'manual_mfs',
      attemptPrefix: 'pay_mfs_',
      idempotencyKeyHint: idempotencyKey,
      initialStatus: 'initiated',
      initialPayload: {},
    });

    return {
      attemptId: attempt.id,
      gatewayUrl: `/checkout/status/${order.id}?status=pending_manual_verification`,
      idempotencyKey: attempt.idempotencyKey,
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

  /**
   * Manual MFS settlement is NEVER decided from a request payload. This only reports the attempt
   * state; approval happens exclusively through POST /api/admin/finance/verify (finance/admin
   * session), which calls the atomic settlement RPC.
   */
  public async verifyCallback(
    payload: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    const attemptId = payload.attemptId as string;
    const trxRef = payload.transactionReference as string;

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

    const attempt = await persistentDB.getPaymentByAttemptId(attemptId);
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

    return {
      isValid: false,
      paymentAttemptId: attemptId,
      orderId: attempt.orderId,
      status: 'pending',
      amountMinor: attempt.amountMinor,
      currency: attempt.currency as Currency,
      reason: 'Awaiting human finance officer statement verification.',
    };
  }
}
