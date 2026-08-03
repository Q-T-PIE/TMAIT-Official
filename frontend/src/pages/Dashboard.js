import JobsSidebar from "../components/JobsSidebar";
import RequestForm from "../components/RequestForm";
import JobHeader from "../components/JobHeader";
import PlanWorkspace from "../components/PlanWorkspace";
import ActionsPanel from "../components/ActionsPanel";
import KnowledgeBase from "../components/KnowledgeBase";
import TrainingDashboard from "../components/TrainingDashboard";
import UserManagement from "../components/UserManagement";
import GeneratingCard from "../components/GeneratingCard";
import { streamGeneration } from "../lib/sse";
import { useJobs } from "../hooks/useJobs";
import { useAuth } from "../context/AuthContext";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

import { useState } from "react";

const BLUEPRINT = "https://images.unsplash.com/photo-1542621334-a254cf47733d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBibHVlcHJpbnQlMjBlbmdpbmVlcmluZ3xlbnwwfHx8fDE3ODQ4NjA5MTV8MA&ixlib=rb-4.1.0&q=85";

export default function Dashboard() {
  const { user } = useAuth();
  const { jobs, job, setJob, loadJobs, fetchJob, refreshJob } = useJobs();
  const [view, setView] = useState("empty"); // empty | form | job
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [showKb, setShowKb] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const openJob = async (id) => {
    setView("job");
    await fetchJob(id);
  };

  const onCreated = (newJob) => {
    setJob(newJob);
    setView("job");
    loadJobs();
  };

  const handleGenEvent = (evt) => {
    if (evt.type === "stage") setGenProgress((p) => ({ ...p, stage: evt.stage }));
    else if (evt.type === "delta") setGenProgress((p) => ({ stage: "drafting", text: (p.text + evt.text).slice(-700), chars: p.chars + evt.text.length }));
    else if (evt.type === "done") {
      setJob(evt.job);
      loadJobs();
      toast.success("ATOM generated a TMM 2020-compliant plan");
      return false;
    } else if (evt.type === "error") {
      toast.error(evt.detail);
      refreshJob(job?.id);
      return false;
    }
    return true;
  };

  const generate = async (model) => {
    setGenerating(true);
    setGenProgress({ stage: "retrieving", text: "", chars: 0 });
    try {
      await streamGeneration(job.id, model, handleGenEvent);
    } catch (e) {
      toast.error(e.message || "Generation failed");
      refreshJob(job?.id);
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const savePlan = async (plan) => {
    try {
      await api.put(`/jobs/${job.id}/plan`, { plan });
      toast.success("Corrections saved — logged as ATOM training feedback");
      refreshJob(job.id);
    } catch (e) {
      toast.error(apiError(e));
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
            <JobHeader job={job} />

            {!job.plan && !generating && (
              <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="no-plan-state">
                <p className="font-heading text-lg font-bold text-[#0A0A0A] mb-2">No plan generated yet</p>
                <p className="text-sm text-zinc-500 font-body leading-relaxed">Use the <span className="font-mono text-xs uppercase text-[#FF5F15]">Generate Plan</span> action in the right panel. ATOM will retrieve relevant TMM 2020 sections and produce a structured, citable traffic-management plan with a site diagram.</p>
              </div>
            )}

            {generating && <GeneratingCard progress={genProgress} />}

            {job.plan && !generating && (
              <PlanWorkspace key={job.id} job={job} sheets={sheets} isReviewer={isReviewer} onSavePlan={savePlan} />
            )}
          </div>
        )}
      </main>

      <ActionsPanel job={job} generating={generating} onGenerate={generate} onJobUpdated={() => refreshJob(job?.id)} />
      {showKb && <KnowledgeBase onClose={() => setShowKb(false)} />}
      {showTraining && <TrainingDashboard onClose={() => setShowTraining(false)} />}
      {showUsers && <UserManagement onClose={() => setShowUsers(false)} />}
    </div>
  );
}
