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
 * Adds business days to a given start date (skipping Saturday and Sunday).
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
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
    } else {
      // Order paid status is pending, stay in awaiting_payment or payment_under_review
      // SLA cannot start yet
    }

    return updated;
  }

  /**
   * Staff assignment and progress update.
   */
  public static assignStaff(
    order: Order,
    specialistId: string,
    specialistName: string
  ): Order {
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
   */
  public static submitForQA(order: Order): Order {
    const updated = { ...order };
    updated.status = 'qa_review';
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * QA passed, deliver to client.
   */
  public static deliverOrder(order: Order): Order {
    const updated = { ...order };
    updated.status = 'delivered';
    updated.deliveredAt = new Date().toISOString();
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  /**
   * Client accepts handover.
   */
  public static acceptHandover(order: Order): Order {
    const updated = { ...order };
    updated.status = 'accepted';
    updated.acceptedAt = new Date().toISOString();
    updated.updatedAt = new Date().toISOString();
    return updated;
  }
}
