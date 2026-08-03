import { useState } from "react";
import JobsSidebar from "../components/JobsSidebar";
import RequestForm from "../components/RequestForm";
import ActionsPanel from "../components/ActionsPanel";
import KnowledgeBase from "../components/KnowledgeBase";
import TrainingDashboard from "../components/TrainingDashboard";
import UserManagement from "../components/UserManagement";
import { EmptyWorkspace, JobView } from "../components/WorkspaceStates";
import { useJobs } from "../hooks/useJobs";
import { usePlanGeneration } from "../hooks/usePlanGeneration";
import { useAuth } from "../context/AuthContext";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const { jobs, job, setJob, loadJobs, fetchJob, refreshJob } = useJobs();
  const [view, setView] = useState("empty"); // empty | form | job
  const [modal, setModal] = useState(null); // null | kb | training | users
  const { generating, progress, generate } = usePlanGeneration({ job, setJob, loadJobs, refreshJob });

  const openJob = async (id) => {
    setView("job");
    await fetchJob(id);
  };

  const onCreated = (newJob) => {
    setJob(newJob);
    setView("job");
    loadJobs();
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0A]">
      <JobsSidebar jobs={jobs} selectedId={job?.id} onSelect={openJob}
        onNewRequest={() => { setView("form"); setJob(null); }} onOpenKb={() => setModal("kb")}
        onOpenTraining={() => setModal("training")} onOpenUsers={() => setModal("users")} />

      <main data-testid="workspace" className="flex-1 bg-[#F8F9FA] h-full overflow-y-auto relative z-10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {view === "form" && <div className="p-10"><RequestForm onCreated={onCreated} /></div>}
        {view === "empty" && <EmptyWorkspace />}
        {view === "job" && job && (
          <JobView job={job} generating={generating} progress={progress} isReviewer={isReviewer} onSavePlan={savePlan} />
        )}
      </main>

      <ActionsPanel job={job} generating={generating} onGenerate={generate} onJobUpdated={() => refreshJob(job?.id)} />
      {modal === "kb" && <KnowledgeBase onClose={() => setModal(null)} />}
      {modal === "training" && <TrainingDashboard onClose={() => setModal(null)} />}
      {modal === "users" && <UserManagement onClose={() => setModal(null)} />}
    </div>
  );
}
