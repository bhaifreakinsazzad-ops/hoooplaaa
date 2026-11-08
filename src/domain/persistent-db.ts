import { constantTimeEqualHex, hashGuestClaimToken, stripClaimSecrets } from './guest-claim';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  // @ts-ignore
  (globalThis as any).WebSocket = class DummyWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 3;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
import {
  QuoteSnapshot,
  Order,
  IntakeSubmission,
  FileAttachment,
  AuditRequest,
  AuditLogEntry,
  UserRole,
} from './types';
import { OrderService } from './order-service';
import {
  supabasePgliteFetch,
  resetTestPostgresData,
} from '../testing/supabase-pglite-bridge';

export interface DbUserProfile {
  id: string; // UUID referencing auth.users.id
  organizationId: string; // UUID referencing public.organizations.id
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: 'customer' | 'finance' | 'engineer' | 'admin';
  createdAt: string;
}

export interface DbPaymentRecord {
  id: string; // attempt_code (e.g. pay_ssl_...)
  orderId: string; // order_code (e.g. ord_...)
  paymentMethod: string;
  paymentStatus:
    | 'unpaid'
    | 'initiated'
    | 'pending_verification'
    | 'verified'
    | 'paid'
    | 'failed'
    | 'refunded';
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  providerSessionKey?: string;
  providerTrxId?: string;
  providerValId?: string;
  manualSenderPhone?: string;
  manualTrxReference?: string;
  verifiedByFinanceId?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  gatewayRawPayload: Record<string, unknown>;
  createdAt: string;
}

export interface DbDeliverableRecord {
  id: string;
  orderId: string;
  uploadedBy: string;
  title: string;
  storageBucketPath: string;
  verificationNotes: string;
  qaChecklistPassed: boolean;
  createdAt: string;
}

