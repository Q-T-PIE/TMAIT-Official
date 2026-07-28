import { useState } from "react";

const TEXT_SECTIONS = [
  ["location_summary", "1 — Location Summary"],
  ["event_type", "2 — Event / Works Type"],
  ["duration", "3 — Duration"],
  ["road_lane_closures", "4 — Road & Lane Closures"],
  ["detours", "5 — Detours"],
  ["safety_considerations", "8 — Safety Considerations"],
];

export default function PlanDocument({ plan, editable, onSave }) {
  const [draft, setDraft] = useState(null);
  const p = draft || plan;
  const startEdit = () => setDraft(JSON.parse(JSON.stringify(plan)));

  const save = () => { onSave(draft); setDraft(null); };

  const secTitle = (t) => (
    <h2 className="font-heading text-lg font-bold tracking-tight text-[#0A0A0A] mt-8 mb-2 flex items-center gap-2">
      <span className="w-1.5 h-5 bg-[#FF5F15] inline-block" />{t}
    </h2>
  );

  return (
    <div data-testid="plan-document" className="max-w-3xl">
      {editable && (
        <div className="flex gap-2 mb-4">
          {!draft ? (
            <button data-testid="edit-plan-button" onClick={startEdit}
              className="border border-black/20 text-[#0A0A0A] px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em] hover:border-[#FF5F15] transition-colors duration-150">
              Edit Plan
            </button>
          ) : (
            <>
              <button data-testid="save-plan-button" onClick={save}
                className="bg-[#10B981] text-white px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em] font-bold">Save Corrections</button>
              <button data-testid="cancel-edit-button" onClick={() => setDraft(null)}
                className="border border-black/20 px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.12em]">Cancel</button>
            </>
          )}
        </div>
      )}

      {TEXT_SECTIONS.map(([key, title]) => (
        <div key={key}>
          {secTitle(title)}
          {draft ? (
            <textarea data-testid={`edit-${key}`} className="w-full bg-white border border-black/15 p-3 text-sm rounded-sm font-body focus:outline-none focus:ring-1 focus:ring-[#FF5F15]"
              rows={3} value={p[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          ) : (
            <p className="text-sm leading-relaxed text-zinc-700 font-body whitespace-pre-line">{p[key] || "—"}</p>
          )}
        </div>
      ))}

      {secTitle("6 — Signage Schedule")}
      <div className="border border-black/15 rounded-sm overflow-hidden">
        <table className="w-full text-sm" data-testid="signage-table">
          <thead>
            <tr className="bg-[#0A0A0A] text-white font-mono text-[10px] uppercase tracking-[0.15em]">
              {["Sign", "Location", "Spacing", "Notes"].map((h) => <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(p.signage_schedule || []).map((s, i) => (
              <tr key={`${s.sign}-${s.location}-${i}`} className={i % 2 ? "bg-black/[0.02]" : "bg-white"}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#0A0A0A]">{s.sign}</td>
                <td className="px-3 py-2.5 text-zinc-700 font-body">{s.location}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.spacing_m}</td>
                <td className="px-3 py-2.5 text-zinc-600 font-body text-xs">{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {secTitle("7 — Step-by-Step Setup")}
      <ol className="space-y-2" data-testid="setup-steps">
        {(p.setup_steps || []).map((s, i) => (
          <li key={`step-${i}-${String(s).slice(0, 24)}`} className="flex gap-3 text-sm text-zinc-700 font-body leading-relaxed">
            <span className="font-mono text-xs font-bold text-[#FF5F15] mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>{s}
          </li>
        ))}
      </ol>

      {secTitle("9 — TMM 2020 Compliance Citations")}
      <div className="space-y-2" data-testid="tmm-citations">
        {(p.tmm_citations || []).map((c, i) => (
          <div key={`${c.section}-${i}`} className="border-l-2 border-[#FF5F15] bg-[#FF5F15]/[0.06] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] font-bold text-[#0A0A0A]">{c.section}</p>
            <p className="text-sm text-zinc-700 font-body mt-1 leading-relaxed">{c.requirement}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
