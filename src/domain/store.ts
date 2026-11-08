import { AuditRequest, FileAttachment, IntakeSubmission, Order, QuoteSnapshot } from './types';
import { persistentDB } from './persistent-db';

const syncQuotes = new Map<string, QuoteSnapshot>();
const syncOrders = new Map<string, Order>();
const syncIntakes = new Map<string, IntakeSubmission>();
const syncFiles = new Map<string, FileAttachment[]>();
const syncAudits = new Map<string, AuditRequest>();

export const quoteStore = {
  get: (id: string): QuoteSnapshot | undefined => syncQuotes.get(id),
  set: (id: string, quote: QuoteSnapshot) => {
    syncQuotes.set(id, quote);
    void persistentDB.saveQuote(quote);
    return quoteStore;
  },
  has: (id: string): boolean => syncQuotes.has(id),
};

export const orderStore = {
  get: (id: string): Order | undefined => syncOrders.get(id),
  set: (id: string, order: Order) => {
    syncOrders.set(id, order);
    void persistentDB.saveOrder(order);
    return orderStore;
  },
  values: (): Order[] => Array.from(syncOrders.values()),
  has: (id: string): boolean => syncOrders.has(id),
};

export const intakeStore = {
  get: (orderId: string): IntakeSubmission | undefined => syncIntakes.get(orderId),
  set: (orderId: string, intake: IntakeSubmission) => {
    syncIntakes.set(orderId, intake);
    void persistentDB.saveIntake(intake);
    return intakeStore;
  },
  has: (orderId: string): boolean => syncIntakes.has(orderId),
};

export const fileStore = {
  get: (orderId: string): FileAttachment[] => syncFiles.get(orderId) || [],
  set: (orderId: string, files: FileAttachment[]) => {
    syncFiles.set(orderId, files);
    return fileStore;
  },
  has: (orderId: string): boolean => (syncFiles.get(orderId) || []).length > 0,
};

export const auditListStore = {
  get: (id: string): AuditRequest | undefined => syncAudits.get(id),
  set: (id: string, audit: AuditRequest) => {
    syncAudits.set(id, audit);
    void persistentDB.saveAuditRequest(audit);
    return auditListStore;
  },
  values: (): AuditRequest[] => Array.from(syncAudits.values()),
  has: (id: string): boolean => syncAudits.has(id),
};

export { persistentDB };