export interface DbRevisionRecord {
  id: string;
  orderId: string;
  requestedBy: string;
  revisionNotes: string;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(input: string): boolean {
  return UUID_REGEX.test(input);
}

export function toDeterministicUuid(input: string): string {
  if (UUID_REGEX.test(input)) return input.toLowerCase();
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Authoritative Supabase PostgreSQL & Storage Persistence Engine (V6).
 * - Uses `@supabase/supabase-js` exclusively for Auth, PostgreSQL, and Private Storage (`order-assets`).
 * - Zero `node:sqlite`, zero local JSON, zero `.runtime/` filesystem dependency, zero predefined accounts.
 * - Throws an explicit `SupabaseConfigurationError` when invoked without valid Supabase credentials outside test bridge mode.
 */
class PersistentDatabaseEngine {
  private adminClient: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;

  private resolveSupabaseConfig(): {
    supabaseUrl: string;
    serviceRoleKey: string;
    anonKey: string;
    isTestBridge: boolean;
  } {
    const isTestBridge = process.env.SUPABASE_TEST_BRIDGE === 'true';
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqmyqezuoscpgqwtvblu.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (isTestBridge) {
      if (
        process.env.APP_ENV === 'production' ||
        process.env.APP_ENV === 'staging' ||
        process.env.VERCEL_ENV === 'production' ||
        process.env.VERCEL_ENV === 'preview'
      ) {
        throw new Error(
          'SupabaseConfigurationError: SUPABASE_TEST_BRIDGE cannot be enabled in staging or production.'
        );
      }
      return {
        supabaseUrl,
        serviceRoleKey: 'test-service-role-key',
        anonKey: 'test-anon-key',
        isTestBridge: true,
      };
    }

    const isInvalidServiceKey =
      !serviceRoleKey ||
      serviceRoleKey.includes('placeholder') ||
      serviceRoleKey === 'your-service-role-key';

    const isInvalidAnonKey =
      !anonKey || anonKey.includes('placeholder') || anonKey === 'your-anon-key';

    if (isInvalidServiceKey) {
      throw new Error(
        'SupabaseConfigurationError: SUPABASE_SERVICE_ROLE_KEY is required for privileged server database operations. Substituting the public anonymous key is strictly prohibited.'
      );
    }

    if (isInvalidAnonKey) {
      throw new Error(
        'SupabaseConfigurationError: NEXT_PUBLIC_SUPABASE_ANON_KEY is required for client authentication operations.'
      );
    }

    return {
      supabaseUrl,
      serviceRoleKey,
      anonKey,
      isTestBridge: false,
    };
  }

  public getSupabaseAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      const cfg = this.resolveSupabaseConfig();
      this.adminClient = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(cfg.isTestBridge ? { global: { fetch: supabasePgliteFetch } } : {}),
      });
    }
    return this.adminClient;
  }

  public getSupabaseAuthClient(): SupabaseClient {
    if (!this.anonClient) {
      const cfg = this.resolveSupabaseConfig();
      this.anonClient = createClient(cfg.supabaseUrl, cfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(cfg.isTestBridge ? { global: { fetch: supabasePgliteFetch } } : {}),
      });
    }
    return this.anonClient;
  }

  public getSupabaseClient(): SupabaseClient {
    return this.getSupabaseAdminClient();
  }

  public async clearAllForTesting(): Promise<void> {
    if (process.env.SUPABASE_TEST_BRIDGE === 'true') {
      await resetTestPostgresData();
    }
  }

  // ============================================================================
  // USER PROFILES & TENANT MANAGEMENT (SUPABASE POSTGRESQL)
  // ============================================================================

  public async getUserByEmail(email: string): Promise<DbUserProfile | null> {
    const normalized = email.trim().toLowerCase();
    const supabase = this.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .ilike('email', normalized);

    if (error) {
      throw new Error(`Supabase query failed (user_profiles by email): ${error.message}`);
    }
    const row = data?.[0];
    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      fullName: row.full_name,
      phoneNumber: row.phone_number || undefined,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  public async getUserById(userId: string): Promise<DbUserProfile | null> {
    if (!isValidUuid(userId)) return null;
    const supabase = this.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId);

    if (error) {
      throw new Error(`Supabase query failed (user_profiles by id): ${error.message}`);
    }
    const row = data?.[0];
    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      fullName: row.full_name,
      phoneNumber: row.phone_number || undefined,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  /**
   * Registers or provisions a customer profile in `public.organizations` and `public.user_profiles`
   * backed by a real `auth.users` account in Supabase Auth.
   * Role is strictly forced to `'customer'`.
   */
  public async createOrGetCustomerUser(params: {
    id?: string;
    email: string;
    fullName?: string;
    businessName?: string;
    password?: string;
  }): Promise<DbUserProfile> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existing = await this.getUserByEmail(normalizedEmail);
    if (existing) return existing;

    const supabase = this.getSupabaseAdminClient();
    let authUserId = params.id && isValidUuid(params.id) ? params.id : '';

    if (!authUserId) {
      const authClient = this.getSupabaseAuthClient();
      const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
        email: normalizedEmail,
        password: params.password || crypto.randomBytes(16).toString('hex') + 'A1!',
        options: {
          data: {
            full_name: params.fullName || normalizedEmail,
            business_name: params.businessName || params.fullName || normalizedEmail,
          },
        },
      });

      if (signUpError || !signUpData.user) {
        throw new Error(
          `Supabase Auth user creation failed: ${signUpError?.message || 'Missing user object'}`
        );
      }
      authUserId = signUpData.user.id;
    }

    const orgId = toDeterministicUuid(`org:${normalizedEmail}`);
    const now = new Date().toISOString();

    const { error: orgErr } = await supabase.from('organizations').upsert(
      {
        id: orgId,
        name: params.businessName || params.fullName || normalizedEmail,
        website_url: '',
        industry: 'Digital Commerce',
        country_code: 'BD',
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'id' }
    );
    if (orgErr) {
      throw new Error(`Failed to persist organization in Supabase: ${orgErr.message}`);
    }

    const { error: profErr } = await supabase.from('user_profiles').upsert(
      {
        id: authUserId,
        organization_id: orgId,
        email: normalizedEmail,
        full_name: params.fullName || normalizedEmail,
        role: 'customer',
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'id' }
    );
    if (profErr) {
      throw new Error(`Failed to persist user profile in Supabase: ${profErr.message}`);
    }

    const created = await this.getUserById(authUserId);
    if (!created) {
      throw new Error('Failed to load newly created customer profile from Supabase.');
    }
    return created;
  }

  /**
   * Enforces server-controlled immutability of `role` and `organizationId` on self-service profile updates.
   */
  public async updateCustomerProfile(
    actorUserId: string,
    targetUserId: string,
    updates: { fullName?: string; phoneNumber?: string; role?: string; organizationId?: string }
  ): Promise<DbUserProfile> {
    const actor = await this.getUserById(actorUserId);
    if (!actor) throw new Error('Unauthorized: Actor profile not found.');

    if (actor.id !== targetUserId && actor.role !== 'admin') {
      throw new Error('Forbidden: Cannot modify another user profile.');
    }

    if (
      (updates.role && updates.role !== actor.role) ||
      (updates.organizationId && updates.organizationId !== actor.organizationId)
    ) {
      throw new Error(
        'Forbidden: Account role and tenant organization membership are server-controlled and cannot be modified.'
      );
    }

    const supabase = this.getSupabaseAdminClient();
    const patchPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.fullName !== undefined) patchPayload.full_name = updates.fullName;
    if (updates.phoneNumber !== undefined) patchPayload.phone_number = updates.phoneNumber;

    const { error } = await supabase
      .from('user_profiles')
      .update(patchPayload)
      .eq('id', targetUserId);

    if (error) {
      throw new Error(`Supabase profile update failed: ${error.message}`);
    }

    return (await this.getUserById(targetUserId))!;
  }

  // ============================================================================
  // QUOTES
  // ============================================================================

  public async saveQuote(
    quote: QuoteSnapshot,
    customerId?: string,
    organizationId?: string,
    guestClaim?: { tokenHash: string; expiresAt: string }
  ): Promise<QuoteSnapshot> {
    const supabase = this.getSupabaseAdminClient();
    const quoteUuid = toDeterministicUuid(`quote:${quote.id}`);
    // Claim secrets are never persisted inside the quote payload.
    const safeQuote = stripClaimSecrets(quote as unknown as Record<string, any>) as unknown as QuoteSnapshot;

    const validCustomerId = customerId && isValidUuid(customerId) ? customerId : null;
    const validOrgId = organizationId && isValidUuid(organizationId) ? organizationId : null;

    const { error } = await supabase.from('quotes').upsert(
      {
        id: quoteUuid,
        quote_code: quote.id,
        organization_id: validOrgId,
        customer_id: validCustomerId,
        business_name: quote.businessName,
        selected_items: quote.items,
        subtotal_minor: quote.subtotalMinor,
        discount_minor: quote.discountMinor,
        total_minor: quote.totalMinor,
        currency: quote.currency,
        eligibility_snapshot: quote.eligibility,
        status: quote.status,
        quote_hash: quote.termsHash || 'v6_authoritative_hash',
        expires_at: quote.expiresAt,
        payload_json: safeQuote,
        created_at: quote.createdAt,
      },
      { onConflict: 'quote_code' }
    );

    if (error) {
      throw new Error(`Supabase saveQuote failed: ${error.message}`);
    }

    if (guestClaim && !validCustomerId) {
      const { error: claimError } = await supabase.from('quote_claims').upsert(
        {
          quote_id: quoteUuid,
          token_hash: guestClaim.tokenHash,
          expires_at: guestClaim.expiresAt,
        },
        { onConflict: 'quote_id' }
      );
      if (claimError) {
        throw new Error(`Supabase saveQuote claim registration failed: ${claimError.message}`);
      }
    }

    return safeQuote;
  }

  /**
   * Server-side verification of a guest quote capability (hash compare, expiry, single use).
   * Never returns or logs the secret.
   */
  public async verifyGuestQuoteClaim(quoteId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const supabase = this.getSupabaseAdminClient();
    const quoteUuid = toDeterministicUuid(`quote:${quoteId}`);
    const { data, error } = await supabase
      .from('quote_claims')
      .select('token_hash, expires_at, claimed_at')
      .eq('quote_id', quoteUuid);
    if (error || !data?.[0]) return false;
    const row = data[0] as { token_hash: string | null; expires_at: string; claimed_at: string | null };
    if (!row.token_hash || row.claimed_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    return constantTimeEqualHex(hashGuestClaimToken(token), row.token_hash);
  }

  public async getQuote(quoteId: string): Promise<QuoteSnapshot | undefined> {
    const supabase = this.getSupabaseAdminClient();
    const quoteUuid = toDeterministicUuid(`quote:${quoteId}`);

    const { data, error } = await supabase
      .from('quotes')
      .select('payload_json, organization_id, customer_id')
      .or(`quote_code.eq.${quoteId},id.eq.${quoteUuid}`);

    if (error) {
      throw new Error(`Supabase getQuote failed: ${error.message}`);
    }

    const row = data?.[0];
    if (!row?.payload_json) return undefined;
    const parsed = (typeof row.payload_json === 'string'
      ? JSON.parse(row.payload_json)
      : row.payload_json) as QuoteSnapshot;
    return {
      ...stripClaimSecrets(parsed as unknown as Record<string, any>),
      customerId: row.customer_id || (parsed as any).customerId,
      organizationId: row.organization_id || (parsed as any).organizationId,
    } as unknown as QuoteSnapshot;
  }

  // ============================================================================
  // ORDERS
  // ============================================================================

  public async saveOrder(order: Order, organizationId?: string): Promise<Order> {
    const supabase = this.getSupabaseAdminClient();

    let customerProfile = await this.getUserById(order.customerUserId);
    if (!customerProfile) {
      const fallbackUuid = toDeterministicUuid(`user:${order.customerUserId}`);
      customerProfile = await this.getUserById(fallbackUuid);
      if (!customerProfile) {
        customerProfile = await this.createOrGetCustomerUser({
          email: `${order.customerUserId}@client.hoooplaaa.bd`,
          fullName: order.quoteSnapshot.businessName || 'Client User',
          businessName: order.quoteSnapshot.businessName || 'Client Organization',
        });
      }
    }

    const resolvedOrgId =
      organizationId && isValidUuid(organizationId)
        ? organizationId
        : customerProfile.organizationId;

    await this.saveQuote(order.quoteSnapshot, customerProfile.id, resolvedOrgId);

    const orderUuid = toDeterministicUuid(`order:${order.id}`);
    const quoteUuid = toDeterministicUuid(`quote:${order.quoteId}`);

    let validEngineerUuid: string | null = null;
    if (order.assignedSpecialistId && isValidUuid(order.assignedSpecialistId)) {
      const eng = await this.getUserById(order.assignedSpecialistId);
      if (eng) validEngineerUuid = eng.id;
    }

    const enrichedOrder = {
      ...order,
      customerUserId: customerProfile.id,
      organizationId: resolvedOrgId,
    };

    const { error } = await supabase.from('orders').upsert(
      {
        id: orderUuid,
        order_code: order.id,
        order_number: order.orderNumber,
        organization_id: resolvedOrgId,
        customer_id: customerProfile.id,
        quote_id: quoteUuid,
        assigned_engineer_id: validEngineerUuid,
        assigned_specialist_name: order.assignedSpecialistName || null,
        order_status: order.status,
        financial_status: order.financialStatus,
        intake_status: order.intakeStatus,
        total_minor: order.totalMinor,
        currency: order.currency,
        quote_snapshot: order.quoteSnapshot,
        sla_started_at: order.slaStartedAt || null,
        sla_deadline_at: order.deliveryTargetDate || null,
        delivered_at: order.deliveredAt || null,
        accepted_at: order.acceptedAt || null,
        payload_json: enrichedOrder,
        created_at: order.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_code' }
    );

    if (error) {
      throw new Error(`Supabase saveOrder failed: ${error.message}`);
    }

    await this.recordAuditLog({
      actorId: customerProfile.id,
      actorRole: customerProfile.role,
      action: 'ORDER_UPSERT',
      entityType: 'order',
      entityId: order.id,
      metadata: { status: order.status, financialStatus: order.financialStatus },
    });

    return enrichedOrder;
  }

  public async getOrder(
    orderId: string
  ): Promise<(Order & { organizationId?: string }) | undefined> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);

    const { data, error } = await supabase
      .from('orders')
      .select('payload_json, organization_id, customer_id')
      .or(`order_code.eq.${orderId},id.eq.${orderUuid},order_number.eq.${orderId}`);

    if (error) {
      throw new Error(`Supabase getOrder failed: ${error.message}`);
    }

    const row = data?.[0];
    if (!row?.payload_json) return undefined;
    const parsed = (
      typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json
    ) as Order;

    return {
      ...parsed,
      customerUserId: row.customer_id,
      organizationId: row.organization_id,
    };
  }

  public async listAllOrders(): Promise<Order[]> {
    const supabase = this.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('orders')
      .select('payload_json, customer_id, organization_id')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listAllOrders failed: ${error.message}`);
    }

    return (data || []).map((r) => {
      const parsed = (
        typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json
      ) as Order;
      return { ...parsed, customerUserId: r.customer_id };
    });
  }

  public async getAllOrders(): Promise<Order[]> {
    return this.listAllOrders();
  }

  public async findActiveOrderByQuoteId(quoteId: string, customerId?: string): Promise<Order | undefined> {
    const orders = await this.listAllOrders();
    return orders.find(
      (o) =>
        (o.quoteId === quoteId || o.quoteSnapshot?.id === quoteId) &&
        (!customerId || o.customerUserId === customerId) &&
        o.status !== 'cancelled' &&
        o.status !== 'refunded'
    );
  }

  /**
   * Genuine PostgreSQL Transactional Payment & Order Settlement:
   * Invokes the PostgreSQL stored procedure `settle_order_payment_paid`.
   * Guarantees all updates (orders, payments, audit logs, and SLA triggers) succeed together or roll back.
   * Validates amounts and currencies, enforces replay protection, and eliminates fictional payment fallback.
   */
  public async settleOrderPaymentPaid(params: {
    orderId: string;
    paymentAttemptId: string;
    source: 'sslcommerz_s2s_validated' | 'local_simulator' | 'finance_manual';
    verifiedByStaffId?: string;
    providerValId?: string;
    evidencePayload?: Record<string, unknown>;
  }): Promise<{ order: Order; payment: DbPaymentRecord }> {
    const supabase = this.getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('settle_order_payment_paid', {
      p_order_id: params.orderId,
      p_payment_attempt_code: params.paymentAttemptId,
      p_settlement_source: params.source,
      p_staff_id: params.verifiedByStaffId || null,
      p_provider_val_id: params.providerValId || null,
      p_evidence_payload: params.evidencePayload || {},
    });

    if (error) {
      throw new Error(`PaymentSettlementError: ${error.message}`);
    }

    if (!data?.order || !data?.payment) {
      throw new Error(
        'PaymentSettlementError: Settlement transaction did not return expected order or payment records.'
      );
    }

    const order = (typeof data.order === 'string' ? JSON.parse(data.order) : data.order) as Order;
    const rawPayment = typeof data.payment === 'string' ? JSON.parse(data.payment) : data.payment;
    const payment: DbPaymentRecord = {
      id: rawPayment.attempt_code || rawPayment.id,
      orderId: params.orderId,
      paymentMethod: rawPayment.payment_method || rawPayment.paymentMethod,
      paymentStatus: rawPayment.payment_status || rawPayment.paymentStatus,
      amountMinor: Number(rawPayment.amount_minor || rawPayment.amountMinor),
      currency: rawPayment.currency,
      idempotencyKey: rawPayment.idempotency_key || rawPayment.idempotencyKey,
      providerValId: rawPayment.provider_val_id || rawPayment.providerValId,
      verifiedByFinanceId: rawPayment.verified_by_finance_id || rawPayment.verifiedByFinanceId,
      verifiedAt: rawPayment.verified_at || rawPayment.verifiedAt,
      gatewayRawPayload: rawPayment.gateway_raw_payload || rawPayment.gatewayRawPayload || {},
      createdAt: rawPayment.created_at || rawPayment.createdAt,
    };

    return { order, payment };
  }

  /**
   * Concurrency-Safe Transactional Quote-to-Order Conversion:
   * Guarantees exactly one active order can be generated for a quote snapshot.
   * Catches unique constraints in PostgreSQL and returns the active order without duplicating records.
   */
  public async createOrGetActiveOrderForQuote(params: {
    quote: QuoteSnapshot;
    customerId: string;
    organizationId: string;
    claimToken?: string;
  }): Promise<{ order: Order; isNew: boolean }> {
    const supabase = this.getSupabaseAdminClient();

    // Deterministic per quote (idempotent re-conversion) and collision-resistant: the order number is
    // derived from a hash of the full quote id. (The earlier slice(0, 6) of the id only varied every ~16h,
    // so any two orders created in the same window collided on orders_order_number_key.)
    const cleanQuoteId = params.quote.id.replace(/-/g, '');
    const orderCode = `ord_${cleanQuoteId}`;
    const orderNumber = `HOO-${new Date().getFullYear()}-${crypto
      .createHash('sha256')
      .update(params.quote.id)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase()}`;

    const newOrder = OrderService.createOrderFromQuote(params.quote, params.customerId);
    newOrder.id = orderCode;
    newOrder.organizationId = params.organizationId;
    newOrder.orderNumber = orderNumber;

    const orderUuid = toDeterministicUuid(`order:${orderCode}`);

    const { data, error } = await supabase.rpc('convert_quote_to_active_order', {
      p_order_id: orderUuid,
      p_quote_id: params.quote.id,
      p_customer_id: params.customerId,
      p_organization_id: params.organizationId,
      p_order_code: orderCode,
      p_order_number: orderNumber,
      p_payload_json: newOrder,
      p_claim_token: params.claimToken || null,
    });

    if (error) {
      throw new Error(`QuoteToOrderError: ${error.message}`);
    }

    if (!data?.order) {
      throw new Error('QuoteToOrderError: Transaction failed to return an order.');
    }

    const order = (typeof data.order === 'string' ? JSON.parse(data.order) : data.order) as Order;
    return { order, isNew: !data.existing };
  }

  /**
   * Single-Use Private Guest Quote Claiming:
   * Atomically assigns an unauthenticated quote to a customer's organization.
   * Requires cryptographically secure single-use claimToken verification.
   * Prevents cross-tenant claiming collisions via database locks.
   */
  public async claimGuestQuote(
    quoteId: string,
    customerId: string,
    organizationId: string,
    claimToken?: string
  ): Promise<QuoteSnapshot> {
    const supabase = this.getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('claim_guest_quote', {
      p_quote_id: quoteId,
      p_customer_id: customerId,
      p_organization_id: organizationId,
      p_claim_token: claimToken || null,
    });

    if (error) {
      throw new Error(`QuoteClaimError: ${error.message}`);
    }

    return (typeof data.quote === 'string' ? JSON.parse(data.quote) : data.quote) as QuoteSnapshot;
  }

  public async listOrdersForCustomer(
    customerId: string,
    organizationId?: string
  ): Promise<Order[]> {
    const supabase = this.getSupabaseAdminClient();
    const filterExpr =
      organizationId && isValidUuid(organizationId)
        ? `customer_id.eq.${customerId},organization_id.eq.${organizationId}`
        : `customer_id.eq.${customerId}`;

    const { data, error } = await supabase
      .from('orders')
      .select('payload_json, customer_id')
      .or(filterExpr)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listOrdersForCustomer failed: ${error.message}`);
    }

    return (data || []).map((r) => {
      const parsed = (
        typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json
      ) as Order;
      return { ...parsed, customerUserId: r.customer_id };
    });
  }

  // ============================================================================
  // PAYMENTS & CONCURRENCY-SAFE IDEMPOTENCY / REPLAY PROTECTION
  // ============================================================================

  public async recordPaymentAttempt(record: DbPaymentRecord): Promise<DbPaymentRecord> {
    const supabase = this.getSupabaseAdminClient();
    const paymentUuid = toDeterministicUuid(`pay:${record.id}`);
    let orderUuid = toDeterministicUuid(`order:${record.orderId}`);

    const { data: orderRows } = await supabase
      .from('orders')
      .select('id')
      .or(`order_code.eq.${record.orderId},order_number.eq.${record.orderId}`)
      .limit(1);

    if (orderRows && orderRows.length > 0 && orderRows[0]?.id) {
      orderUuid = orderRows[0].id;
    }

    const financeUuid =
      record.verifiedByFinanceId && isValidUuid(record.verifiedByFinanceId)
        ? record.verifiedByFinanceId
        : null;

    const payloadWithMeta = {
      ...record.gatewayRawPayload,
      __orderCode: record.orderId,
      __attemptCode: record.id,
    };

    const { error } = await supabase.from('payments').upsert(
      {
        id: paymentUuid,
        attempt_code: record.id,
        order_id: orderUuid,
        payment_method: record.paymentMethod,
        payment_status: record.paymentStatus,
        amount_minor: record.amountMinor,
        currency: record.currency,
        idempotency_key: record.idempotencyKey,
        provider_session_key: record.providerSessionKey || null,
        provider_trx_id: record.providerTrxId || null,
        provider_val_id: record.providerValId || null,
        manual_sender_phone: record.manualSenderPhone || null,
        manual_trx_reference: record.manualTrxReference || null,
        verified_by_finance_id: financeUuid,
        verified_at: record.verifiedAt || null,
        rejection_reason: record.rejectionReason || null,
        gateway_raw_payload: payloadWithMeta,
        created_at: record.createdAt,
      },
      { onConflict: 'attempt_code' }
    );

    if (error) {
      throw new Error(`Supabase recordPaymentAttempt failed: ${error.message}`);
    }

    return record;
  }

  /**
   * Inserts a NEW payment attempt without ever overwriting an existing one.
   * DB constraints (unique idempotency_key + one open attempt per order/method) make concurrent
   * duplicate initiations collapse onto a single logical attempt.
   * Returns `created: false` with the already-open attempt when a duplicate is detected.
   */
  public async createPaymentAttemptOnce(
    record: DbPaymentRecord
  ): Promise<{ record: DbPaymentRecord; created: boolean }> {
    const supabase = this.getSupabaseAdminClient();
    const paymentUuid = toDeterministicUuid(`pay:${record.id}`);

    const { data: orderRows } = await supabase
      .from('orders')
      .select('id')
      .or(`order_code.eq.${record.orderId},order_number.eq.${record.orderId}`)
      .limit(1);
    const orderUuid = orderRows?.[0]?.id || toDeterministicUuid(`order:${record.orderId}`);

    const { error } = await supabase.from('payments').insert({
      id: paymentUuid,
      attempt_code: record.id,
      order_id: orderUuid,
      payment_method: record.paymentMethod,
      payment_status: record.paymentStatus,
      amount_minor: record.amountMinor,
      currency: record.currency,
      idempotency_key: record.idempotencyKey,
      provider_session_key: record.providerSessionKey || null,
      gateway_raw_payload: {
        ...record.gatewayRawPayload,
        __orderCode: record.orderId,
        __attemptCode: record.id,
      },
      created_at: record.createdAt,
    });

    if (!error) return { record, created: true };

    const existing = (await this.getPaymentsForOrder(record.orderId)).find(
      (p) =>
        p.idempotencyKey === record.idempotencyKey ||
        (p.paymentMethod === record.paymentMethod &&
          (p.paymentStatus === 'initiated' || p.paymentStatus === 'pending_verification'))
    );
    if (existing) return { record: existing, created: false };
    throw new Error(`Supabase createPaymentAttemptOnce failed: ${error.message}`);
  }

  public async getPaymentByAttemptId(attemptId: string): Promise<DbPaymentRecord | null> {
    const supabase = this.getSupabaseAdminClient();
    const paymentUuid = toDeterministicUuid(`pay:${attemptId}`);
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .or(`attempt_code.eq.${attemptId},id.eq.${paymentUuid}`);

    if (error) {
      throw new Error(`Supabase getPaymentByAttemptId failed: ${error.message}`);
    }
    const r = data?.[0];
    if (!r) return null;

    const raw =
      typeof r.gateway_raw_payload === 'string'
        ? JSON.parse(r.gateway_raw_payload)
        : r.gateway_raw_payload || {};

    return {
      id: r.attempt_code || attemptId,
      orderId: raw.__orderCode || r.order_id,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      amountMinor: Number(r.amount_minor),
      currency: r.currency,
      idempotencyKey: r.idempotency_key,
      providerSessionKey: r.provider_session_key || undefined,
      providerTrxId: r.provider_trx_id || undefined,
      providerValId: r.provider_val_id || undefined,
      manualSenderPhone: r.manual_sender_phone || undefined,
      manualTrxReference: r.manual_trx_reference || undefined,
      verifiedByFinanceId: r.verified_by_finance_id || undefined,
      verifiedAt: r.verified_at || undefined,
      rejectionReason: r.rejection_reason || undefined,
      gatewayRawPayload: raw,
      createdAt: r.created_at,
    };
  }

  public async getPaymentsForOrder(orderId: string): Promise<DbPaymentRecord[]> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase getPaymentsForOrder failed: ${error.message}`);
    }

    return (data || []).map((r) => {
      const raw =
        typeof r.gateway_raw_payload === 'string'
          ? JSON.parse(r.gateway_raw_payload)
          : r.gateway_raw_payload || {};
      return {
        id: r.attempt_code || r.id,
        orderId: raw.__orderCode || orderId,
        paymentMethod: r.payment_method,
        paymentStatus: r.payment_status,
        amountMinor: Number(r.amount_minor),
        currency: r.currency,
        idempotencyKey: r.idempotency_key,
        providerSessionKey: r.provider_session_key || undefined,
        providerTrxId: r.provider_trx_id || undefined,
        providerValId: r.provider_val_id || undefined,
        manualSenderPhone: r.manual_sender_phone || undefined,
        manualTrxReference: r.manual_trx_reference || undefined,
        verifiedByFinanceId: r.verified_by_finance_id || undefined,
        verifiedAt: r.verified_at || undefined,
        rejectionReason: r.rejection_reason || undefined,
        gatewayRawPayload: raw,
        createdAt: r.created_at,
      };
    });
  }

  // ============================================================================
  // INTAKE SUBMISSIONS
  // ============================================================================

  public async saveIntake(
    intakeOrOrderId: IntakeSubmission | Record<string, any> | string,
    secondArg?: IntakeSubmission | Record<string, any> | string
  ): Promise<IntakeSubmission> {
    const intake = (
      typeof intakeOrOrderId === 'string' ? secondArg : intakeOrOrderId
    ) as IntakeSubmission;
    const submittedByUserId =
      typeof intakeOrOrderId === 'string' ? undefined : (secondArg as string | undefined);

    const resolvedOrderId =
      intake.orderId || (typeof intakeOrOrderId === 'string' ? intakeOrOrderId : '');
    const order = await this.getOrder(resolvedOrderId);
    if (!order) throw new Error('Order not found for intake submission.');

    const actorId =
      submittedByUserId && isValidUuid(submittedByUserId)
        ? submittedByUserId
        : order.customerUserId;

    const supabase = this.getSupabaseAdminClient();
    const intakeUuid = toDeterministicUuid(`intake:${resolvedOrderId}`);
    const orderUuid = toDeterministicUuid(`order:${order.id}`);

    const { error } = await supabase.from('order_intakes').upsert(
      {
        id: intakeUuid,
        order_id: orderUuid,
        submitted_by: actorId,
        business_name: intake.businessName || '',
        contact_email: intake.contactEmail || 'client@hoooplaaa.bd',
        contact_whatsapp: intake.contactWhatsApp || '+8801700000000',
        target_audience: intake.targetAudience || '',
        brand_colors: intake.brandColors || '',
        existing_page_links: intake.existingPageLinks || '',
        partner_invite_status: intake.partnerInviteStatus || 'invitation_sent',
        notes: intake.notes || '',
        payload_json: intake,
        submitted_at: intake.submittedAt || new Date().toISOString(),
      },
      { onConflict: 'order_id' }
    );

    if (error) {
      throw new Error(`Supabase saveIntake failed: ${error.message}`);
    }

    await this.recordAuditLog({
      actorId,
      actorRole: 'customer',
      action: 'INTAKE_SUBMITTED',
      entityType: 'order',
      entityId: order.id,
      metadata: { businessName: intake.businessName },
    });

    return intake;
  }

  public async getIntake(orderId: string): Promise<IntakeSubmission | undefined> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);

    const { data, error } = await supabase
      .from('order_intakes')
      .select('payload_json')
      .eq('order_id', orderUuid);

    if (error) {
      throw new Error(`Supabase getIntake failed: ${error.message}`);
    }

    const row = data?.[0];
    if (!row?.payload_json) return undefined;
    return (typeof row.payload_json === 'string'
      ? JSON.parse(row.payload_json)
      : row.payload_json) as IntakeSubmission;
  }

  // ============================================================================
  // PRIVATE FILE STORAGE (SUPABASE STORAGE BUCKET 'order-assets' + POSTGRESQL)
  // ============================================================================

  public async savePrivateFileWithBytes(
    fileRecord: FileAttachment & { sha256Hash: string },
    fileBytes: Buffer
  ): Promise<FileAttachment & { sha256Hash: string }> {
    const supabase = this.getSupabaseAdminClient();
    const order = await this.getOrder(fileRecord.orderId);
    if (!order) {
      throw new Error(`Order ${fileRecord.orderId} not found for file upload.`);
    }

    // 1. Upload actual binary bytes to private Supabase Storage bucket ('order-assets')
    const { error: uploadError } = await supabase.storage
      .from('order-assets')
      .upload(fileRecord.storagePath, fileBytes, {
        contentType: fileRecord.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
    }

    // 2. Persist relational metadata record with SHA-256 digest in PostgreSQL `order_files`
    const fileUuid = toDeterministicUuid(`file:${fileRecord.id}`);
    const orderUuid = toDeterministicUuid(`order:${order.id}`);
    const uploadedByUuid = isValidUuid(fileRecord.uploadedByUserId)
      ? fileRecord.uploadedByUserId
      : order.customerUserId;

    const { error: dbError } = await supabase.from('order_files').upsert(
      {
        id: fileUuid,
        file_code: fileRecord.id,
        order_id: orderUuid,
        uploaded_by: uploadedByUuid,
        file_name: fileRecord.fileName,
        file_size_bytes: fileBytes.byteLength,
        mime_type: fileRecord.mimeType,
        sha256_hash: fileRecord.sha256Hash,
        storage_bucket: 'order-assets',
        storage_path: fileRecord.storagePath,
        is_private: true,
        payload_json: fileRecord,
        created_at: fileRecord.uploadedAt,
      },
      { onConflict: 'file_code' }
    );

    if (dbError) {
      throw new Error(`Supabase order_files insert failed: ${dbError.message}`);
    }

    return fileRecord;
  }

  public async saveFile(orderId: string, file: Record<string, any>): Promise<void> {
    const bytes = Buffer.from(JSON.stringify(file), 'utf8');
    const sha256Hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const order = await this.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);
    const uploadedBy =
      file.uploadedByUserId && isValidUuid(file.uploadedByUserId)
        ? file.uploadedByUserId
        : order.customerUserId;
    const fileId = file.id || `file_${Date.now()}`;
    const fileName = file.fileName || file.name || 'deliverable.pdf';
    const storagePath = file.storagePath || `orders/${orderId}/${fileId}_${fileName}`;

    await this.savePrivateFileWithBytes(
      {
        ...(file as FileAttachment),
        id: fileId,
        orderId: order.id,
        uploadedByUserId: uploadedBy,
        fileName,
        fileSizeBytes: file.fileSizeBytes || file.sizeBytes || bytes.byteLength,
        mimeType: file.mimeType || 'application/pdf',
        storagePath,
        isPrivate: true,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        sha256Hash,
      },
      bytes
    );
  }

  public async getFiles(
    orderId: string
  ): Promise<(FileAttachment & { sha256Hash?: string })[]> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);

    const { data, error } = await supabase
      .from('order_files')
      .select('payload_json, sha256_hash')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Supabase getFiles failed: ${error.message}`);
    }

    return (data || []).map((r) => {
      const parsed = (
        typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json
      ) as FileAttachment;
      return {
        ...parsed,
        sha256Hash: r.sha256_hash,
      };
    });
  }

  public async getPrivateFileBytes(
    orderId: string,
    fileId: string
  ): Promise<{
    file: FileAttachment & { sha256Hash: string };
    bytes: Buffer;
  } | null> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);
    const fileUuid = toDeterministicUuid(`file:${fileId}`);

    const { data, error } = await supabase
      .from('order_files')
      .select('payload_json, sha256_hash, storage_path')
      .eq('order_id', orderUuid)
      .or(`file_code.eq.${fileId},id.eq.${fileUuid}`);

    if (error) {
      throw new Error(`Supabase getPrivateFileBytes metadata lookup failed: ${error.message}`);
    }

    const row = data?.[0];
    if (!row) return null;

    const { data: blobData, error: downloadError } = await supabase.storage
      .from('order-assets')
      .download(row.storage_path);

    if (downloadError || !blobData) {
      return null;
    }

    const arrayBuffer = await blobData.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const parsed = (
      typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json
    ) as FileAttachment;

    return {
      file: { ...parsed, sha256Hash: row.sha256_hash },
      bytes,
    };
  }

  // ============================================================================
  // DELIVERABLES & REVISIONS (POSTGRESQL)
  // ============================================================================

  public async saveDeliverable(params: {
    id?: string;
    orderId: string;
    uploadedBy: string;
    title: string;
    storageBucketPath: string;
    verificationNotes: string;
    qaChecklistPassed: boolean;
  }): Promise<DbDeliverableRecord> {
    const supabase = this.getSupabaseAdminClient();
    const delivCode = params.id || `deliv_${crypto.randomBytes(6).toString('hex')}`;
    const delivUuid = toDeterministicUuid(`deliv:${delivCode}`);
    const orderUuid = toDeterministicUuid(`order:${params.orderId}`);
    const now = new Date().toISOString();

    const { error } = await supabase.from('order_deliverables').upsert(
      {
        id: delivUuid,
        deliverable_code: delivCode,
        order_id: orderUuid,
        uploaded_by: params.uploadedBy,
        title: params.title,
        storage_bucket_path: params.storageBucketPath,
        verification_notes: params.verificationNotes,
        qa_checklist_passed: params.qaChecklistPassed,
        payload_json: params,
        created_at: now,
      },
      { onConflict: 'deliverable_code' }
    );

    if (error) {
      throw new Error(`Supabase saveDeliverable failed: ${error.message}`);
    }

    return {
      id: delivCode,
      orderId: params.orderId,
      uploadedBy: params.uploadedBy,
      title: params.title,
      storageBucketPath: params.storageBucketPath,
      verificationNotes: params.verificationNotes,
      qaChecklistPassed: params.qaChecklistPassed,
      createdAt: now,
    };
  }

  public async getDeliverables(orderId: string): Promise<DbDeliverableRecord[]> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);
    const { data, error } = await supabase
      .from('order_deliverables')
      .select('*')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase getDeliverables failed: ${error.message}`);
    }

    return (data || []).map((r) => ({
      id: r.deliverable_code || r.id,
      orderId,
      uploadedBy: r.uploaded_by,
      title: r.title,
      storageBucketPath: r.storage_bucket_path,
      verificationNotes: r.verification_notes,
      qaChecklistPassed: Boolean(r.qa_checklist_passed),
      createdAt: r.created_at,
    }));
  }

  public async saveRevision(params: {
    id?: string;
    orderId: string;
    requestedBy: string;
    revisionNotes: string;
  }): Promise<DbRevisionRecord> {
    const supabase = this.getSupabaseAdminClient();
    const revCode = params.id || `rev_${crypto.randomBytes(6).toString('hex')}`;
    const revUuid = toDeterministicUuid(`rev:${revCode}`);
    const orderUuid = toDeterministicUuid(`order:${params.orderId}`);
    const now = new Date().toISOString();

    const { error } = await supabase.from('order_revisions').upsert(
      {
        id: revUuid,
        revision_code: revCode,
        order_id: orderUuid,
        requested_by: params.requestedBy,
        revision_notes: params.revisionNotes,
        is_resolved: false,
        created_at: now,
      },
      { onConflict: 'revision_code' }
    );

    if (error) {
      throw new Error(`Supabase saveRevision failed: ${error.message}`);
    }

    return {
      id: revCode,
      orderId: params.orderId,
      requestedBy: params.requestedBy,
      revisionNotes: params.revisionNotes,
      isResolved: false,
      createdAt: now,
    };
  }

  public async getRevisions(orderId: string): Promise<DbRevisionRecord[]> {
    const supabase = this.getSupabaseAdminClient();
    const orderUuid = toDeterministicUuid(`order:${orderId}`);
    const { data, error } = await supabase
      .from('order_revisions')
      .select('*')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase getRevisions failed: ${error.message}`);
    }

    return (data || []).map((r) => ({
      id: r.revision_code || r.id,
      orderId,
      requestedBy: r.requested_by,
      revisionNotes: r.revision_notes,
      isResolved: Boolean(r.is_resolved),
      resolvedAt: r.resolved_at || undefined,
      createdAt: r.created_at,
    }));
  }

  // ============================================================================
  // AUDITS & IMMUTABLE AUDIT LOGS
  // ============================================================================

  public async saveAuditRequest(
    audit: AuditRequest,
    customerId?: string
  ): Promise<AuditRequest> {
    const supabase = this.getSupabaseAdminClient();
    const auditUuid = toDeterministicUuid(`audit:${audit.id}`);
    const validCustomerUuid = customerId && isValidUuid(customerId) ? customerId : null;

    const { error } = await supabase.from('audit_requests').upsert(
      {
        id: auditUuid,
        audit_code: audit.id,
        customer_id: validCustomerUuid,
        audit_type: audit.type || 'pre_sale_initial',
        business_name: audit.businessName,
        website_or_page_url: audit.websiteOrPageUrl,
        contact_email: audit.contactEmail,
        contact_phone: audit.contactPhone || '',
        primary_goal: audit.primaryGoal || 'Digital Growth',
        status: audit.stage || 'submitted',
        payload_json: audit,
        submitted_at: audit.submittedAt,
      },
      { onConflict: 'audit_code' }
    );

    if (error) {
      throw new Error(`Supabase saveAuditRequest failed: ${error.message}`);
    }

    return audit;
  }

  public async listAuditRequests(): Promise<AuditRequest[]> {
    const supabase = this.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('audit_requests')
      .select('payload_json')
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listAuditRequests failed: ${error.message}`);
    }

    return (data || []).map((r) =>
      (typeof r.payload_json === 'string'
        ? JSON.parse(r.payload_json)
        : r.payload_json) as AuditRequest
    );
  }

  public async recordAuditLog(entry: {
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const supabase = this.getSupabaseAdminClient();
    const logCode = `aud_${crypto.randomBytes(8).toString('hex')}`;
    const logUuid = toDeterministicUuid(`log:${logCode}`);
    const now = new Date().toISOString();
    const validActorUuid = entry.actorId && isValidUuid(entry.actorId) ? entry.actorId : null;

    const log: AuditLogEntry = {
      id: logCode,
      actorUserId: entry.actorId,
      actorRole: entry.actorRole as UserRole,
      action: entry.action,
      entityType: entry.entityType as AuditLogEntry['entityType'],
      entityId: entry.entityId,
      metadata: entry.metadata || {},
      timestamp: now,
    };

    const { error } = await supabase.from('audit_logs').insert({
      id: logUuid,
      log_code: logCode,
      actor_id: validActorUuid,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata || {},
      created_at: now,
    });

    if (error) {
      throw new Error(`Supabase recordAuditLog failed: ${error.message}`);
    }

    return log;
  }

  public async listAuditLogs(): Promise<AuditLogEntry[]> {
    const supabase = this.getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listAuditLogs failed: ${error.message}`);
    }

    return (data || []).map((r) => ({
      id: r.log_code || r.id,
      actorUserId: r.actor_id || 'anonymous',
      actorRole: r.actor_role as UserRole,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {},
      timestamp: r.created_at,
    }));
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.listAuditLogs();
  }
}

const globalForDb = globalThis as unknown as { persistentDBV6?: PersistentDatabaseEngine };
export const persistentDB = globalForDb.persistentDBV6 || new PersistentDatabaseEngine();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.persistentDBV6 = persistentDB;
}
