import {
  FinancialStatus,
  IntakeStatus,
  Order,
  OrderItem,
  OrderStatus,
  QuoteSnapshot,
} from './types';
import crypto from 'crypto';

/**
 * Business calendar used for every delivery SLA. It mirrors public.business_calendar_policy /
 * public.add_business_days in SQL (see supabase/migrations/20261110000000_v7_2r_security_hardening.sql).
 *
 * POLICY STATUS: PROVISIONAL_UNAPPROVED. The weekend (Friday/Saturday here, 0=Sun..6=Sat) and the public
 * holiday list are OWNER decisions that have not been confirmed. They are configurable
 * (BUSINESS_WEEKEND_DAYS="5,6", BUSINESS_HOLIDAYS="2026-12-16,2026-12-25") and every SLA records the policy
 * status it was computed under.
 */
export interface BusinessCalendar {
  timezone: 'Asia/Dhaka';
  utcOffsetMinutes: number; // Asia/Dhaka is a fixed UTC+06:00 (no DST)
  weekendDays: number[];
  holidays: string[]; // YYYY-MM-DD in local (Asia/Dhaka) calendar
  opensMinutes: number; // minutes after local midnight
  cutoffMinutes: number;
  policyStatus: 'PROVISIONAL_UNAPPROVED' | 'APPROVED';
}

export function getBusinessCalendar(): BusinessCalendar {
  const parseDays = (v: string | undefined, fallback: number[]) => {
    if (!v) return fallback;
    const parsed = v
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    return parsed.length > 0 ? parsed : fallback;
  };
  return {
    timezone: 'Asia/Dhaka',
    utcOffsetMinutes: 360,
    weekendDays: parseDays(process.env.BUSINESS_WEEKEND_DAYS, [5, 6]),
    holidays: (process.env.BUSINESS_HOLIDAYS || '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => /^d{4}-d{2}-d{2}$/.test(x)),
    opensMinutes: 9 * 60,
    cutoffMinutes: 17 * 60,
    policyStatus: process.env.BUSINESS_CALENDAR_APPROVED === 'true' ? 'APPROVED' : 'PROVISIONAL_UNAPPROVED',
  };
}

function isBusinessDay(localDay: Date, cal: BusinessCalendar): boolean {
  const iso = localDay.toISOString().slice(0, 10);
  return !cal.weekendDays.includes(localDay.getUTCDay()) && !cal.holidays.includes(iso);
}

/**
 * Adds N business days (policy calendar in Asia/Dhaka), preserving time of day. If the start instant is
 * on a non-business day or at/after the cutoff, the clock starts at opening time of the next business day;
 * before opening on a business day it starts at opening time.
 */
export function addBusinessDays(
  startDate: Date,
  days: number,
  calendar: BusinessCalendar = getBusinessCalendar()
): Date {
  const offsetMs = calendar.utcOffsetMinutes * 60_000;
  // Represent local wall-clock time using UTC getters on a shifted Date.
  const local = new Date(startDate.getTime() + offsetMs);
  const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  let msOfDay =
    local.getUTCHours() * 3_600_000 +
    local.getUTCMinutes() * 60_000 +
    local.getUTCSeconds() * 1000 +
    local.getUTCMilliseconds();

  const opensMs = calendar.opensMinutes * 60_000;
  const cutoffMs = calendar.cutoffMinutes * 60_000;

  if (!isBusinessDay(day, calendar) || msOfDay >= cutoffMs) {
    do {
      day.setUTCDate(day.getUTCDate() + 1);
    } while (!isBusinessDay(day, calendar));
    msOfDay = opensMs;
  } else if (msOfDay < opensMs) {
    msOfDay = opensMs;
  }

  let added = 0;
  while (added < Math.max(days, 0)) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (isBusinessDay(day, calendar)) added++;
  }

  return new Date(day.getTime() + msOfDay - offsetMs);
}

/**
 * Calculates authoritative delivery turnaround business days based on purchased SKUs.
 * HI-BUNDLE-3: 4 business days
 * HI-SET-META: 2 business days
 * HI-SET-GOOGLE: 2 business days
 * HI-SET-LINKEDIN: 1 business day
 * HI-ADD-WA / PIXEL / CREATIVE: 2 business days
 */
