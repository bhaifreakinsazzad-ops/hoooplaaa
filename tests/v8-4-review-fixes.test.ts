import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import { OrderService } from '../src/domain/order-service';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { authenticateCredentials } from '../src/domain/auth-guard';
import {
  IntakeAndFileManager,
  MAX_FILE_SIZE_BYTES,
  inspectSvg,
  maxUploadRequestBytes,
  validateFileName,
} from '../src/domain/intake-and-files';
import { resetTestPostgresData } from '../src/testing/supabase-pglite-bridge';
import { POST as intakePost } from '../src/app/api/orders/[id]/intake/route';
import { POST as acceptPost } from '../src/app/api/orders/[id]/accept/route';
import { Order } from '../src/domain/types';
import { CUSTOMER_A_ID, approveAndDeliver, seedOrderInQaReview, uploadStaffDeliverable } from './helpers/delivery-fixtures';

/** V8.4 — regression tests for the findings of the d9013ef..b8a3c84 code review. LOCAL ONLY (PGlite). */

const BASE = 'http://localhost:3000';
const ORG_A = '10000000-0000-4000-a000-000000000001';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function aliceToken() {
  const auth = await authenticateCredentials('alice@dhakaheritage.bd', 'CustomerA#2026!');
  if (!auth) throw new Error('login failed');
  return auth.token;
}

function newOrder(name: string): Order {
  const quote = calculateServerQuote({
    businessId: `biz-${name}`,
    businessName: name,
    businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
    selectedPlatformSkus: ['HI-SET-META'],
    selectedAddonSkus: [],
  });
  const order = OrderService.createOrderFromQuote(quote, CUSTOMER_A_ID);
  order.organizationId = ORG_A;
  return order;
}

