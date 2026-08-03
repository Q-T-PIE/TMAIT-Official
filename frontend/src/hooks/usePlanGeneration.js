import { useState } from "react";
import { toast } from "sonner";
import { streamGeneration } from "../lib/sse";

export function usePlanGeneration({ job, setJob, loadJobs, refreshJob }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null);

  const handleEvent = (evt) => {
    if (evt.type === "stage") {
      setProgress((p) => ({ ...p, stage: evt.stage }));
      return true;
    }
    if (evt.type === "delta") {
      setProgress((p) => ({ stage: "drafting", text: (p.text + evt.text).slice(-700), chars: p.chars + evt.text.length }));
      return true;
    }
    if (evt.type === "done") {
      setJob(evt.job);
      loadJobs();
      toast.success("ATOM generated a TMM 2020-compliant plan");
      return false;
    }
    toast.error(evt.detail);
    refreshJob(job?.id);
    return false;
  };

  const generate = async (model) => {
    setGenerating(true);
    setProgress({ stage: "retrieving", text: "", chars: 0 });
    try {
      await streamGeneration(job.id, model, handleEvent);
    } catch (e) {
      toast.error(e.message || "Generation failed");
      refreshJob(job?.id);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return { generating, progress, generate };
}