export function getServiceTurnaroundBusinessDays(items: { sku: string }[]): number {
  const SKU_TURNAROUND: Record<string, number> = {
    'HI-BUNDLE-3': 4,
    'HI-SET-META': 2,
    'HI-SET-GOOGLE': 2,
    'HI-SET-LINKEDIN': 1,
    'HI-ADD-WA': 2,
    'HI-ADD-PIXEL': 2,
    'HI-ADD-CREATIVE': 2,
  };

  if (!items || items.length === 0) return 2;
  if (items.every((i) => SKU_TURNAROUND[i.sku] === 1)) return 1;

  let maxDays = 1;
  for (const item of items) {
    const days = SKU_TURNAROUND[item.sku] || 2;
    if (days > maxDays) {
      maxDays = days;
    }
  }
  return maxDays;
}

export class OrderService {
  private static orderSequence = 1000;

  /**
   * Generates a new order from an accepted quote snapshot.
   * Copies all items, pricing, and scope into an immutable order structure.
   */
  public static createOrderFromQuote(
    quote: QuoteSnapshot,
    customerUserId: string
  ): Order {
    if (quote.status === 'requires_manual_scope' || !quote.eligibility.canSelfCheckout) {
      throw new Error(
        'Cannot checkout: Quote is marked for manual scope review or is ineligible.'
      );
    }

    if (new Date(quote.expiresAt) < new Date()) {
      throw new Error('Cannot checkout: Quote snapshot has expired.');
    }

    const orderId = `ord_${crypto.randomBytes(8).toString('hex')}`;
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const orderNumber = `HI-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${++this.orderSequence}-${randomSuffix}`;

    const items: OrderItem[] = quote.items.map((qItem) => ({
      id: `oi_${crypto.randomBytes(6).toString('hex')}`,
      orderId,
      sku: qItem.sku,
      name: qItem.name,
      unitPriceMinor: qItem.unitPriceMinor,
      quantity: qItem.quantity,
      lineTotalMinor: qItem.lineTotalMinor,
      scopeSnapshot: {
        inclusions: [...qItem.inclusionsSnapshot],
        exclusions: [...qItem.exclusionsSnapshot],
        deliveryTarget: qItem.deliveryTarget,
      },
    }));

    const now = new Date().toISOString();

    return {
      id: orderId,
      orderNumber,
      businessId: quote.businessId,
      quoteId: quote.id,
      customerUserId,
      status: 'awaiting_payment',
      financialStatus: 'unpaid',
      intakeStatus: 'not_started',
      totalMinor: quote.totalMinor,
      currency: quote.currency,
      items,
      createdAt: now,
      updatedAt: now,
      quoteSnapshot: JSON.parse(JSON.stringify(quote)), // deep clone for complete immutability
    };
  }

  /**
   * Transition order to Paid status upon verified payment.
   */
  public static markOrderPaid(order: Order, paymentRef: string): Order {
    if (order.financialStatus === 'paid') {
      return order; // already paid, idempotent
    }

    const updated = { ...order };
    updated.financialStatus = 'paid';
    updated.status = 'awaiting_requirements'; // Next step: client must complete intake
    updated.updatedAt = new Date().toISOString();

    // Note: SLA timer does NOT start here. It strictly waits for intake submission!
    return updated;
  }

