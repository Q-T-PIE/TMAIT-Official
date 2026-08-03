import { useEffect, useState } from "react";
import { X, Brain, CheckCircle, XCircle, PencilSimple } from "@phosphor-icons/react";
import api from "../lib/api";

const ACTION_META = {
  approve: { color: "#10B981", Icon: CheckCircle, label: "Approved" },
  reject: { color: "#EF4444", Icon: XCircle, label: "Rejected" },
  edit: { color: "#3B82F6", Icon: PencilSimple, label: "Corrected" },
};

export default function TrainingDashboard({ onClose }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/feedback").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  const counts = { approve: 0, reject: 0, edit: 0 };
  (items || []).forEach((f) => { if (counts[f.action] !== undefined) counts[f.action]++; });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" data-testid="training-modal">
      <div className="bg-[#121212] border border-white/15 rounded-sm w-full max-w-3xl max-h-[85vh] overflow-y-auto p-8 animate-rise">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF5F15] mb-1 flex items-center gap-1.5"><Brain size={12} /> Training Loop</p>
            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">ATOM Training Feedback</h2>
            <p className="text-xs text-zinc-400 font-body mt-1">Every approval, rejection and correction is stored here. The 3 most recent entries are injected into each new generation to steer ATOM.</p>
          </div>
          <button data-testid="training-close-button" onClick={onClose} className="text-zinc-500 hover:text-white p-1 transition-colors duration-150"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {Object.entries(ACTION_META).map(([k, m]) => (
            <div key={k} data-testid={`training-stat-${k}`} className="border border-white/10 rounded-sm px-4 py-3">
              <p className="font-mono text-2xl font-bold" style={{ color: m.color }}>{counts[k]}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2" data-testid="training-feedback-list">
          {items === null && <p className="text-sm text-zinc-500 font-body">Loading…</p>}
          {items?.length === 0 && <p className="text-sm text-zinc-500 font-body" data-testid="training-empty-state">No feedback yet — approve, reject or correct a plan to start training ATOM.</p>}
          {(items || []).map((f, i) => {
            const m = ACTION_META[f.action] || ACTION_META.edit;
            const recent = i < 3;
            return (
              <div key={f.id} data-testid={`training-entry-${f.id}`} className="border border-white/10 rounded-sm px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <m.Icon size={14} weight="fill" style={{ color: m.color }} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: m.color }}>{m.label}</span>
                    {recent && <span className="font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 border border-[#FF5F15]/60 text-[#FF5F15] rounded-sm">In active prompt</span>}
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">{f.reviewer} · {new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-white font-body font-medium">{f.job_title}</p>
                <p className="text-sm text-zinc-400 font-body leading-relaxed mt-0.5">{f.note}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
