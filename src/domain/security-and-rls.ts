import { CANONICAL_SERVICES } from './catalog';
import { Order, QuoteSnapshot, UserRole } from './types';

export interface UserSessionContext {
  userId: string;
  email: string;
  role: UserRole; // server-controlled role
  accessibleBusinessIds: string[];
}

export class SecurityAndRLS {
  /**
   * Blocked SKUs that can NEVER be purchased through self-service checkout.
   */
  public static readonly BLOCKED_OR_UNAPPROVED_SKUS = [
    'HI-SAAS-01',
    'HI-GATEWAY-CUSTOM-CUSTODY',
    'HI-PREPAID-VIRTUAL-CARD',
    'HI-UNLIMITED-CHATGPT-ADS',
  ];

  /**
   * Enforces tenant boundary on orders.
   * Customers can ONLY access orders belonging to their authorized business IDs.
   */
  public static canAccessOrder(
    session: UserSessionContext,
    order: Order
  ): boolean {
    if (session.role === 'admin' || session.role === 'super_admin' || session.role === 'finance') {
      return true; // Staff with elevated privileges
    }

    if (session.role === 'fulfillment') {
      return order.assignedSpecialistId === session.userId;
    }

    // Customer role: strictly tenant isolated
    return session.accessibleBusinessIds.includes(order.businessId);
  }

  /**
   * Prohibits client metadata role elevation.
   * Role MUST be queried from server-controlled records, never accepted from user_metadata.
   */
  public static sanitizeRoleAssignment(
    requestingUserRole: UserRole,
    targetRoleToAssign: UserRole
  ): boolean {
    if (requestingUserRole !== 'super_admin') {
      return false; // Only super_admin can assign or elevate staff roles
    }
    return true;
  }

  /**
   * Enforces checkout SKU approval.
   * Denies any attempt to purchase blocked, unapproved, or internal-only SKUs.
   */
  public static validateCheckoutSkus(skus: string[]): {
    allowed: boolean;
    violatingSku?: string;
    reason?: string;
  } {
    for (const sku of skus) {
      if (this.BLOCKED_OR_UNAPPROVED_SKUS.includes(sku)) {
        return {
          allowed: false,
          violatingSku: sku,
          reason: `SKU ${sku} is blocked or unapproved for self-service checkout.`,
        };
      }

      const srv = CANONICAL_SERVICES.find((s) => s.sku === sku);
      if (!srv) {
        return {
          allowed: false,
          violatingSku: sku,
          reason: `SKU ${sku} does not exist in canonical catalog.`,
        };
      }

      if (!srv.checkoutEnabled || srv.publicationStatus !== 'published') {
        return {
          allowed: false,
          violatingSku: sku,
          reason: `SKU ${sku} has checkout_enabled=false or is not in published status.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Price snapshot immutability verification.
   * Ensures that updating catalog rates does not rewrite historical quotes or orders.
   */
  public static verifySnapshotIntegrity(
    quote: QuoteSnapshot,
    historicalPriceMinor: number
  ): boolean {
    return quote.totalMinor === historicalPriceMinor;
  }
}
