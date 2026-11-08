'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import { Order, AuditRequest, Service } from '@/domain/types';
import {
  ShieldCheck,
  Layers,
  CreditCard,
  FileSearch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Check,
  X,
  ExternalLink,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'finance' | 'catalog' | 'audits'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [catalog, setCatalog] = useState<Service[]>(CANONICAL_SERVICES);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<{ status: number; message: string } | null>(null);

  // Specialist assignment state
  const [selectedSpecialist, setSelectedSpecialist] = useState('Senior Growth Specialist');

  const loadAdminData = async () => {
    try {
      const [ordersRes, auditsRes] = await Promise.all([
        fetch('/api/admin/orders'),
        fetch('/api/audit'),
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) {
        const errData = await ordersRes.json();
        setAuthError({
          status: ordersRes.status,
          message: errData.error || 'Staff authorization required.',
        });
        return;
      }

      setAuthError(null);
      const ordersData = await ordersRes.json();
      const auditsData = await auditsRes.json();

      if (ordersData.orders) setOrders(ordersData.orders);
      if (auditsData.audits) setAudits(auditsData.audits);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleOrderAction = async (orderId: string, action: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action,
          specialistId: 'staff_specialist_01',
          specialistName: selectedSpecialist,
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadAdminData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinanceVerify = async (orderId: string, approved: boolean) => {
    try {
      const res = await fetch('/api/admin/finance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          approved,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadAdminData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (authError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4" data-testid="admin-auth-barrier">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">
          HTTP {authError.status} — Staff Authorization Required
        </h1>
        <p className="text-xs text-slate-600">{authError.message}</p>
        <Link
          href="/login?redirect=/admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          Sign In as Authorized Staff
        </Link>
      </div>
    );
  }

  const pendingFinanceOrders = orders.filter((o) => o.financialStatus === 'pending_verification');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Admin Header */}
      <div className="bg-hoooplaaa-navy-950 text-white rounded-3xl p-6 sm:p-8 border border-hoooplaaa-navy-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider">
                Staff Control Center
              </span>
              <span className="text-xs text-slate-400 font-mono">Role: Super Admin</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              HOOOPLAAA Operations & Catalog Governance
            </h1>
          </div>

          <button
            onClick={loadAdminData}
            className="px-3.5 py-2 rounded-xl bg-hoooplaaa-navy-800 hover:bg-hoooplaaa-navy-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-hoooplaaa-navy-800 text-xs text-slate-300">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Orders:</span>
            <span className="text-xl font-bold text-white">{orders.length}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Pending Finance Review:</span>
            <span className="text-xl font-bold text-amber-400">{pendingFinanceOrders.length}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Pre-Sale Audits:</span>
            <span className="text-xl font-bold text-blue-400">{audits.length}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Published Catalog SKUs:</span>
            <span className="text-xl font-bold text-emerald-400">
              {catalog.filter((s) => s.publicationStatus === 'published').length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Fulfillment Kanban ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'finance'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Finance Verification ({pendingFinanceOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'catalog'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Catalog Governance & Prices ({catalog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'audits'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          <span>Audit Triage Queue ({audits.length})</span>
        </button>
      </div>

      {/* TAB 1: ORDERS & FULFILLMENT */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Order Fulfillment Queue</h2>
              <p className="text-xs text-slate-500">
                Manage team assignments, QA reviews, and delivery handover triggers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Assign to:</span>
              <select
                value={selectedSpecialist}
                onChange={(e) => setSelectedSpecialist(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
              >
                <option value="Senior Growth Specialist">Senior Growth Specialist</option>
                <option value="Meta Infrastructure Lead">Meta Infrastructure Lead</option>
                <option value="Google Profile Specialist">Google Profile Specialist</option>
              </select>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No orders placed yet. Place an order through the configurator to test fulfillment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((ord) => {
                const isPaid = ord.financialStatus === 'paid';
                return (
                  <div key={ord.id} className="p-4 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {ord.orderNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.financialStatus}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 capitalize">
                          Status: {ord.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-900">
                        ৳{(ord.totalMinor / 100).toLocaleString('en-US')} BDT
                      </div>
                    </div>

                    <div className="text-xs text-slate-600">
                      <strong>Business:</strong> {ord.quoteSnapshot.businessName} •{' '}
                      <strong>Items:</strong> {ord.items.map((i) => i.name).join(' + ')}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Assigned: {ord.assignedSpecialistName || 'Unassigned'}</span>
                      <span>•</span>
                      <span>
                        SLA Clock:{' '}
                        {ord.slaStartedAt
                          ? `Active (${new Date(ord.slaStartedAt).toLocaleTimeString()})`
                          : 'Not started'}
                      </span>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOrderAction(ord.id, 'assign_staff')}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
                      >
                        Assign Specialist
                      </button>

                      <button
                        onClick={() => handleOrderAction(ord.id, 'submit_qa')}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold"
                      >
                        Submit for QA Review
                      </button>

                      <button
                        onClick={() => handleOrderAction(ord.id, 'deliver')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                      >
                        Deliver & Post Handover
                      </button>

                      <Link
                        href={`/dashboard/orders/${ord.id}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 ml-auto"
                      >
                        Inspect Workspace
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FINANCE VERIFICATION */}
      {activeTab === 'finance' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
          <div className="p-4 sm:p-6 border-b border-slate-100">
            <h2 className="font-bold text-sm text-slate-900">
              Manual MFS & Bank Transfer Verification
            </h2>
            <p className="text-xs text-slate-500">
              Strict policy: Orders submitted via manual bKash/Nagad must be verified against bank
              statements before marking as Paid.
            </p>
          </div>

          {pendingFinanceOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No pending manual payments. All received payments are reconciled.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingFinanceOrders.map((ord) => (
                <div key={ord.id} className="p-4 sm:p-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {ord.orderNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                          Awaiting Finance
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        Business: <strong>{ord.quoteSnapshot.businessName}</strong>
                      </div>
                      <div className="text-xs text-slate-500">
                        Customer Email: {ord.customerUserId}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">
                        ৳{(ord.totalMinor / 100).toLocaleString('en-US')} BDT
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <strong>Instructions:</strong> Check merchant bank/MFS SMS records for invoice
                    amount ৳{(ord.totalMinor / 100).toLocaleString('en-US')}.
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleFinanceVerify(ord.id, true)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify Funds & Mark as Paid</span>
                    </button>

                    <button
                      onClick={() => handleFinanceVerify(ord.id, false)}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Reference</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATALOG GOVERNANCE */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
          <div className="p-4 sm:p-6 border-b border-slate-100">
            <h2 className="font-bold text-sm text-slate-900">
              Service Catalog & SKU Governance (Source Precedence Enforced)
            </h2>
            <p className="text-xs text-slate-500">
              Only SKUs with checkout_enabled=true and publicationStatus=published are purchasable
              by clients. Proposed SaaS items remain internal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Service Name</th>
                  <th className="p-3">Price (BDT)</th>
                  <th className="p-3">Billing</th>
                  <th className="p-3">Publication Status</th>
                  <th className="p-3">Checkout Enabled</th>
                  <th className="p-3">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalog.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-semibold">{srv.sku}</td>
                    <td className="p-3 font-semibold text-slate-900">{srv.name}</td>
                    <td className="p-3 font-mono font-bold">
                      ৳{(srv.basePriceMinor / 100).toLocaleString('en-US')}
                    </td>
                    <td className="p-3 capitalize">{srv.billingPeriod}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          srv.publicationStatus === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {srv.publicationStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      {srv.checkoutEnabled ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Enabled</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {srv.provenance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRIAGE QUEUE */}
      {activeTab === 'audits' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
          <div className="p-4 sm:p-6 border-b border-slate-100">
            <h2 className="font-bold text-sm text-slate-900">
              Pre-Sale Initial Readiness Audit Triage
            </h2>
            <p className="text-xs text-slate-500">
              Inspect applicant business URLs for social and SEO hygiene. Zero fabricated analytics.
            </p>
          </div>

          {audits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No audit requests submitted yet. Apply through /audit to test triage flow.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {audits.map((aud) => (
                <div key={aud.id} className="p-4 sm:p-6 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700">{aud.id}</span>
                      <h3 className="text-sm font-bold text-slate-900">{aud.businessName}</h3>
                      <div className="text-xs text-slate-500 font-mono">
                        Target: {aud.websiteOrPageUrl}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                      {aud.stage}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    <strong>Primary Goal:</strong> {aud.primaryGoal}
                  </p>
                  <p className="text-xs text-slate-500">
                    <strong>Contact:</strong> {aud.contactEmail} • {aud.contactPhone || 'No phone'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
