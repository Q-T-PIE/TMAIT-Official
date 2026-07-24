import { useState } from "react";
import { Lightning, CheckCircle, XCircle, FilePdf, Cpu } from "@phosphor-icons/react";
import { StatusBadge } from "./StatusBadge";
import { useAuth } from "../context/AuthContext";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

export default function ActionsPanel({ job, onJobUpdated, generating, onGenerate }) {
  const { user } = useAuth();
  const [model, setModel] = useState("gpt-5.2");
  const [feedback, setFeedback] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const isReviewer = user.role === "reviewer" || user.role === "admin";

  const review = async (action) => {
    setReviewing(true);
    try {
      await api.post(`/jobs/${job.id}/review`, { action, feedback });
      toast.success(action === "approve" ? "Plan approved — feedback stored for ATOM training" : "Plan rejected — feedback stored for ATOM training");
      setFeedback("");
      onJobUpdated();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setReviewing(false);
    }
  };

  const exportPdf = async () => {
    try {
      const res = await api.get(`/jobs/${job.id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TMAIT_Plan_${job.title.slice(0, 30)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const label = "font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 block";

  return (
    <aside data-testid="actions-panel" className="w-80 flex-shrink-0 bg-[#0A0A0A] border-l border-white/10 h-full overflow-y-auto flex flex-col p-6 noise-overlay">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF5F15] mb-6">Actions</p>

      {!job ? (
        <p className="text-sm text-zinc-500 font-body" data-testid="actions-empty-state">Select a job or create a new request to see available actions.</p>
      ) : (
        <div className="space-y-7">
          <div>
            <span className={label}>Job Status</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={generating ? "generating" : job.status} testId="actions-status-badge" />
            </div>
            {job.reviewed_by && <p className="text-xs text-zinc-500 mt-2 font-body">Reviewed by {job.reviewed_by}</p>}
          </div>

          <div>
            <span className={label}><Cpu size={12} className="inline mr-1" />ATOM Engine</span>
            <select data-testid="model-select" value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full bg-black/50 border border-white/15 text-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-[#FF5F15] font-mono text-xs">
              <option value="gpt-5.2">GPT-5.2 (OpenAI)</option>
              <option value="claude-fable-5">Claude Fable 5 (Anthropic)</option>
            </select>
            <button data-testid="generate-plan-button" disabled={generating} onClick={() => onGenerate(model)}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-[#FF5F15] text-black font-heading font-bold py-3.5 rounded-sm text-sm uppercase tracking-wide hover:bg-[#ff7538] transition-colors duration-150 disabled:opacity-50 glow-orange">
              <Lightning weight="fill" size={16} />
              {generating ? "ATOM is working…" : job.plan ? "Regenerate Plan" : "Generate Plan"}
            </button>
            {generating && (
              <p className="text-[11px] text-zinc-400 mt-2 font-body leading-relaxed animate-pulse">
                Retrieving TMM 2020 sections, grounding requirements, drafting plan + diagram. This can take up to 2 minutes…
              </p>
            )}
          </div>

          {job.plan && isReviewer && job.status !== "approved" && (
            <div>
              <span className={label}>Review Decision</span>
              <textarea data-testid="review-feedback-input" value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder="Reviewer feedback — stored as ATOM training data"
                rows={3} className="w-full bg-black/50 border border-white/15 text-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-[#FF5F15] font-body placeholder:text-zinc-600" />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button data-testid="approve-button" disabled={reviewing} onClick={() => review("approve")}
                  className="flex items-center justify-center gap-1.5 bg-[#10B981] text-black font-heading font-bold py-3 rounded-sm text-xs uppercase tracking-wide hover:bg-[#34d399] transition-colors duration-150 disabled:opacity-50">
                  <CheckCircle weight="fill" size={15} /> Approve
                </button>
                <button data-testid="reject-button" disabled={reviewing} onClick={() => review("reject")}
                  className="flex items-center justify-center gap-1.5 bg-transparent border border-[#EF4444] text-[#EF4444] font-heading font-bold py-3 rounded-sm text-xs uppercase tracking-wide hover:bg-[#EF4444]/10 transition-colors duration-150 disabled:opacity-50">
                  <XCircle weight="fill" size={15} /> Reject
                </button>
              </div>
            </div>
          )}

          {job.plan && (
            <div>
              <span className={label}>Export</span>
              <button data-testid="export-pdf-button" onClick={exportPdf}
                className="w-full flex items-center justify-center gap-2 border border-white/20 text-white py-3 rounded-sm text-xs font-mono uppercase tracking-[0.12em] hover:border-[#FF5F15] transition-colors duration-150">
                <FilePdf size={15} /> Download Plan PDF
              </button>
            </div>
          )}

          {job.review_feedback && (
            <div>
              <span className={label}>Reviewer Feedback</span>
              <p data-testid="review-feedback-display" className="text-sm text-zinc-300 font-body leading-relaxed border-l-2 border-[#FF5F15] pl-3">{job.review_feedback}</p>
            </div>
          )}

          {job.sources?.length > 0 && (
            <div>
              <span className={label}>Grounding Sources (RAG)</span>
              <div className="space-y-1.5" data-testid="rag-sources">
                {job.sources.slice(0, 6).map((s, i) => (
                  <p key={i} className="font-mono text-[10px] text-zinc-400 leading-relaxed">
                    <span className="text-[#FF5F15]">›</span> {s.doc_title.replace(" (BC MoTI)", "")} · p.{s.page}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-4">
            <span className={label}>Request Details</span>
            <dl className="space-y-1.5 text-xs font-body">
              {[["Works", job.works_type], ["Road", job.road_type], ["Lanes", `${job.lanes_closed}/${job.lanes_total} closed`], ["Speed", `${job.speed_limit} km/h`], ["Volume", job.traffic_volume], ["Duration", job.duration || "TBD"], ["Client", job.client_name]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-200 text-right font-mono text-[11px]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </aside>
  );
}
