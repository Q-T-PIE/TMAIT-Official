import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState(null);

  const loadJobs = useCallback(() => api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {}), [setJobs]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const fetchJob = useCallback(async (id) => {
    const { data } = await api.get(`/jobs/${id}`);
    setJob(data);
    return data;
  }, [setJob]);

  const refreshJob = useCallback(async (currentId) => {
    if (currentId) await fetchJob(currentId);
    loadJobs();
  }, [fetchJob, loadJobs]);

  return { jobs, job, setJob, loadJobs, fetchJob, refreshJob };
}