describe('V8.4 review fixes', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  it('1. intake can be edited after fulfilment started without moving the order back or restarting the SLA', async () => {
    const alice = await aliceToken();
    const order = newOrder('Intake Edit');
    await seedOrderInQaReview(order);
    const before = (await persistentDB.getOrder(order.id))!;

    const res = await intakePost(
      req(`/api/orders/${order.id}/intake`, {
        method: 'POST',
        headers: { authorization: `Bearer ${alice}` },
        body: { businessName: 'Intake Edit', targetAudience: 'Updated audience', contactWhatsApp: '01711111111' },
      }),
      ctx(order.id)
    );
    expect(res.status).toBe(200);
    const after = (await persistentDB.getOrder(order.id))!;
    expect(after.status).toBe('qa_review');
    expect(after.slaStartedAt).toBe(before.slaStartedAt);
    expect(after.rowVersion).toBe(before.rowVersion); // no order write at all
    expect((await persistentDB.getIntake(order.id))?.targetAudience).toBe('Updated audience');
  });

  it('1b. completeIntake is idempotent and only advances from awaiting_requirements', () => {
    const o = newOrder('Pure');
    o.financialStatus = 'paid';
    o.status = 'in_progress';
    const once = OrderService.completeIntake(o);
    expect(once.status).toBe('in_progress');
    expect(once.slaStartedAt).toBeUndefined();
    expect(OrderService.completeIntake(once)).toBe(once);

    const waiting = { ...newOrder('Waiting'), financialStatus: 'paid' as const, status: 'awaiting_requirements' as const };
    const started = OrderService.completeIntake(waiting);
    expect(started.status).toBe('ready_for_fulfillment');
    expect(started.slaStartedAt).toBeTruthy();
  });

  it('2. a repeated acceptance writes nothing and adds no second audit entry', async () => {
    const alice = await aliceToken();
    const order = newOrder('Accept Once');
    await seedOrderInQaReview(order);
    await approveAndDeliver(order.id);
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        acceptPost(req(`/api/orders/${order.id}/accept`, { method: 'POST', headers: { authorization: `Bearer ${alice}` } }), ctx(order.id))
      )
    );
    for (const r of results) expect(r.status).toBe(200);
    const accepted = (await persistentDB.listAuditLogs()).filter(
      (l) => l.action === 'ORDER_HANDOVER_ACCEPTED' && l.entityId === order.id
    );
    expect(accepted.length).toBe(1);
    const final = (await persistentDB.getOrder(order.id))!;
    const versionAfter = final.rowVersion;
    const again = await acceptPost(
      req(`/api/orders/${order.id}/accept`, { method: 'POST', headers: { authorization: `Bearer ${alice}` } }),
      ctx(order.id)
    );
    expect((await again.json()).alreadyAccepted).toBe(true);
    expect((await persistentDB.getOrder(order.id))!.rowVersion).toBe(versionAfter);
  });

  it('3. design-tool SVGs with <style> and "metadata:" text are accepted; scriptable CSS is still rejected', () => {
    const illustrator =
      '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><style>.cls-1{fill:#071525;}</style></defs><title>metadata: brand logo</title><rect class="cls-1" width="10" height="10"/></svg>';
    expect(inspectSvg(Buffer.from(illustrator)).isValid).toBe(true);
    for (const bad of [
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{background:url(https://x.example/a.png)}</style></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{width:expression(alert(1))}</style></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{background:url(javascript:alert(1))}</style></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(data:image/png;base64,AAAA)"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href = "javascript:alert(1)"><text>x</text></a></svg>',
    ]) {
      expect(inspectSvg(Buffer.from(bad)).isValid, bad).toBe(false);
    }
  });

  it('4. file names with ".." inside are allowed; separators and bare dot names are not', () => {
    expect(validateFileName('brand-guide..final.pdf')).toBeNull();
    expect(validateFileName('logo v1..2.png')).toBeNull();
    expect(validateFileName('..')).not.toBeNull();
    expect(validateFileName('../x.png')).not.toBeNull();
    expect(validateFileName('a\\b.png')).not.toBeNull();
    expect(IntakeAndFileManager.validateUpload('brand..final.pdf', 10, 'application/pdf').isValid).toBe(true);
  });

  it('5. getOrder refuses identifiers that could inject PostgREST filter terms', async () => {
    const order = newOrder('Filter Injection');
    await persistentDB.saveOrder(order, ORG_A);
    expect(await persistentDB.getOrder(order.id)).toBeTruthy();
    for (const evil of [`x,order_code.neq.null`, `x)`, `${order.id},id.not.is.null`, 'a.b', '']) {
      expect(await persistentDB.getOrder(evil)).toBeUndefined();
    }
  });

  it('6. JSON (base64) uploads get a request limit that fits a full-size file', () => {
    const fullSizeBase64Body = Math.ceil((MAX_FILE_SIZE_BYTES * 4) / 3) + 200;
    expect(fullSizeBase64Body).toBeLessThanOrEqual(maxUploadRequestBytes('application/json'));
    expect(maxUploadRequestBytes('multipart/form-data; boundary=x')).toBeLessThan(maxUploadRequestBytes('application/json'));
    expect(MAX_FILE_SIZE_BYTES + 2 * 1024 * 1024).toBeGreaterThan(maxUploadRequestBytes('multipart/form-data'));
  });

  it('7. an oversized stored object is refused from metadata, before its bytes are downloaded', async () => {
    const order = newOrder('Oversized Object');
    await seedOrderInQaReview(order);
    const file = await uploadStaffDeliverable(order.id);
    const huge = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
    await persistentDB.getSupabaseAdminClient().storage.from('order-assets').upload(file.storagePath, huge, { upsert: true });

    const proto = Object.getPrototypeOf(persistentDB.getSupabaseAdminClient().storage.from('order-assets'));
    const downloadSpy = vi.spyOn(proto, 'download');
    try {
      const read = await persistentDB.readVerifiedFile(file);
      expect(read.status).toBe('oversized');
      expect(downloadSpy).not.toHaveBeenCalled();
    } finally {
      downloadSpy.mockRestore();
    }
  });
});
