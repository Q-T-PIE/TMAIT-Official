import { Paperclip } from "@phosphor-icons/react";
import api from "../lib/api";
import { toast } from "sonner";

async function downloadAttachment(jobId, a) {
  try {
    const res = await api.get(`/jobs/${jobId}/attachments/${a.id}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.filename;
    el.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Download failed");
  }
}

export default function JobHeader({ job }) {
  return (
    <div className="mb-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-2">{job.works_type}</p>
      <h1 data-testid="job-title" className="font-heading text-4xl font-bold tracking-tight text-[#0A0A0A] leading-none">{job.title}</h1>
      <p className="text-sm text-zinc-500 font-body mt-2">{job.location}</p>
      {job.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3" data-testid="attachments-list">
          {job.attachments.map((a) => (
            <button key={a.id} data-testid={`attachment-${a.id}`} onClick={() => downloadAttachment(job.id, a)}
              className="flex items-center gap-1.5 border border-black/15 bg-white px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600 hover:border-[#FF5F15] hover:text-black transition-colors duration-150">
              <Paperclip size={12} /> {a.filename}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
