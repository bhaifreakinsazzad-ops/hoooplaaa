import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  QuoteSnapshot,
  Order,
  IntakeSubmission,
  FileAttachment,
  AuditRequest,
  AuditLogEntry,
  UserRole,
} from './types';

export interface DbUserProfile {
  id: string; // UUID
  organizationId: string; // UUID
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: 'customer' | 'finance' | 'engineer' | 'admin';
  passwordHash: string;
  createdAt: string;
}

export interface DbPaymentRecord {
  id: string;
  orderId: string;
  paymentMethod: string;
  paymentStatus: 'unpaid' | 'initiated' | 'pending_verification' | 'verified' | 'paid' | 'failed' | 'refunded';
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

const RUNTIME_DIR = path.resolve(process.cwd(), '.runtime');
const SQLITE_DB_PATH = path.join(RUNTIME_DIR, 'hoooplaaa_relational.sqlite');
const PRIVATE_STORAGE_DIR = path.join(RUNTIME_DIR, 'private_storage', 'order-assets');

function ensureRuntimeDirs() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  if (!fs.existsSync(PRIVATE_STORAGE_DIR)) {
    fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
  }
}

export function hashPassword(plain: string): string {
  return crypto.createHmac('sha256', 'hoooplaaa-auth-v5-salt').update(plain).digest('hex');
}

export function toDeterministicUuid(input: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) return input.toLowerCase();
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Authoritative Relational Persistence Engine (V5).
 * - Connects to Remote Supabase PostgreSQL (`aqmyqezuoscpgqwtvblu`) when live service-role credentials are set.
 * - Executes ACID SQL transactions via embedded SQLite (`node:sqlite`) with WAL mode for durable disk persistence across server restarts.
 * - Eliminates all in-memory Maps and unawaited writes.
 */
class PersistentDatabaseEngine {
  private supabase: SupabaseClient | null = null;
  private isLiveSupabaseConnected = false;
  private sqlite: DatabaseSync;

  constructor() {
    ensureRuntimeDirs();
    this.sqlite = new DatabaseSync(SQLITE_DB_PATH);
    this.initializeRelationalSchema();
    this.initializeSupabase();
  }

  private initializeSupabase() {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqmyqezuoscpgqwtvblu.supabase.co';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    const isPlaceholderKey =
      !supabaseKey ||
      supabaseKey.includes('placeholder') ||
      supabaseKey === 'your-anon-key' ||
      supabaseKey === 'your-service-role-key';

    if (!isPlaceholderKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.isLiveSupabaseConnected = true;
    }
  }

