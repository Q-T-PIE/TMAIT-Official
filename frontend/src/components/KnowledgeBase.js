import { useCallback, useEffect, useRef, useState } from "react";
import { UploadSimple, FilePdf, X, ArrowsClockwise, Trash } from "@phosphor-icons/react";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

export default function KnowledgeBase({ onClose }) {
  const [data, setData] = useState({ docs: [], total_chunks: 0 });
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyDoc, setBusyDoc] = useState(null);
  const fileRef = useRef();

  const load = useCallback(() => api.get("/kb/docs").then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", file.name.replace(".pdf", ""));
    try {
      await api.post("/kb/upload", fd);
      toast.success("Document indexed into ATOM knowledge base");
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const reindex = async (d) => {
    setBusyDoc(d.id);
    try {
      await api.post(`/kb/docs/${d.id}/reindex`);
      toast.success(`"${d.title}" reindexed`);
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyDoc(null);
    }
  };

  const removeDoc = async (d) => {
    setBusyDoc(d.id);
    try {
      await api.delete(`/kb/docs/${d.id}`);
      toast.success(`"${d.title}" removed from knowledge base`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyDoc(null);
    }
  };

  const statusColor = { indexed: "#10B981", indexing: "#F59E0B", failed: "#EF4444" };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" data-testid="kb-modal">
      <div className="bg-[#121212] border border-white/15 rounded-sm w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 animate-rise">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF5F15] mb-1">Admin</p>
            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">ATOM Knowledge Base</h2>
            <p className="text-xs text-zinc-400 font-body mt-1">{data.docs.length} documents · {data.total_chunks} indexed chunks (RAG)</p>
          </div>
          <button data-testid="kb-close-button" onClick={onClose} className="text-zinc-500 hover:text-white p-1 transition-colors duration-150"><X size={18} /></button>
        </div>

        <button data-testid="kb-upload-button" onClick={() => fileRef.current.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-white/25 text-zinc-300 py-6 rounded-sm text-sm font-body hover:border-[#FF5F15] hover:text-white transition-colors duration-150 mb-6 disabled:opacity-50">
          <UploadSimple size={18} />
          {uploading ? "Uploading & indexing (embedding chunks)…" : "Upload PDF — TMM sections, standards, reference docs"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={upload} data-testid="kb-file-input" />

        <div className="space-y-2" data-testid="kb-docs-list">
          {data.docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border border-white/10 rounded-sm px-4 py-3">
              <FilePdf size={20} className="text-[#FF5F15] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-body truncate">{d.title}</p>
                <p className="font-mono text-[10px] text-zinc-500">{d.chunk_count} chunks · {new Date(d.created_at).toLocaleString()}</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 border rounded-sm"
                style={{ color: statusColor[d.status], borderColor: `${statusColor[d.status]}66` }}>
                {d.status}
              </span>
              <div className="flex items-center gap-1">
                <button data-testid={`kb-reindex-button-${d.id}`} onClick={() => reindex(d)} disabled={busyDoc === d.id || d.status === "indexing"}
                  className="text-zinc-500 hover:text-[#FF5F15] p-1.5 transition-colors duration-150 disabled:opacity-30" title="Re-index document">
                  <ArrowsClockwise size={15} className={busyDoc === d.id ? "animate-spin" : ""} />
                </button>
                {confirmDelete === d.id ? (
                  <button data-testid={`kb-delete-confirm-${d.id}`} onClick={() => removeDoc(d)} disabled={busyDoc === d.id}
                    className="bg-[#EF4444] text-white px-2 py-1 rounded-sm font-mono text-[9px] uppercase tracking-wider font-bold">Confirm</button>
                ) : (
                  <button data-testid={`kb-delete-button-${d.id}`} onClick={() => setConfirmDelete(d.id)} disabled={busyDoc === d.id}
                    className="text-zinc-500 hover:text-[#EF4444] p-1.5 transition-colors duration-150 disabled:opacity-30" title="Delete document">
                    <Trash size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {data.docs.length === 0 && <p className="text-sm text-zinc-500 font-body">Built-in BC TMM 2020 is being indexed on first startup — refresh shortly.</p>}
        </div>
      </div>
    </div>
  );
}