  /**
   * Transition order to Payment Under Review for manual MFS / Bank transfer.
   */
  public static markOrderPaymentUnderReview(order: Order, transactionRef: string): Order {
    const updated = { ...order };
    updated.financialStatus = 'pending_verification';
    updated.status = 'payment_under_review';
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * Complete client intake form.
   * Triggers the official SLA start timer ONLY if payment has already been verified!
   */
  public static completeIntake(order: Order): Order {
    const updated = { ...order };
    updated.intakeStatus = 'completed';
    updated.updatedAt = new Date().toISOString();

    if (updated.financialStatus === 'paid') {
      updated.status = 'ready_for_fulfillment';
      // Official SLA clock starts now with service-specific business-day delivery targets
      const now = new Date();
      updated.slaStartedAt = now.toISOString();
      const targetBusinessDays = getServiceTurnaroundBusinessDays(updated.items || []);
      const targetDate = addBusinessDays(now, targetBusinessDays);
      updated.deliveryTargetDate = targetDate.toISOString();
      (updated as any).turnaroundBusinessDays = targetBusinessDays;
      (updated as any).slaCalendarPolicy = getBusinessCalendar().policyStatus;
    } else {
      // Order paid status is pending, stay in awaiting_payment or payment_under_review
      // SLA cannot start yet
    }

    return updated;
  }

  /**
   * Staff assignment and progress update.
   */
  /**
   * Staff assignment and progress update.
   * Prerequisites:
   * - Order must be paid (financialStatus === 'paid')
   * - Order intake must be completed (intakeStatus === 'completed')
   * - Order status must be ready_for_fulfillment, in_progress, or qa_review
   */
  public static assignStaff(
    order: Order,
    specialistId: string,
    specialistName: string
  ): Order {
    if (order.financialStatus !== 'paid') {
      throw new Error('Illegal state transition: Cannot assign staff to an unpaid order.');
    }
    if (order.intakeStatus !== 'completed') {
      throw new Error('Illegal state transition: Cannot assign staff before client intake requirements are completed.');
    }
    if (!['ready_for_fulfillment', 'in_progress', 'qa_review'].includes(order.status)) {
      throw new Error(`Illegal state transition: Cannot assign staff to order in status '${order.status}'.`);
    }

    const updated = { ...order };
    updated.assignedSpecialistId = specialistId;
    updated.assignedSpecialistName = specialistName;
    if (updated.status === 'ready_for_fulfillment') {
      updated.status = 'in_progress';
    }
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * Submit completed setup for internal QA review.
   * Prerequisites:
   * - Order must be paid
   * - Order intake must be completed
   * - Order must be in_progress
   * - Order must have an assigned specialist
   */
  public static submitForQA(order: Order): Order {
    if (order.financialStatus !== 'paid') {
      throw new Error('Illegal state transition: Cannot submit for QA on an unpaid order.');
    }
    if (order.intakeStatus !== 'completed') {
      throw new Error('Illegal state transition: Cannot submit for QA before client intake requirements are completed.');
    }
    if (order.status !== 'in_progress') {
      throw new Error(`Illegal state transition: Order must be in 'in_progress' status to submit for QA (current: '${order.status}').`);
    }
    if (!order.assignedSpecialistId) {
      throw new Error('Illegal state transition: Order must have an assigned specialist before QA submission.');
    }

    const updated = { ...order };
    updated.status = 'qa_review';
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * QA passed, deliver to client.
   * Prerequisites:
   * - Order must be paid
   * - Order intake must be completed
   * - Order must be in qa_review
   * - Delivery requires QA checklist passed verification
   */
  public static deliverOrder(order: Order, params?: { qaChecklistPassed?: boolean }): Order {
    if (order.financialStatus !== 'paid') {
      throw new Error('Illegal state transition: Cannot deliver an unpaid order.');
    }
    if (order.intakeStatus !== 'completed') {
      throw new Error('Illegal state transition: Cannot deliver before client intake is completed.');
    }
    if (order.status !== 'qa_review') {
      throw new Error(`Illegal state transition: Order must be in 'qa_review' status before delivery (current: '${order.status}').`);
    }
    if (!params || params.qaChecklistPassed !== true) {
      throw new Error('Illegal state transition: QA checklist must be passed before delivery.');
    }

    const updated = { ...order };
    updated.status = 'delivered';
    updated.deliveredAt = new Date().toISOString();
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * Request revision on a delivered order.
   * Prerequisites:
   * - Order must be delivered
   */
  public static requestRevision(order: Order, revisionNotes?: string): Order {
    if (order.status !== 'delivered') {
      throw new Error(`Illegal state transition: Revisions can only be requested on delivered orders (current: '${order.status}').`);
    }
    const updated = { ...order };
    updated.status = 'in_progress';
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * Client accepts handover.
   * Prerequisites:
   * - Order must be paid
   * - Order must be in delivered status
   */
  public static acceptHandover(order: Order, actorId?: string): Order {
    if (order.financialStatus !== 'paid') {
      throw new Error('Illegal state transition: Cannot accept an unpaid order.');
    }
    if (order.status !== 'delivered') {
      throw new Error(`Illegal state transition: Only delivered orders can be accepted (current: '${order.status}').`);
    }

    const updated = { ...order };
    updated.status = 'accepted';
    updated.acceptedAt = new Date().toISOString();
    updated.updatedAt = new Date().toISOString();
    return updated;
  }
}
