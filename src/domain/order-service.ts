import {
  FinancialStatus,
  IntakeStatus,
  Order,
  OrderItem,
  OrderStatus,
  QuoteSnapshot,
} from './types';
import crypto from 'crypto';

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
      // Official SLA clock starts now!
      updated.slaStartedAt = new Date().toISOString();
      const targetDays = 3; // Standard bundle target
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + targetDays);
      updated.deliveryTargetDate = targetDate.toISOString();
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
