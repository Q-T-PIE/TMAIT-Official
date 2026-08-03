import JobHeader from "./JobHeader";
import PlanWorkspace from "./PlanWorkspace";
import GeneratingCard from "./GeneratingCard";

const BLUEPRINT = "https://images.unsplash.com/photo-1542621334-a254cf47733d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBibHVlcHJpbnQlMjBlbmdpbmVlcmluZ3xlbnwwfHx8fDE3ODQ4NjA5MTV8MA&ixlib=rb-4.1.0&q=85";

export function EmptyWorkspace() {
  return (
    <div className="h-full relative flex items-center justify-center">
      <img src={BLUEPRINT} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.07]" />
      <div className="relative text-left max-w-md px-10 animate-rise" data-testid="workspace-empty-state">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-3">Workspace</p>
        <h1 className="font-heading text-5xl font-bold tracking-tight text-[#0A0A0A] leading-none mb-4">A.T.O.M is standing by.</h1>
        <p className="text-sm text-zinc-500 font-body leading-relaxed">Select a job from the sidebar, or submit a new traffic-management request. Plans are grounded in the BC TMM 2020 and rendered with a live site diagram.</p>
      </div>
    </div>
  );
}

function NoPlanCard() {
  return (
    <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl" data-testid="no-plan-state">
      <p className="font-heading text-lg font-bold text-[#0A0A0A] mb-2">No plan generated yet</p>
      <p className="text-sm text-zinc-500 font-body leading-relaxed">Use the <span className="font-mono text-xs uppercase text-[#FF5F15]">Generate Plan</span> action in the right panel. ATOM will retrieve relevant TMM 2020 sections and produce a structured, citable traffic-management plan with a site diagram.</p>
    </div>
  );
}

function getSheets(plan) {
  if (!plan) return [];
  if (plan.layouts) return plan.layouts;
  return plan.layout ? [plan.layout] : [];
}

export function JobView({ job, generating, progress, isReviewer, onSavePlan }) {
  return (
    <div className="p-10">
      <JobHeader job={job} />
      {!job.plan && !generating && <NoPlanCard />}
      {generating && <GeneratingCard progress={progress} />}
      {job.plan && !generating && (
        <PlanWorkspace key={job.id} job={job} sheets={getSheets(job.plan)} isReviewer={isReviewer} onSavePlan={onSavePlan} />
      )}
    </div>
  );
}
