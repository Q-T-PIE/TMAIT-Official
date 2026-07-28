import { useCallback, useEffect, useState } from "react";
import { FileText, MapTrifold, TrafficCone, Paperclip } from "@phosphor-icons/react";
import JobsSidebar from "../components/JobsSidebar";
import RequestForm from "../components/RequestForm";
import PlanDocument from "../components/PlanDocument";
import TrafficMap from "../components/TrafficMap";
import SchematicDiagram from "../components/SchematicDiagram";
import ActionsPanel from "../components/ActionsPanel";
import KnowledgeBase from "../components/KnowledgeBase";
import TrainingDashboard from "../components/TrainingDashboard";
import UserManagement from "../components/UserManagement";
import GeneratingCard from "../components/GeneratingCard";
import { streamGeneration } from "../lib/sse";
import { useAuth } from "../context/AuthContext";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

const BLUEPRINT = "https://images.unsplash.com/photo-1542621334-a254cf47733d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBibHVlcHJpbnQlMjBlbmdpbmVlcmluZ3xlbnwwfHx8fDE3ODQ4NjA5MTV8MA&ixlib=rb-4.1.0&q=85";

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState(null);
  const [view, setView] = useState("empty"); // empty | form | job
  const [tab, setTab] = useState("plan");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [showKb, setShowKb] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const loadJobs = useCallback(() => api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {}), []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const openJob = async (id) => {
    setView("job");
    setTab("plan");
    setSheetIdx(0);
    const { data } = await api.get(`/jobs/${id}`);
    setJob(data);
  };

  const refreshJob = async () => {
    if (job) {
      const { data } = await api.get(`/jobs/${job.id}`);
      setJob(data);
    }
    loadJobs();
  };

  const onCreated = (newJob) => {
    setJob(newJob);
    setView("job");
    loadJobs();
  };

  const generate = async (model) => {
    setGenerating(true);
    setGenProgress({ stage: "retrieving", text: "", chars: 0 });
    try {
      await streamGeneration(job.id, model, (evt) => {
        if (evt.type === "stage") setGenProgress((p) => ({ ...p, stage: evt.stage }));
        else if (evt.type === "delta") setGenProgress((p) => ({ stage: "drafting", text: (p.text + evt.text).slice(-700), chars: p.chars + evt.text.length }));
        else if (evt.type === "done") {
          setJob(evt.job);
          setSheetIdx(0);
          loadJobs();
          toast.success("ATOM generated a TMM 2020-compliant plan");
          return false;
        } else if (evt.type === "error") {
          toast.error(evt.detail);
          refreshJob();
          return false;
        }
        return true;
      });
    } catch (e) {
      toast.error(e.message || "Generation failed");
      refreshJob();
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const savePlan = async (plan) => {
    try {
      await api.put(`/jobs/${job.id}/plan`, { plan });
      toast.success("Corrections saved — logged as ATOM training feedback");
      refreshJob();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const downloadAttachment = async (a) => {
    try {
      const res = await api.get(`/jobs/${job.id}/attachments/${a.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const el = document.createElement("a");
      el.href = url;
      el.download = a.filename;
      el.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const isReviewer = user.role === "reviewer" || user.role === "admin";
  const sheets = job?.plan ? (job.plan.layouts || (job.plan.layout ? [job.plan.layout] : [])) : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0A]">
      <JobsSidebar jobs={jobs} selectedId={job?.id} onSelect={openJob}
        onNewRequest={() => { setView("form"); setJob(null); }} onOpenKb={() => setShowKb(true)}
        onOpenTraining={() => setShowTraining(true)} onOpenUsers={() => setShowUsers(true)} />

      <main data-testid="workspace" className="flex-1 bg-[#F8F9FA] h-full overflow-y-auto relative z-10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {view === "form" && <div className="p-10"><RequestForm onCreated={onCreated} /></div>}

        {view === "empty" && (
          <div className="h-full relative flex items-center justify-center">
            <img src={BLUEPRINT} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.07]" />
            <div className="relative text-left max-w-md px-10 animate-rise" data-testid="workspace-empty-state">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-3">Workspace</p>
              <h1 className="font-heading text-5xl font-bold tracking-tight text-[#0A0A0A] leading-none mb-4">A.T.O.M is standing by.</h1>
              <p className="text-sm text-zinc-500 font-body leading-relaxed">Select a job from the sidebar, or submit a new traffic-management request. Plans are grounded in the BC TMM 2020 and rendered with a live site diagram.</p>
            </div>
          </div>
        )}

        {view === "job" && job && (
          <div className="p-10">
            <div className="mb-6">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-2">{job.works_type}</p>
              <h1 data-testid="job-title" className="font-heading text-4xl font-bold tracking-tight text-[#0A0A0A] leading-none">{job.title}</h1>
              <p className="text-sm text-zinc-500 font-body mt-2">{job.location}</p>
              {job.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3" data-testid="attachments-list">
                  {job.attachments.map((a) => (
                    <button key={a.id} data-testid={`attachment-${a.id}`} onClick={() => downloadAttachment(a)}
                      className="flex items-center gap-1.5 border border-black/15 bg-white px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600 hover:border-[#FF5F15] hover:text-black transition-colors duration-150">
                      <Paperclip size={12} /> {a.filename}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!job.plan && !generating && (
              <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="no-plan-state">
                <p className="font-heading text-lg font-bold text-[#0A0A0A] mb-2">No plan generated yet</p>
                <p className="text-sm text-zinc-500 font-body leading-relaxed">Use the <span className="font-mono text-xs uppercase text-[#FF5F15]">Generate Plan</span> action in the right panel. ATOM will retrieve relevant TMM 2020 sections and produce a structured, citable traffic-management plan with a site diagram.</p>
              </div>
            )}

            {generating && <GeneratingCard progress={genProgress} />}

            {job.plan && !generating && (
              <>
                <div className="flex border border-black/15 rounded-sm w-fit mb-8 overflow-hidden">
                  {[["plan", "Plan Document", FileText], ["layout", "Layout Diagram", TrafficCone], ["map", "Map View", MapTrifold]].map(([k, label, Icon]) => (
                    <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
                      className={`flex items-center gap-2 px-5 py-2.5 text-xs font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${tab === k ? "bg-[#0A0A0A] text-white" : "text-zinc-600 hover:text-black bg-white"}`}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                <div key={tab} className="animate-fade">
                  {tab === "plan" && <PlanDocument plan={job.plan} editable={isReviewer} onSave={savePlan} />}
                  {tab === "layout" && (
                    <div>
                      {sheets.length > 1 && (
                        <div className="flex border border-black/15 rounded-sm w-fit mb-4 overflow-hidden" data-testid="sheet-tabs">
                          {sheets.map((s, i) => (
                            <button key={`tc-${s.sheet_title || s.layout_title || i}`} data-testid={`sheet-tab-${i}`} onClick={() => setSheetIdx(i)}
                              className={`px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${sheetIdx === i ? "bg-[#FF5F15] text-black font-bold" : "bg-white text-zinc-600 hover:text-black"}`}>
                              TC-{i + 1}{s.sheet_title ? ` · ${s.sheet_title.slice(0, 24)}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                      <SchematicDiagram layout={sheets[Math.min(sheetIdx, Math.max(sheets.length - 1, 0))] || null} job={job}
                        sheetIndex={Math.min(sheetIdx, Math.max(sheets.length - 1, 0))} sheetCount={sheets.length} />
                    </div>
                  )}
                  {tab === "map" && <TrafficMap features={job.plan.map_features} />}
                </div>
                {sheets.length > 0 && (
                  <div style={{ position: "absolute", left: -20000, top: 0 }} aria-hidden="true">
                    {sheets.map((l, i) => (
                      <SchematicDiagram key={`export-${l.sheet_title || l.layout_title || i}`} layout={l} job={job} svgId={`layout-svg-export-${i}`} sheetIndex={i} sheetCount={sheets.length} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <ActionsPanel job={job} generating={generating} onGenerate={generate} onJobUpdated={refreshJob} />
      {showKb && <KnowledgeBase onClose={() => setShowKb(false)} />}
      {showTraining && <TrainingDashboard onClose={() => setShowTraining(false)} />}
      {showUsers && <UserManagement onClose={() => setShowUsers(false)} />}
    </div>
  );
}
