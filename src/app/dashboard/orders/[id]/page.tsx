'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order, IntakeSubmission, FileAttachment } from '@/domain/types';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Send,
  Loader2,
  Check,
  Lock,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export default function OrderWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [intake, setIntake] = useState<IntakeSubmission | null>(null);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'intake' | 'files' | 'deliverables'>('timeline');

  // Intake Form State
  const [audience, setAudience] = useState('');
  const [brandColors, setBrandColors] = useState('');
  const [contactWhatsApp, setContactWhatsApp] = useState('');
  const [existingPages, setExistingPages] = useState('');
  const [partnerInviteStatus, setPartnerInviteStatus] = useState<IntakeSubmission['partnerInviteStatus']>('pending_instructions');
  const [clientNotes, setClientNotes] = useState('');
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [intakeSuccessMsg, setIntakeSuccessMsg] = useState<string | null>(null);

  // File Upload State
  const [mockFileName, setMockFileName] = useState('');
  const [mockFileType, setMockFileType] = useState('image/png');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [orderRes, intakeRes, filesRes] = await Promise.all([
        fetch(`/api/checkout/initiate?id=${orderId}`),
        fetch(`/api/orders/${orderId}/intake`),
        fetch(`/api/orders/${orderId}/files`),
      ]);

      if (orderRes.status === 401 || orderRes.status === 403) {
        const errBody = await orderRes.json();
        setAccessDeniedError(`HTTP ${orderRes.status}: ${errBody.error || 'Access denied.'}`);
        return;
      }

      setAccessDeniedError(null);
      const orderData = await orderRes.json();
      const intakeData = await intakeRes.json();
      const filesData = await filesRes.json();

      if (orderRes.ok && orderData.order) {
        setOrder(orderData.order);
      }
      if (intakeRes.ok && intakeData.intake) {
        setIntake(intakeData.intake);
        setAudience(intakeData.intake.targetAudience || '');
        setBrandColors(intakeData.intake.brandColors || '');
        setContactWhatsApp(intakeData.intake.contactWhatsApp || '');
        setPartnerInviteStatus(intakeData.intake.partnerInviteStatus);
      }
      if (filesRes.ok && filesData.files) {
        setFiles(filesData.files);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orderId]);

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingIntake(true);
    setIntakeSuccessMsg(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: order?.quoteSnapshot.businessName || 'My Business',
          contactEmail: 'client@example.com',
          contactWhatsApp,
          targetAudience: audience,
          brandColors,
          existingPageLinks: existingPages,
          partnerInviteStatus,
          notes: clientNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit intake.');

      setIntakeSuccessMsg('Intake submitted successfully! Fulfillment readiness confirmed.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error submitting intake.');
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleSimulateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockFileName.trim()) return;

    setUploadingFile(true);
    setUploadError(null);

    try {
      // Real 1x1 PNG binary payload in base64 for private vault storage
      const validPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await fetch(`/api/orders/${orderId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: mockFileName,
          mimeType: mockFileType,
          fileContentBase64: validPngBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setMockFileName('');
      loadData();
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file.');
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-hoooplaaa-gold-500" />
        <p className="text-xs text-slate-500">Loading Client Order Workspace...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4" data-testid="order-access-error">
        <p className="text-xs font-bold text-red-600">{accessDeniedError || 'Order not found.'}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-slate-900 text-white rounded text-xs">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isPaid = order.financialStatus === 'paid';
  const isIntakeComplete = order.intakeStatus === 'completed';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
              {order.orderNumber}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {order.financialStatus.replace('_', ' ')}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Workflow: {order.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">Total Package Value</span>
            <span className="text-2xl font-black text-slate-900">
              ৳{(order.totalMinor / 100).toLocaleString('en-US')} BDT
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {order.quoteSnapshot.businessName} — Setup Workspace
            </h1>
            <p className="text-xs text-slate-500">
              Service Items: {order.items.map((i) => i.name).join(' + ')}
            </p>
          </div>

          {/* SLA Clock Box */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-3">
            <Clock className="w-4 h-4 text-hoooplaaa-gold-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">
                {order.slaStartedAt ? 'SLA Fulfillment Clock Active' : 'SLA Clock Not Started'}
              </div>
              <div className="text-[11px] text-slate-500">
                {order.slaStartedAt
                  ? `Started: ${new Date(order.slaStartedAt).toLocaleDateString()} • Target: ${order.items[0]?.scopeSnapshot.deliveryTarget || '2-4 days'}`
                  : 'Requires both verified payment AND completed intake to start.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'timeline'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Order Lifecycle Timeline
        </button>
        <button
          onClick={() => setActiveTab('intake')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'intake'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Onboarding Intake</span>
          {isIntakeComplete ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'files'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Private Files & Assets</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {files.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('deliverables')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'deliverables'
              ? 'border-hoooplaaa-gold-500 text-hoooplaaa-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Deliverables & QA Handover
        </button>
      </div>

      {/* TAB CONTENT: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <h2 className="text-base font-bold text-slate-900">Live Delivery Milestones</h2>
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
            {/* Step 1: Payment */}
            <div className="relative flex items-start gap-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                  isPaid ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
              >
                {isPaid ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900">
                  {isPaid ? 'Payment Verified & Reconciled' : 'Payment Under Review'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {isPaid
                    ? 'Funds verified against gateway statement.'
                    : 'Awaiting finance statement reconciliation.'}
                </p>
              </div>
            </div>

            {/* Step 2: Intake */}
            <div className="relative flex items-start gap-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                  isIntakeComplete ? 'bg-emerald-600' : 'bg-slate-400'
                }`}
              >
                {isIntakeComplete ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900">
                  Onboarding Requirements & Delegated Access
                </div>
                <p className="text-[11px] text-slate-500">
                  {isIntakeComplete
                    ? 'Client requirements submitted. Fulfillment team unblocked.'
                    : 'Pending client submission. Go to Onboarding Intake tab.'}
                </p>
              </div>
            </div>

            {/* Step 3: Fulfillment */}
            <div className="relative flex items-start gap-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                  order.status === 'in_progress' || order.status === 'qa_review' || order.status === 'delivered' || order.status === 'accepted'
                    ? 'bg-blue-600'
                    : 'bg-slate-300'
                }`}
              >
                3
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900">Specialist Setup & Configuration</div>
                <p className="text-[11px] text-slate-500">
                  Specialist: {order.assignedSpecialistName || 'Pending Assignment'}
                </p>
              </div>
            </div>

            {/* Step 4: QA & Handover */}
            <div className="relative flex items-start gap-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                  order.status === 'delivered' || order.status === 'accepted'
                    ? 'bg-emerald-600'
                    : 'bg-slate-300'
                }`}
              >
                4
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900">Quality Assurance & Handover</div>
                <p className="text-[11px] text-slate-500">
                  Includes admin role verification and post-sale detailed audit report.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: INTAKE */}
      {activeTab === 'intake' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Client Onboarding Intake</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Please provide your brand identity details and partner delegation status.
              </p>
            </div>
            {isIntakeComplete && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Intake Completed
              </span>
            )}
          </div>

          {/* Zero Password Alert Banner */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Strict Zero-Password Intake Policy</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Never share your personal Facebook, Google, or LinkedIn passwords. Setup is conducted
              via official business partner invitations or screen walkthroughs.
            </p>
          </div>

          {intakeSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
              {intakeSuccessMsg}
            </div>
          )}

          <form onSubmit={handleIntakeSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary WhatsApp Number (For notifications & handover) *
                </label>
                <input
                  type="tel"
                  value={contactWhatsApp}
                  onChange={(e) => setContactWhatsApp(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand Colors / Hex Codes (Optional)
                </label>
                <input
                  type="text"
                  value={brandColors}
                  onChange={(e) => setBrandColors(e.target.value)}
                  placeholder="e.g. Navy Blue #071525, Gold #D9B45E"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Audience & Customer Profile *
              </label>
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                rows={2}
                placeholder="e.g. Bangladeshi urban homeowners aged 25-45 looking for premium interior decor..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing Page / Profile URLs (If any)
              </label>
              <textarea
                value={existingPages}
                onChange={(e) => setExistingPages(e.target.value)}
                rows={2}
                placeholder="https://facebook.com/mybrand, https://linkedin.com/company/mybrand"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delegated Partner Access Status *
              </label>
              <select
                value={partnerInviteStatus}
                onChange={(e) => setPartnerInviteStatus(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 bg-white"
              >
                <option value="pending_instructions">
                  Please send me partner delegation instructions via email
                </option>
                <option value="invitation_sent">
                  I have sent partner invitations to Hoooplaaa agency ID
                </option>
                <option value="not_applicable">Starting from scratch (New portfolio creation)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingIntake}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
            >
              {submittingIntake ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Intake Requirements</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT: FILES */}
      {activeTab === 'files' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Private Client Asset Vault</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely upload logo, cover graphics, product imagery, and trade documentation (max 25MB).
            </p>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              {uploadError}
            </div>
          )}

          {/* Upload Simulation Form */}
          <form
            onSubmit={handleSimulateUpload}
            className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Upload className="w-4 h-4 text-hoooplaaa-gold-600" />
              <span>Upload New Asset</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={mockFileName}
                  onChange={(e) => setMockFileName(e.target.value)}
                  placeholder="e.g. brand_logo_highres.png, business_cover.svg"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 bg-white"
                  required
                />
              </div>

              <div>
                <select
                  value={mockFileType}
                  onChange={(e) => setMockFileType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 bg-white"
                >
                  <option value="image/png">PNG Image</option>
                  <option value="image/jpeg">JPEG Image</option>
                  <option value="image/svg+xml">SVG Vector</option>
                  <option value="application/pdf">PDF Document</option>
                  <option value="application/zip">ZIP Archive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                Permitted: PNG, JPG, SVG, PDF, ZIP. Executables strictly rejected.
              </span>
              <button
                type="submit"
                disabled={uploadingFile}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                {uploadingFile ? 'Uploading...' : 'Save Asset to Order'}
              </button>
            </div>
          </form>

          {/* Uploaded Files Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 flex justify-between">
              <span>File Name & Path</span>
              <span>Size & Status</span>
            </div>
            {files.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No files uploaded yet. Add your brand assets above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {files.map((f) => (
                  <div key={f.id} className="p-3.5 flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{f.fileName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{f.storagePath}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500">
                        {(f.fileSizeBytes / 1024).toFixed(0)} KB
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold ml-2">
                        Private / Verified
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: DELIVERABLES */}
      {activeTab === 'deliverables' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Deliverables & Handover Protocol</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review completed setup assets, QA certificate, and accept handover.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Handover Inclusions</span>
            </div>
            <ul className="space-y-1.5 text-slate-600">
              <li>• Meta Business Portfolio with verified Primary Administrator rights</li>
              <li>• Google Business Profile management link and verification checklist</li>
              <li>• LinkedIn Corporate Company Page with super-admin transfer</li>
              <li>• Brand consistency audit report across all 3 channels</li>
            </ul>
          </div>

          {/* Complimentary Post-Sale Audit Box */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-hoooplaaa-navy-950 to-hoooplaaa-navy-900 text-white space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-hoooplaaa-gold-400">
              <Sparkles className="w-4 h-4" />
              <span>Complimentary Post-Sale Detailed Audit Included</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              As part of your setup, our senior strategist will deliver a post-setup audit report
              diagnosing audience gaps, next-step campaign readiness, and pixel event hygiene.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
