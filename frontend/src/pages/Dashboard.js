import { useCallback, useEffect, useState } from "react";
import { FileText, MapTrifold, TrafficCone } from "@phosphor-icons/react";
import JobsSidebar from "../components/JobsSidebar";
import RequestForm from "../components/RequestForm";
import PlanDocument from "../components/PlanDocument";
import TrafficMap from "../components/TrafficMap";
import SchematicDiagram from "../components/SchematicDiagram";
import ActionsPanel from "../components/ActionsPanel";
import KnowledgeBase from "../components/KnowledgeBase";
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
  const [showKb, setShowKb] = useState(false);

  const loadJobs = useCallback(() => api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {}), []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const openJob = async (id) => {
    setView("job");
    setTab("plan");
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
    try {
      const { data } = await api.post(`/jobs/${job.id}/generate`, { model }, { timeout: 300000 });
      setJob(data);
      loadJobs();
      toast.success("ATOM generated a TMM 2020-compliant plan");
    } catch (e) {
      toast.error(apiError(e));
      refreshJob();
    } finally {
      setGenerating(false);
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

  const isReviewer = user.role === "reviewer" || user.role === "admin";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0A]">
      <JobsSidebar jobs={jobs} selectedId={job?.id} onSelect={openJob}
        onNewRequest={() => { setView("form"); setJob(null); }} onOpenKb={() => setShowKb(true)} />

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
            </div>

            {!job.plan && !generating && (
              <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="no-plan-state">
                <p className="font-heading text-lg font-bold text-[#0A0A0A] mb-2">No plan generated yet</p>
                <p className="text-sm text-zinc-500 font-body leading-relaxed">Use the <span className="font-mono text-xs uppercase text-[#FF5F15]">Generate Plan</span> action in the right panel. ATOM will retrieve relevant TMM 2020 sections and produce a structured, citable traffic-management plan with a site diagram.</p>
              </div>
            )}

            {generating && (
              <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="generating-state">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 bg-[#FF5F15] rounded-full animate-ping" />
                  <p className="font-heading text-lg font-bold text-[#0A0A0A]">A.T.O.M is drafting the plan…</p>
                </div>
                <p className="text-sm text-zinc-500 font-body leading-relaxed">Retrieving TMM 2020 excerpts → grounding signage & taper requirements → composing plan → placing diagram markers. Typically 30–120 seconds.</p>
              </div>
            )}

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
                  {tab === "layout" && <SchematicDiagram plan={job.plan} job={job} />}
                  {tab === "map" && <TrafficMap features={job.plan.map_features} />}
                </div>
                {job.plan.layout && tab !== "layout" && (
                  <div style={{ position: "absolute", left: -20000, top: 0 }} aria-hidden="true">
                    <SchematicDiagram plan={job.plan} job={job} svgId="layout-svg-export" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <ActionsPanel job={job} generating={generating} onGenerate={generate} onJobUpdated={refreshJob} />
      {showKb && <KnowledgeBase onClose={() => setShowKb(false)} />}
    </div>
  );
}
