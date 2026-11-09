'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QA_CHECKLIST_ITEMS } from '@/domain/qa-checklist';

interface StaffFile {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
}
interface QaReview {
  id: string;
  fileId: string;
  decision: 'approved' | 'rejected';
  reviewerRole: string;
  createdAt: string;
  notes: string;
}

/**
 * Staff-only QA & delivery workflow for one order in 'qa_review':
 * upload a deliverable file -> record a persisted QA review (every checklist item explicit) -> deliver
 * referencing that exact review. The server and database re-verify ownership, checksum and approval.
 */
export default function QaDeliveryPanel({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const [files, setFiles] = useState<StaffFile[]>([]);
  const [reviews, setReviews] = useState<QaReview[]>([]);
  const [fileId, setFileId] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/deliverables`);
    if (!res.ok) return;
    const data = await res.json();
    setFiles(data.files || []);
    setReviews(data.qaReviews || []);
    if (!fileId && data.files?.[0]) setFileId(data.files[0].id);
  }, [orderId, fileId]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setMessage(data.message || 'Done.');
      await load();
      onChanged();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadDeliverable = async () => {
    if (!upload) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', upload);
      form.append('category', 'deliverable');
      const res = await fetch(`/api/orders/${orderId}/files`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setUpload(null);
      setFileId(data.file.id);
      await load();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const latest = reviews[0];
  const canDeliver = latest && latest.decision === 'approved' && latest.fileId === fileId;
  const allChecked = QA_CHECKLIST_ITEMS.every((i) => checklist[i.key] === true);

  return (
    <div className="mt-2 p-3 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3 text-xs" data-testid={`qa-panel-${orderId}`}>
      <div className="font-bold text-purple-900">QA review &amp; delivery</div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf,.zip,.png,.jpg,.jpeg,.webp"
          onChange={(e) => setUpload(e.target.files?.[0] || null)}
          className="text-[11px]"
          data-testid="qa-deliverable-input"
        />
        <button
          type="button"
          disabled={!upload || busy}
          onClick={uploadDeliverable}
          className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold disabled:opacity-50"
        >
          Upload deliverable
        </button>
      </div>

      {files.length > 0 ? (
        <select
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
          data-testid="qa-file-select"
        >
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.fileName} · {(f.fileSizeBytes / 1024).toFixed(0)} KB · sha256 {f.sha256Hash.slice(0, 12)}…
            </option>
          ))}
        </select>
      ) : (
        <p className="text-slate-500">No deliverable file uploaded yet.</p>
      )}

      <fieldset className="space-y-1">
        {QA_CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={checklist[item.key] === true}
              onChange={(e) => setChecklist((c) => ({ ...c, [item.key]: e.target.checked }))}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Reviewer notes (required when rejecting)"
        className="w-full px-2 py-1 rounded border border-slate-300"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !fileId || !allChecked}
          onClick={() => call({ action: 'qa_review', decision: 'approved', deliverableFileId: fileId, checklist, notes })}
          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold disabled:opacity-50"
        >
          Record QA approval
        </button>
        <button
          type="button"
          disabled={busy || !fileId || notes.trim().length === 0}
          onClick={() => call({ action: 'qa_review', decision: 'rejected', deliverableFileId: fileId, checklist, notes })}
          className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold disabled:opacity-50"
        >
          Reject (back to fulfilment)
        </button>
        <button
          type="button"
          disabled={busy || !canDeliver}
          onClick={() => call({ action: 'deliver', deliverableFileId: fileId, qaReviewId: latest?.id, verificationNotes: latest?.notes })}
          className="px-2.5 py-1 rounded bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold disabled:opacity-50 ml-auto"
          data-testid="qa-deliver-btn"
        >
          Deliver with recorded QA approval
        </button>
      </div>

      {latest && (
        <p className="text-[11px] text-slate-600">
          Latest review: <strong>{latest.decision}</strong> by {latest.reviewerRole} at{' '}
          {new Date(latest.createdAt).toLocaleString()}
        </p>
      )}
      {message && <p className="text-[11px] font-semibold text-slate-800">{message}</p>}
    </div>
  );
}
