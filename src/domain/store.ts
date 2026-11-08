import { AuditRequest, FileAttachment, IntakeSubmission, Order, QuoteSnapshot } from './types';
import { persistentDB } from './persistent-db';

export const quoteStore = {
  get: (id: string): QuoteSnapshot | undefined => {
    const q = persistentDB.getQuote(id);
    return q || undefined;
  },
  set: (id: string, quote: QuoteSnapshot) => {
    persistentDB.saveQuote(quote);
    return quoteStore;
  },
  has: (id: string): boolean => Boolean(persistentDB.getQuote(id)),
};

export const orderStore = {
  get: (id: string): Order | undefined => {
    const o = persistentDB.getOrder(id);
    return o || undefined;
  },
  set: (id: string, order: Order) => {
    persistentDB.saveOrder(order);
    return orderStore;
  },
  values: (): Order[] => persistentDB.getAllOrders(),
  has: (id: string): boolean => Boolean(persistentDB.getOrder(id)),
};

export const intakeStore = {
  get: (orderId: string): IntakeSubmission | undefined => {
    const intake = persistentDB.getIntake(orderId);
    return intake || undefined;
  },
  set: (orderId: string, intake: IntakeSubmission) => {
    persistentDB.saveIntake(orderId, intake);
    return intakeStore;
  },
  has: (orderId: string): boolean => Boolean(persistentDB.getIntake(orderId)),
};

export const fileStore = {
  get: (orderId: string): FileAttachment[] => persistentDB.getFiles(orderId),
  set: (orderId: string, files: FileAttachment[]) => {
    for (const f of files) {
      persistentDB.saveFile(orderId, f);
    }
    return fileStore;
  },
  has: (orderId: string): boolean => persistentDB.getFiles(orderId).length > 0,
};

export const auditListStore = {
  get: (id: string): AuditRequest | undefined => {
    const a = persistentDB.getAuditRequest(id);
    return a || undefined;
  },
  set: (id: string, audit: AuditRequest) => {
    persistentDB.saveAuditRequest(audit);
    return auditListStore;
  },
  values: (): AuditRequest[] => persistentDB.getAllAuditRequests(),
  has: (id: string): boolean => Boolean(persistentDB.getAuditRequest(id)),
};

export { persistentDB };
