import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import { OrderService } from '../src/domain/order-service';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { authenticateCredentials } from '../src/domain/auth-guard';
import { resetTestPostgresData } from '../src/testing/supabase-pglite-bridge';
import { POST as acceptPost } from '../src/app/api/orders/[id]/accept/route';
import { GET as deliverablesGet } from '../src/app/api/orders/[id]/deliverables/route';
import { DELETE as sessionDelete, GET as sessionGet } from '../src/app/api/auth/session/route';
import { approveAndDeliver, seedOrderInQaReview } from './helpers/delivery-fixtures';

const BASE = 'http://localhost:3000';

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function login(email: string, pass: string) {
  const auth = await authenticateCredentials(email, pass);
  if (!auth) throw new Error(`Login failed for ${email}`);
  return auth.token;
}

describe('Order State Machine & Customer Acceptance Protocol', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  describe('1. OrderService Preconditions & State Machine Invariants', () => {
    it('enforces preconditions on staff assignment', () => {
      const quote = calculateServerQuote({
        businessId: 'biz-sm-1',
        businessName: 'State Machine Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');

      // 1. Unpaid order cannot be assigned
      expect(() => OrderService.assignStaff(order, 'spec-1', 'Tanvir Ahmed')).toThrow(/unpaid/i);

      // Settle payment, but intake is still pending
      order.financialStatus = 'paid';
      expect(() => OrderService.assignStaff(order, 'spec-1', 'Tanvir Ahmed')).toThrow(/intake/i);

      // Complete intake and set status to ready_for_fulfillment
      order.intakeStatus = 'completed';
      order.status = 'ready_for_fulfillment';

      // 2. Can be assigned once paid & intake completed
      const assigned = OrderService.assignStaff(order, 'spec-1', 'Tanvir Ahmed');
      expect(assigned.assignedSpecialistId).toBe('spec-1');
      expect(assigned.assignedSpecialistName).toBe('Tanvir Ahmed');
      expect(assigned.status).toBe('in_progress');

      // 3. Cannot assign if order is already delivered or cancelled
      const deliveredOrder = { ...assigned, status: 'delivered' as const };
      expect(() => OrderService.assignStaff(deliveredOrder, 'spec-2', 'Tanvir Ahmed')).toThrow(/delivered/i);
    });

    it('enforces preconditions on QA submission', () => {
      const quote = calculateServerQuote({
        businessId: 'biz-sm-2',
        businessName: 'QA Machine Corp',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');

      // Unpaid
      expect(() => OrderService.submitForQA(order)).toThrow(/unpaid/i);

      order.financialStatus = 'paid';
      // Intake pending
      expect(() => OrderService.submitForQA(order)).toThrow(/intake/i);

      order.intakeStatus = 'completed';
      // Status not in_progress
      expect(() => OrderService.submitForQA(order)).toThrow(/in_progress/i);

      order.status = 'in_progress';
      // No specialist assigned
      expect(() => OrderService.submitForQA(order)).toThrow(/specialist/i);

      order.assignedSpecialistId = 'spec-qa';
      const submitted = OrderService.submitForQA(order);
      expect(submitted.status).toBe('qa_review');
    });

    it('enforces preconditions on delivery', () => {
      const quote = calculateServerQuote({
        businessId: 'biz-sm-3',
        businessName: 'Delivery Shield Ltd',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'in_progress';
      order.assignedSpecialistId = 'spec-1';

      // Cannot deliver directly from in_progress
      expect(() => OrderService.deliverOrder(order, { qaChecklistPassed: true })).toThrow(/qa_review/i);

      order.status = 'qa_review';
      // Cannot deliver if QA checklist failed or not passed
      expect(() => OrderService.deliverOrder(order, { qaChecklistPassed: false })).toThrow(/checklist/i);
      expect(() => OrderService.deliverOrder(order)).toThrow(/checklist/i);

      // Delivers successfully when QA checklist passed
      const delivered = OrderService.deliverOrder(order, { qaChecklistPassed: true });
      expect(delivered.status).toBe('delivered');
      expect(delivered.deliveredAt).toBeTruthy();
    });

    it('enforces preconditions on revisions and handover acceptance', () => {
      const quote = calculateServerQuote({
        businessId: 'biz-sm-4',
        businessName: 'Acceptance Ltd',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'in_progress';

      // Revision cannot be requested if not delivered
      expect(() => OrderService.requestRevision(order, 'Update banner color')).toThrow(/delivered/i);

      // Acceptance cannot happen if not delivered
      expect(() => OrderService.acceptHandover(order, 'user-1')).toThrow(/delivered/i);

      // Move to delivered
      order.status = 'delivered';
      order.deliveredAt = new Date().toISOString();

      // Revision moves it back to in_progress
      const underRevision = OrderService.requestRevision(order, 'Update banner color');
      expect(underRevision.status).toBe('in_progress');

      // Deliver again
      underRevision.status = 'delivered';
      const accepted = OrderService.acceptHandover(underRevision, '00000000-0000-4000-a000-000000000001');
      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedAt).toBeTruthy();
    });
  });

  describe('2. Customer Handover Acceptance API (POST /api/orders/[id]/accept)', () => {
    it('rejects cross-origin requests (CSRF protection)', async () => {
      const res = await acceptPost(
        req('/api/orders/ORD-TEST-1/accept', {
          method: 'POST',
          headers: { origin: 'https://evil.com' },
        }),
        { params: Promise.resolve({ id: 'ORD-TEST-1' }) }
      );
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await acceptPost(
        req('/api/orders/ORD-TEST-1/accept', { method: 'POST' }),
        { params: Promise.resolve({ id: 'ORD-TEST-1' }) }
      );
      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant acceptance with 403', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const bobToken = await login('bob@chittagongtraders.bd', 'CustomerB#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-alice-1',
        businessName: 'Alice Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'delivered';
      await persistentDB.saveOrder(order, order.organizationId);

      // Bob tries to accept Alice's order
      const bobRes = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(bobRes.status).toBe(403);
    });

    it('rejects acceptance if order is not yet delivered (422)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-alice-2',
        businessName: 'Alice Roasters 2',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'in_progress';
      await persistentDB.saveOrder(order, order.organizationId);

      const res = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toMatch(/must be delivered/i);
    });

    it('rejects acceptance if delivered without verified deliverables or files (422)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-alice-3',
        businessName: 'Alice Roasters 3',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'delivered';
      order.deliveredAt = new Date().toISOString();
      await persistentDB.saveOrder(order, order.organizationId);

      const res = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toMatch(/no verified deliverable exists/i);
    });

    it('successfully accepts delivered order with deliverables, records audit log, and is idempotent', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-alice-4',
        businessName: 'Alice Roasters 4',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      await seedOrderInQaReview(order, order.organizationId);
      // Real chain: staff deliverable bytes -> persisted approved QA review -> atomic delivery
      await approveAndDeliver(order.id, { title: 'Meta Business Manager Handover Pack' });

      // 1. Initial acceptance succeeds
      const res = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.order.status).toBe('accepted');
      expect(json.order.acceptedAt).toBeTruthy();

      // Verify in DB
      const dbOrder = await persistentDB.getOrder(order.id);
      expect(dbOrder?.status).toBe('accepted');
      expect(dbOrder?.acceptedAt).toBeTruthy();

      // Verify audit log
      const audit = await persistentDB.listAuditLogs();
      const acceptanceAudit = audit.find(
        (a) => a.action === 'ORDER_HANDOVER_ACCEPTED' && a.entityId === order.id
      );
      expect(acceptanceAudit).toBeTruthy();
      expect(acceptanceAudit?.actorUserId).toBe('00000000-0000-4000-a000-000000000001');

      // 2. Idempotent repeat: calling accept again returns 200 with alreadyAccepted
      const replayRes = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(replayRes.status).toBe(200);
      const replayJson = await replayRes.json();
      expect(replayJson.alreadyAccepted).toBe(true);
      expect(replayJson.order.status).toBe('accepted');
    });
  });

  describe('3. Deliverables API (GET /api/orders/[id]/deliverables)', () => {
    it('enforces tenant isolation and returns deliverables to owner and staff', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const bobToken = await login('bob@chittagongtraders.bd', 'CustomerB#2026!');
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-deliv-1',
        businessName: 'Deliverables Test Corp',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      await seedOrderInQaReview(order, order.organizationId);
      await approveAndDeliver(order.id, { title: 'Meta Setup Handover Pack', notes: 'All verified' });

      // 1. Unauthenticated -> 401
      const unauth = await deliverablesGet(
        req(`/api/orders/${order.id}/deliverables`),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(unauth.status).toBe(401);

      // 2. Cross-tenant Bob -> 403
      const bobRes = await deliverablesGet(
        req(`/api/orders/${order.id}/deliverables`, {
          headers: { authorization: `Bearer ${bobToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(bobRes.status).toBe(403);

      // 3. Owner Alice -> 200 with deliverables
      const aliceRes = await deliverablesGet(
        req(`/api/orders/${order.id}/deliverables`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(aliceRes.status).toBe(200);
      const aliceJson = await aliceRes.json();
      expect(aliceJson.deliverables.length).toBe(1);
      expect(aliceJson.deliverables[0].title).toBe('Meta Setup Handover Pack');

      // 4. Staff Admin -> 200 with deliverables
      const adminRes = await deliverablesGet(
        req(`/api/orders/${order.id}/deliverables`, {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(adminRes.status).toBe(200);
    });
  });

  describe('4. Session Logout & Token Revocation (DELETE /api/auth/session)', () => {
    it('revokes server-side session token upon logout', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');

      // Valid token retrieves session
      const getBefore = await sessionGet(
        req('/api/auth/session', { headers: { authorization: `Bearer ${aliceToken}` } })
      );
      expect(getBefore.status).toBe(200);
      const beforeJson = await getBefore.json();
      expect(beforeJson.authenticated).toBe(true);

      // Cross-origin DELETE is rejected (CSRF)
      const csrf = await sessionDelete(
        req('/api/auth/session', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}`, origin: 'https://evil.com' },
        })
      );
      expect(csrf.status).toBe(403);

      // Legitimate DELETE revokes session and clears cookies
      const logout = await sessionDelete(
        req('/api/auth/session', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      );
      expect(logout.status).toBe(200);

      // Token is now revoked: subsequent GET with the same token returns 401
      const getAfter = await sessionGet(
        req('/api/auth/session', { headers: { authorization: `Bearer ${aliceToken}` } })
      );
      expect(getAfter.status).toBe(401);

      // Audit log recorded
      const logs = await persistentDB.listAuditLogs();
      const logoutAudit = logs.find((l) => l.action === 'AUTH_LOGOUT_SUCCESS');
      expect(logoutAudit).toBeTruthy();
    });
  });
});
