import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AuditLogEntry,
  AuditRequest,
  BusinessProfile,
  FileAttachment,
  IntakeSubmission,
  Order,
  QuoteSnapshot,
  UserRole,
} from './types';

// Path for persistent local database storage across server restarts
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'persistent_database.json');

export interface DatabaseState {
  quotes: Record<string, QuoteSnapshot>;
  orders: Record<string, Order>;
  intakes: Record<string, IntakeSubmission>;
  files: Record<string, FileAttachment[]>;
  audits: Record<string, AuditRequest>;
  auditLogs: AuditLogEntry[];
  businesses: Record<string, BusinessProfile>;
}

const DEFAULT_STATE: DatabaseState = {
  quotes: {},
  orders: {},
  intakes: {},
  files: {},
  audits: {},
  auditLogs: [],
  businesses: {},
};

export class PersistentDB {
  private static instance: PersistentDB;
  private state: DatabaseState;
  private supabaseClient: SupabaseClient | null = null;
  private isRemoteSupabaseConfigured = false;

  private constructor() {
    this.ensureDataDirectory();
    this.state = this.loadStateFromDisk();
    this.initSupabaseClient();
  }

  public static getInstance(): PersistentDB {
    if (!PersistentDB.instance) {
      PersistentDB.instance = new PersistentDB();
    }
    return PersistentDB.instance;
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadStateFromDisk(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          quotes: parsed.quotes || {},
          orders: parsed.orders || {},
          intakes: parsed.intakes || {},
          files: parsed.files || {},
          audits: parsed.audits || {},
          auditLogs: parsed.auditLogs || [],
          businesses: parsed.businesses || {},
        };
      }
    } catch (err) {
      console.error('[PersistentDB] Error loading state from disk, initializing fresh:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  private persistStateToDisk(): void {
    try {
      this.ensureDataDirectory();
      const tmpPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DB_FILE_PATH);
    } catch (err) {
      console.error('[PersistentDB] Error persisting database state to disk:', err);
    }
  }

  private initSupabaseClient(): void {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      supabaseKey &&
      !supabaseUrl.includes('placeholder') &&
      !supabaseKey.includes('placeholder')
    ) {
      try {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        this.isRemoteSupabaseConfigured = true;
      } catch (err) {
        console.warn('[PersistentDB] Could not initialize remote Supabase client:', err);
      }
    }
  }

  // --- QUOTES ---
  public async saveQuote(quote: QuoteSnapshot): Promise<void> {
    this.state.quotes[quote.id] = quote;
    this.persistStateToDisk();

    if (this.isRemoteSupabaseConfigured && this.supabaseClient) {
      try {
        await this.supabaseClient.from('quotes').upsert({
          id: quote.id,
          quote_number: quote.id,
          items_snapshot: quote.items,
          currency: quote.currency,
          subtotal_minor: quote.subtotalMinor,
          final_amount_minor: quote.totalMinor,
          rule_version: quote.ruleVersion,
          terms_hash: quote.termsHash,
          eligibility_report: quote.eligibility,
          can_self_checkout: quote.eligibility.canSelfCheckout,
          status: quote.status,
          expires_at: quote.expiresAt,
        });
      } catch (e) {
        console.warn('[PersistentDB] Supabase remote sync skipped:', e);
      }
    }
  }

  public getQuote(quoteId: string): QuoteSnapshot | null {
    return this.state.quotes[quoteId] || null;
  }

  // --- ORDERS ---
  public async saveOrder(order: Order): Promise<void> {
    this.state.orders[order.id] = order;
    this.persistStateToDisk();

    // Also record system audit entry
    this.recordAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      actorUserId: order.customerUserId,
      actorRole: 'customer',
      action: 'ORDER_UPSERT',
      entityType: 'order',
      entityId: order.id,
      newState: { status: order.status, financialStatus: order.financialStatus },
      timestamp: new Date().toISOString(),
    });

    if (this.isRemoteSupabaseConfigured && this.supabaseClient) {
      try {
        await this.supabaseClient.from('orders').upsert({
          id: order.id,
          order_number: order.orderNumber,
          quote_id: order.quoteId,
          customer_user_id: order.customerUserId,
          status: order.status,
          financial_status: order.financialStatus,
          intake_status: order.intakeStatus,
          total_minor: order.totalMinor,
          quote_snapshot: order.quoteSnapshot,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[PersistentDB] Supabase remote sync skipped:', e);
      }
    }
  }

  public getOrder(orderId: string): Order | null {
    return this.state.orders[orderId] || null;
  }

  public getAllOrders(): Order[] {
    return Object.values(this.state.orders).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // --- INTAKES ---
  public async saveIntake(orderId: string, intake: IntakeSubmission): Promise<void> {
    this.state.intakes[orderId] = intake;
    this.persistStateToDisk();

    this.recordAuditLog({
      id: `audit_intake_${Date.now()}`,
      actorUserId: intake.orderId,
      actorRole: 'customer',
      action: 'INTAKE_SUBMITTED',
      entityType: 'intake',
      entityId: orderId,
      newState: { businessName: intake.businessName },
      timestamp: new Date().toISOString(),
    });
  }

  public getIntake(orderId: string): IntakeSubmission | null {
    return this.state.intakes[orderId] || null;
  }

  // --- FILES ---
  public async saveFile(orderId: string, file: FileAttachment): Promise<void> {
    if (!this.state.files[orderId]) {
      this.state.files[orderId] = [];
    }
    this.state.files[orderId].push(file);
    this.persistStateToDisk();
  }

  public getFiles(orderId: string): FileAttachment[] {
    return this.state.files[orderId] || [];
  }

  // --- AUDITS ---
  public async saveAuditRequest(audit: AuditRequest): Promise<void> {
    this.state.audits[audit.id] = audit;
    this.persistStateToDisk();
  }

  public getAuditRequest(auditId: string): AuditRequest | null {
    return this.state.audits[auditId] || null;
  }

  public getAllAuditRequests(): AuditRequest[] {
    return Object.values(this.state.audits).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  // --- AUDIT LOGS ---
  public recordAuditLog(entry: AuditLogEntry): void {
    this.state.auditLogs.unshift(entry);
    // Keep last 1,000 entries
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 1000);
    }
    this.persistStateToDisk();
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.state.auditLogs;
  }

  // --- RESET FOR TESTING ---
  public clearAllForTesting(): void {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.persistStateToDisk();
  }
}

export const persistentDB = PersistentDB.getInstance();