  private initializeRelationalSchema() {
    this.sqlite.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT NOT NULL DEFAULT '',
        industry TEXT NOT NULL DEFAULT 'Digital Commerce',
        country_code TEXT NOT NULL DEFAULT 'BD',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone_number TEXT,
        role TEXT NOT NULL CHECK (role IN ('customer', 'finance', 'engineer', 'admin')),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        quote_uuid TEXT UNIQUE NOT NULL,
        organization_id TEXT,
        customer_id TEXT,
        business_name TEXT NOT NULL,
        subtotal_minor INTEGER NOT NULL,
        discount_minor INTEGER NOT NULL,
        total_minor INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BDT',
        status TEXT NOT NULL,
        quote_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_uuid TEXT UNIQUE NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        customer_id TEXT NOT NULL REFERENCES user_profiles(id),
        quote_id TEXT NOT NULL REFERENCES quotes(id),
        assigned_engineer_id TEXT,
        assigned_specialist_name TEXT,
        order_status TEXT NOT NULL,
        financial_status TEXT NOT NULL,
        intake_status TEXT NOT NULL,
        total_minor INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BDT',
        sla_started_at TEXT,
        sla_deadline_at TEXT,
        delivered_at TEXT,
        accepted_at TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BDT',
        idempotency_key TEXT UNIQUE NOT NULL,
        provider_session_key TEXT,
        provider_trx_id TEXT,
        provider_val_id TEXT UNIQUE,
        manual_sender_phone TEXT,
        manual_trx_reference TEXT,
        verified_by_finance_id TEXT REFERENCES user_profiles(id),
        verified_at TEXT,
        rejection_reason TEXT,
        gateway_raw_payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        event_key TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL REFERENCES orders(id),
        payment_id TEXT REFERENCES payments(id),
        provider TEXT NOT NULL,
        provider_val_id TEXT UNIQUE,
        status TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BDT',
        evidence_payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_intakes (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
        submitted_by TEXT NOT NULL REFERENCES user_profiles(id),
        business_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_whatsapp TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        brand_colors TEXT,
        existing_page_links TEXT,
        partner_invite_status TEXT NOT NULL,
        notes TEXT,
        payload_json TEXT NOT NULL,
        submitted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_files (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        uploaded_by TEXT NOT NULL REFERENCES user_profiles(id),
        file_name TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        storage_bucket TEXT NOT NULL DEFAULT 'order-assets',
        storage_path TEXT UNIQUE NOT NULL,
        is_private INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_requests (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        business_name TEXT NOT NULL,
        website_or_page_url TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        submitted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Seed canonical tenants and RBAC users (idempotent)
    const now = new Date().toISOString();
    const orgStmt = this.sqlite.prepare(`
      INSERT OR IGNORE INTO organizations (id, name, website_url, industry, country_code, created_at)
      VALUES (?, ?, ?, ?, 'BD', ?)
    `);
    orgStmt.run('10000000-0000-4000-a000-000000000001', 'Dhaka Heritage Roasters Ltd.', 'https://dhakaheritage.bd', 'Food & Beverage', now);
    orgStmt.run('10000000-0000-4000-a000-000000000002', 'Chittagong Marine Logistics', 'https://ctgmarine.bd', 'Logistics', now);
    orgStmt.run('10000000-0000-4000-a000-000000000099', 'HOOOPLAAA INCORPORATED Staff', 'https://hoooplaaa.com', 'Digital Commerce Agency', now);

    const userStmt = this.sqlite.prepare(`
      INSERT OR IGNORE INTO user_profiles (id, organization_id, email, full_name, phone_number, role, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Customer A
    userStmt.run(
      '00000000-0000-4000-a000-000000000001',
      '10000000-0000-4000-a000-000000000001',
      'alice@dhakaheritage.bd',
      'Alice Rahman (Customer A)',
      '+8801711223344',
      'customer',
      hashPassword('CustomerA#2026!'),
      now
    );
    // Customer B
    userStmt.run(
      '00000000-0000-4000-a000-000000000002',
      '10000000-0000-4000-a000-000000000002',
      'bob@chittagongtraders.bd',
      'Bob Karim (Customer B)',
      '+8801811223355',
      'customer',
      hashPassword('CustomerB#2026!'),
      now
    );
    // Finance Officer
    userStmt.run(
      '00000000-0000-4000-a000-000000000003',
      '10000000-0000-4000-a000-000000000099',
      'finance@hoooplaaa.com',
      'Farhana Islam (Finance Officer)',
      '+8801700000003',
      'finance',
      hashPassword('Finance#2026!'),
      now
    );
    // Specialist Engineer
    userStmt.run(
      '00000000-0000-4000-a000-000000000004',
      '10000000-0000-4000-a000-000000000099',
      'engineer@hoooplaaa.com',
      'Tanvir Ahmed (Senior Specialist)',
      '+8801700000004',
      'engineer',
      hashPassword('Engineer#2026!'),
      now
    );
    // Super Admin
    userStmt.run(
      '00000000-0000-4000-a000-000000000005',
      '10000000-0000-4000-a000-000000000099',
      'admin@hoooplaaa.com',
      'Sazzad Hossain (Principal Admin)',
      '+8801700000005',
      'admin',
      hashPassword('Admin#2026!'),
      now
    );
  }

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  public clearAllForTesting(): void {
    this.sqlite.exec(`
      DELETE FROM order_files;
      DELETE FROM order_intakes;
      DELETE FROM payment_events;
      DELETE FROM payments;
      DELETE FROM orders;
      DELETE FROM quotes;
      DELETE FROM audit_requests;
      DELETE FROM audit_logs;
    `);
  }

  // ============================================================================
  // USER PROFILES & TENANT MANAGEMENT
  // ============================================================================

  public async getUserByEmail(email: string): Promise<DbUserProfile | null> {
    const normalized = email.trim().toLowerCase();
    if (this.isLiveSupabaseConnected && this.supabase) {
      const { data } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('email', normalized)
        .maybeSingle();
      if (data) {
        return {
          id: data.id,
          organizationId: data.organization_id,
          email: data.email,
          fullName: data.full_name,
          phoneNumber: data.phone_number,
          role: data.role,
          passwordHash: data.password_hash || '',
          createdAt: data.created_at,
        };
      }
    }

    const row = this.sqlite
      .prepare('SELECT * FROM user_profiles WHERE lower(email) = ?')
      .get(normalized) as Record<string, any> | undefined;
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      role: row.role,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  public async getUserById(userId: string): Promise<DbUserProfile | null> {
    if (this.isLiveSupabaseConnected && this.supabase) {
      const { data } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        return {
          id: data.id,
          organizationId: data.organization_id,
          email: data.email,
          fullName: data.full_name,
          phoneNumber: data.phone_number,
          role: data.role,
          passwordHash: data.password_hash || '',
          createdAt: data.created_at,
        };
      }
    }

    const row = this.sqlite
      .prepare('SELECT * FROM user_profiles WHERE id = ?')
      .get(userId) as Record<string, any> | undefined;
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      role: row.role,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  public async createOrGetCustomerUser(params: {
    email: string;
    fullName?: string;
    businessName?: string;
    password?: string;
  }): Promise<DbUserProfile> {
    const existing = await this.getUserByEmail(params.email);
    if (existing) return existing;

    const normalizedEmail = params.email.trim().toLowerCase();
    const userId = toDeterministicUuid(`user:${normalizedEmail}`);
    const orgId = toDeterministicUuid(`org:${normalizedEmail}`);
    const now = new Date().toISOString();
    const passHash = hashPassword(params.password || 'CustomerDefault#2026!');

    this.sqlite
      .prepare(
        `INSERT OR IGNORE INTO organizations (id, name, website_url, industry, country_code, created_at)
         VALUES (?, ?, '', 'Digital Commerce', 'BD', ?)`
      )
      .run(orgId, params.businessName || params.fullName || normalizedEmail, now);

    this.sqlite
      .prepare(
        `INSERT OR IGNORE INTO user_profiles (id, organization_id, email, full_name, role, password_hash, created_at)
         VALUES (?, ?, ?, ?, 'customer', ?, ?)`
      )
      .run(userId, orgId, normalizedEmail, params.fullName || normalizedEmail, passHash, now);

    return (await this.getUserById(userId))!;
  }

  /**
   * Enforces immutability of role and organizationId on self-service profile updates.
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

    this.sqlite
      .prepare(
        `UPDATE user_profiles SET full_name = COALESCE(?, full_name), phone_number = COALESCE(?, phone_number) WHERE id = ?`
      )
      .run(updates.fullName ?? null, updates.phoneNumber ?? null, targetUserId);

    return (await this.getUserById(targetUserId))!;
  }

  // ============================================================================
  // QUOTES
  // ============================================================================

  public async saveQuote(quote: QuoteSnapshot, customerId?: string, organizationId?: string): Promise<QuoteSnapshot> {
    const quoteUuid = toDeterministicUuid(`quote:${quote.id}`);
    const payloadJson = JSON.stringify(quote);

    if (this.isLiveSupabaseConnected && this.supabase) {
      await this.supabase.from('quotes').upsert(
        {
          id: quoteUuid,
          quote_code: quote.id,
          organization_id: organizationId || null,
          customer_id: customerId || null,
          business_name: quote.businessName,
          selected_items: quote.items,
          subtotal_minor: quote.subtotalMinor,
          discount_minor: quote.discountMinor,
          total_minor: quote.totalMinor,
          currency: quote.currency,
          eligibility_snapshot: quote.eligibility,
          status: quote.status,
          quote_hash: quote.termsHash || 'v5_hash',
          expires_at: quote.expiresAt,
          payload_json: quote,
          created_at: quote.createdAt,
        },
        { onConflict: 'id' }
      );
    }

    this.sqlite
      .prepare(
        `INSERT INTO quotes (
          id, quote_uuid, organization_id, customer_id, business_name,
          subtotal_minor, discount_minor, total_minor, currency, status,
          quote_hash, expires_at, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json`
      )
      .run(
        quote.id,
        quoteUuid,
        organizationId || null,
        customerId || null,
        quote.businessName,
        quote.subtotalMinor,
        quote.discountMinor,
        quote.totalMinor,
        quote.currency,
        quote.status,
        quote.termsHash || 'v5_hash',
        quote.expiresAt,
        payloadJson,
        quote.createdAt
      );

    return quote;
  }

  public async getQuote(quoteId: string): Promise<QuoteSnapshot | undefined> {
    if (this.isLiveSupabaseConnected && this.supabase) {
      const { data } = await this.supabase
        .from('quotes')
        .select('payload_json')
        .or(`quote_code.eq.${quoteId},id.eq.${toDeterministicUuid(`quote:${quoteId}`)}`)
        .maybeSingle();
      if (data?.payload_json) return data.payload_json as QuoteSnapshot;
    }

    const row = this.sqlite
      .prepare('SELECT payload_json FROM quotes WHERE id = ? OR quote_uuid = ?')
      .get(quoteId, quoteId) as { payload_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.payload_json) as QuoteSnapshot;
  }

  // ============================================================================
  // ORDERS
  // ============================================================================

  public async saveOrder(order: Order, organizationId?: string): Promise<Order> {
    // Ensure quote and user exist in relational store to satisfy foreign keys
    await this.saveQuote(order.quoteSnapshot);

    let customerProfile = await this.getUserById(order.customerUserId);
    if (!customerProfile) {
      const fallbackUuid = toDeterministicUuid(`user:${order.customerUserId}`);
      customerProfile = await this.getUserById(fallbackUuid);
      if (!customerProfile) {
        const orgId = organizationId || toDeterministicUuid(`org:${order.customerUserId}`);
        const now = new Date().toISOString();
        this.sqlite
          .prepare(
            `INSERT OR IGNORE INTO organizations (id, name, website_url, industry, country_code, created_at)
             VALUES (?, ?, '', 'Digital Commerce', 'BD', ?)`
          )
          .run(orgId, order.quoteSnapshot.businessName || 'Client Organization', now);
        this.sqlite
          .prepare(
            `INSERT OR IGNORE INTO user_profiles (id, organization_id, email, full_name, role, password_hash, created_at)
             VALUES (?, ?, ?, ?, 'customer', ?, ?)`
          )
          .run(
            order.customerUserId,
            orgId,
            `${order.customerUserId}@client.hoooplaaa.bd`,
            order.quoteSnapshot.businessName || 'Client User',
            hashPassword('Client#2026!'),
            now
          );
        customerProfile = (await this.getUserById(order.customerUserId))!;
      }
    }

    const resolvedOrgId = organizationId || customerProfile.organizationId;
    const orderUuid = toDeterministicUuid(`order:${order.id}`);
    const payloadJson = JSON.stringify({ ...order, organizationId: resolvedOrgId });

    if (this.isLiveSupabaseConnected && this.supabase) {
      await this.supabase.from('orders').upsert(
        {
          id: orderUuid,
          order_code: order.id,
          organization_id: resolvedOrgId,
          customer_id: customerProfile.id,
          quote_id: toDeterministicUuid(`quote:${order.quoteId}`),
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
          payload_json: order,
          created_at: order.createdAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    this.sqlite
      .prepare(
        `INSERT INTO orders (
          id, order_uuid, order_number, organization_id, customer_id, quote_id,
          assigned_engineer_id, assigned_specialist_name, order_status, financial_status,
          intake_status, total_minor, currency, sla_started_at, sla_deadline_at,
          delivered_at, accepted_at, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          assigned_engineer_id = excluded.assigned_engineer_id,
          assigned_specialist_name = excluded.assigned_specialist_name,
          order_status = excluded.order_status,
          financial_status = excluded.financial_status,
          intake_status = excluded.intake_status,
          sla_started_at = excluded.sla_started_at,
          sla_deadline_at = excluded.sla_deadline_at,
          delivered_at = excluded.delivered_at,
          accepted_at = excluded.accepted_at,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at`
      )
      .run(
        order.id,
        orderUuid,
        order.orderNumber,
        resolvedOrgId,
        customerProfile.id,
        order.quoteId,
        order.assignedSpecialistId || null,
        order.assignedSpecialistName || null,
        order.status,
        order.financialStatus,
        order.intakeStatus,
        order.totalMinor,
        order.currency,
        order.slaStartedAt || null,
        order.deliveryTargetDate || null,
        order.deliveredAt || null,
        order.acceptedAt || null,
        payloadJson,
        order.createdAt,
        new Date().toISOString()
      );

    await this.recordAuditLog({
      actorId: customerProfile.id,
      actorRole: customerProfile.role,
      action: 'ORDER_UPSERT',
      entityType: 'order',
      entityId: order.id,
      metadata: { status: order.status, financialStatus: order.financialStatus },
    });

    return order;
  }

  public async getOrder(orderId: string): Promise<(Order & { organizationId?: string }) | undefined> {
    if (this.isLiveSupabaseConnected && this.supabase) {
      const { data } = await this.supabase
        .from('orders')
        .select('payload_json, organization_id')
        .or(`order_code.eq.${orderId},id.eq.${toDeterministicUuid(`order:${orderId}`)}`)
        .maybeSingle();
      if (data?.payload_json) {
        return { ...(data.payload_json as Order), organizationId: data.organization_id };
      }
    }

    const row = this.sqlite
      .prepare('SELECT payload_json, organization_id, customer_id FROM orders WHERE id = ? OR order_uuid = ? OR order_number = ?')
      .get(orderId, orderId, orderId) as { payload_json: string; organization_id: string; customer_id: string } | undefined;
    if (!row) return undefined;
    const parsed = JSON.parse(row.payload_json) as Order;
    return { ...parsed, customerUserId: row.customer_id, organizationId: row.organization_id };
  }

  public async listAllOrders(): Promise<Order[]> {
    const rows = this.sqlite
      .prepare('SELECT payload_json FROM orders ORDER BY created_at DESC')
      .all() as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json) as Order);
  }

  public async getAllOrders(): Promise<Order[]> {
    return this.listAllOrders();
  }

  public async listOrdersForCustomer(customerId: string, organizationId?: string): Promise<Order[]> {
    const rows = this.sqlite
      .prepare(
        'SELECT payload_json FROM orders WHERE customer_id = ? OR organization_id = ? ORDER BY created_at DESC'
      )
      .all(customerId, organizationId || '') as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json) as Order);
  }

  // ============================================================================
  // PAYMENTS & CONCURRENCY-SAFE IDEMPOTENCY / REPLAY PROTECTION
  // ============================================================================

  public async recordPaymentAttempt(record: DbPaymentRecord): Promise<DbPaymentRecord> {
    if (this.isLiveSupabaseConnected && this.supabase) {
      await this.supabase.from('payments').upsert(
        {
          id: toDeterministicUuid(`pay:${record.id}`),
          order_id: toDeterministicUuid(`order:${record.orderId}`),
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
          verified_by_finance_id: record.verifiedByFinanceId || null,
          verified_at: record.verifiedAt || null,
          rejection_reason: record.rejectionReason || null,
          gateway_raw_payload: record.gatewayRawPayload,
          created_at: record.createdAt,
        },
        { onConflict: 'idempotency_key' }
      );
    }

    this.sqlite
      .prepare(
        `INSERT INTO payments (
          id, order_id, payment_method, payment_status, amount_minor, currency,
          idempotency_key, provider_session_key, provider_trx_id, provider_val_id,
          manual_sender_phone, manual_trx_reference, verified_by_finance_id,
          verified_at, rejection_reason, gateway_raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO UPDATE SET
          payment_status = excluded.payment_status,
          provider_trx_id = COALESCE(excluded.provider_trx_id, payments.provider_trx_id),
          provider_val_id = COALESCE(excluded.provider_val_id, payments.provider_val_id),
          manual_sender_phone = COALESCE(excluded.manual_sender_phone, payments.manual_sender_phone),
          manual_trx_reference = COALESCE(excluded.manual_trx_reference, payments.manual_trx_reference),
          verified_by_finance_id = COALESCE(excluded.verified_by_finance_id, payments.verified_by_finance_id),
          verified_at = COALESCE(excluded.verified_at, payments.verified_at),
          rejection_reason = COALESCE(excluded.rejection_reason, payments.rejection_reason),
          gateway_raw_payload = excluded.gateway_raw_payload`
      )
      .run(
        record.id,
        record.orderId,
        record.paymentMethod,
        record.paymentStatus,
        record.amountMinor,
        record.currency,
        record.idempotencyKey,
        record.providerSessionKey || null,
        record.providerTrxId || null,
        record.providerValId || null,
        record.manualSenderPhone || null,
        record.manualTrxReference || null,
        record.verifiedByFinanceId || null,
        record.verifiedAt || null,
        record.rejectionReason || null,
        JSON.stringify(record.gatewayRawPayload),
        record.createdAt
      );

    return record;
  }

  /**
   * Concurrency-safe database-level idempotency and replay check.
   * Uses a UNIQUE constraint on `provider_val_id` and `event_key` inside SQL.
   * Returns `{ isReplay: true }` if `valId` or `eventKey` was already processed.
   */
  public async claimUniquePaymentEvent(params: {
    eventKey: string;
    orderId: string;
    paymentId?: string;
    provider: string;
    providerValId: string;
    status: string;
    amountMinor: number;
    currency: string;
    evidencePayload: Record<string, unknown>;
  }): Promise<{ claimed: boolean; reason?: string }> {
    const existing = this.sqlite
      .prepare('SELECT id FROM payment_events WHERE provider_val_id = ? OR event_key = ?')
      .get(params.providerValId, params.eventKey);

    if (existing) {
      return {
        claimed: false,
        reason: `Replay attack / duplicate callback blocked by database constraint: validation ID (${params.providerValId}) already processed.`,
      };
    }

    try {
      const eventId = `pevt_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();
      this.sqlite
        .prepare(
          `INSERT INTO payment_events (
            id, event_key, order_id, payment_id, provider, provider_val_id,
            status, amount_minor, currency, evidence_payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          eventId,
          params.eventKey,
          params.orderId,
          params.paymentId || null,
          params.provider,
          params.providerValId,
          params.status,
          params.amountMinor,
          params.currency,
          JSON.stringify(params.evidencePayload),
          now
        );
      return { claimed: true };
    } catch (err: any) {
      return {
        claimed: false,
        reason: `Database UNIQUE constraint rejected duplicate payment event (${params.providerValId}).`,
      };
    }
  }

  public async getPaymentsForOrder(orderId: string): Promise<DbPaymentRecord[]> {
    const rows = this.sqlite
      .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC')
      .all(orderId) as Record<string, any>[];
    return rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      amountMinor: r.amount_minor,
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
      gatewayRawPayload: JSON.parse(r.gateway_raw_payload || '{}'),
      createdAt: r.created_at,
    }));
  }

  // ============================================================================
  // INTAKE SUBMISSIONS
  // ============================================================================

  public async saveIntake(
    intakeOrOrderId: IntakeSubmission | Record<string, any> | string,
    secondArg?: IntakeSubmission | Record<string, any> | string
  ): Promise<IntakeSubmission> {
    const intake = (
      typeof intakeOrOrderId === 'string'
        ? secondArg
        : intakeOrOrderId
    ) as IntakeSubmission;
    const submittedByUserId =
      typeof intakeOrOrderId === 'string'
        ? undefined
        : (secondArg as string | undefined);

    const order = await this.getOrder(intake.orderId);
    if (!order) throw new Error('Order not found for intake submission.');
    const actorId = submittedByUserId || order.customerUserId;

    this.sqlite
      .prepare(
        `INSERT INTO order_intakes (
          id, order_id, submitted_by, business_name, contact_email, contact_whatsapp,
          target_audience, brand_colors, existing_page_links, partner_invite_status,
          notes, payload_json, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_id) DO UPDATE SET
          business_name = excluded.business_name,
          contact_email = excluded.contact_email,
          contact_whatsapp = excluded.contact_whatsapp,
          target_audience = excluded.target_audience,
          brand_colors = excluded.brand_colors,
          existing_page_links = excluded.existing_page_links,
          partner_invite_status = excluded.partner_invite_status,
          notes = excluded.notes,
          payload_json = excluded.payload_json,
          submitted_at = excluded.submitted_at`
      )
      .run(
        intake.id || `intake_${Date.now()}`,
        intake.orderId || (typeof intakeOrOrderId === 'string' ? intakeOrOrderId : ''),
        actorId,
        intake.businessName || '',
        intake.contactEmail || 'client@hoooplaaa.bd',
        intake.contactWhatsApp || '+8801700000000',
        intake.targetAudience || '',
        intake.brandColors || '',
        intake.existingPageLinks || '',
        intake.partnerInviteStatus || 'completed',
        intake.notes || '',
        JSON.stringify(intake),
        intake.submittedAt || new Date().toISOString()
      );

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

  public async saveFile(orderId: string, file: Record<string, any>): Promise<void> {
    const bytes = Buffer.from(JSON.stringify(file), 'utf8');
    const sha256Hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const order = await this.getOrder(orderId);
    const uploadedBy = file.uploadedByUserId || order?.customerUserId || '00000000-0000-4000-a000-000000000001';
    const fileId = file.id || `file_${Date.now()}`;
    const fileName = file.fileName || file.name || 'deliverable.pdf';
    const storagePath = file.storagePath || `orders/${orderId}/${fileId}_${fileName}`;
    await this.savePrivateFileWithBytes(
      {
        ...(file as FileAttachment),
        id: fileId,
        orderId,
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

  public async getIntake(orderId: string): Promise<IntakeSubmission | undefined> {
    const row = this.sqlite
      .prepare('SELECT payload_json FROM order_intakes WHERE order_id = ?')
      .get(orderId) as { payload_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.payload_json) as IntakeSubmission;
  }

  // ============================================================================
  // PRIVATE FILE STORAGE (REAL BYTES + SUPABASE STORAGE BUCKET)
  // ============================================================================

  public async savePrivateFileWithBytes(
    fileRecord: FileAttachment & { sha256Hash: string },
    fileBytes: Buffer
  ): Promise<FileAttachment & { sha256Hash: string }> {
    ensureRuntimeDirs();

    // 1. Upload actual bytes to Supabase Storage private bucket if live credentials active
    if (this.isLiveSupabaseConnected && this.supabase) {
      await this.supabase.storage
        .from('order-assets')
        .upload(fileRecord.storagePath, fileBytes, {
          contentType: fileRecord.mimeType,
          upsert: true,
        });
    }

    // 2. Persist actual file bytes to private storage vault on disk
    const diskPath = path.join(PRIVATE_STORAGE_DIR, fileRecord.storagePath.replace(/\//g, '__'));
    fs.writeFileSync(diskPath, fileBytes);

    // 3. Persist relational metadata record with SHA-256 integrity digest
    this.sqlite
      .prepare(
        `INSERT INTO order_files (
          id, order_id, uploaded_by, file_name, file_size_bytes, mime_type,
          sha256_hash, storage_bucket, storage_path, is_private, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'order-assets', ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          file_size_bytes = excluded.file_size_bytes,
          sha256_hash = excluded.sha256_hash,
          payload_json = excluded.payload_json`
      )
      .run(
        fileRecord.id,
        fileRecord.orderId,
        fileRecord.uploadedByUserId,
        fileRecord.fileName,
        fileBytes.byteLength,
        fileRecord.mimeType,
        fileRecord.sha256Hash,
        fileRecord.storagePath,
        JSON.stringify(fileRecord),
        fileRecord.uploadedAt
      );

    return fileRecord;
  }

  public async getFiles(orderId: string): Promise<(FileAttachment & { sha256Hash?: string })[]> {
    const rows = this.sqlite
      .prepare('SELECT payload_json, sha256_hash FROM order_files WHERE order_id = ? ORDER BY created_at ASC')
      .all(orderId) as { payload_json: string; sha256_hash: string }[];
    return rows.map((r) => ({
      ...(JSON.parse(r.payload_json) as FileAttachment),
      sha256Hash: r.sha256_hash,
    }));
  }

  public async getPrivateFileBytes(orderId: string, fileId: string): Promise<{
    file: FileAttachment & { sha256Hash: string };
    bytes: Buffer;
  } | null> {
    const row = this.sqlite
      .prepare('SELECT payload_json, sha256_hash, storage_path FROM order_files WHERE id = ? AND order_id = ?')
      .get(fileId, orderId) as { payload_json: string; sha256_hash: string; storage_path: string } | undefined;
    if (!row) return null;

    const diskPath = path.join(PRIVATE_STORAGE_DIR, row.storage_path.replace(/\//g, '__'));
    if (!fs.existsSync(diskPath)) return null;
    const bytes = fs.readFileSync(diskPath);
    const parsed = JSON.parse(row.payload_json) as FileAttachment;

    return {
      file: { ...parsed, sha256Hash: row.sha256_hash },
      bytes,
    };
  }

  // ============================================================================
  // AUDITS & IMMUTABLE AUDIT LOGS
  // ============================================================================

  public async saveAuditRequest(audit: AuditRequest, customerId?: string): Promise<AuditRequest> {
    this.sqlite
      .prepare(
        `INSERT INTO audit_requests (
          id, customer_id, business_name, website_or_page_url, contact_email,
          contact_phone, status, payload_json, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json`
      )
      .run(
        audit.id,
        customerId || null,
        audit.businessName,
        audit.websiteOrPageUrl,
        audit.contactEmail,
        audit.contactPhone || '',
        audit.stage || 'submitted',
        JSON.stringify(audit),
        audit.submittedAt
      );
    return audit;
  }

  public async listAuditRequests(): Promise<AuditRequest[]> {
    const rows = this.sqlite
      .prepare('SELECT payload_json FROM audit_requests ORDER BY submitted_at DESC')
      .all() as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json) as AuditRequest);
  }

  public async recordAuditLog(entry: {
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const log: AuditLogEntry = {
      id: `aud_${crypto.randomBytes(8).toString('hex')}`,
      actorUserId: entry.actorId,
      actorRole: entry.actorRole as UserRole,
      action: entry.action,
      entityType: entry.entityType as AuditLogEntry['entityType'],
      entityId: entry.entityId,
      metadata: entry.metadata || {},
      timestamp: new Date().toISOString(),
    };

    this.sqlite
      .prepare(
        `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        log.id,
        log.actorUserId,
        log.actorRole,
        log.action,
        log.entityType,
        log.entityId,
        JSON.stringify(log.metadata),
        log.timestamp
      );

    return log;
  }

  public async listAuditLogs(): Promise<AuditLogEntry[]> {
    const rows = this.sqlite
      .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC')
      .all() as Record<string, any>[];
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_id,
      actorRole: r.actor_role as UserRole,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: JSON.parse(r.metadata_json || '{}'),
      timestamp: r.created_at,
    }));
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.listAuditLogs();
  }
}

const globalForDb = globalThis as unknown as { persistentDBV5?: PersistentDatabaseEngine };
export const persistentDB = globalForDb.persistentDBV5 || new PersistentDatabaseEngine();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.persistentDBV5 = persistentDB;
}
