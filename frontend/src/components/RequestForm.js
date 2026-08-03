import { useState } from "react";
import api, { apiError } from "../lib/api";
import { toast } from "sonner";

const WORKS_TYPES = ["Road construction", "Road maintenance", "Utility work", "Paving / resurfacing", "Special event", "Emergency works", "Bridge work", "Line painting"];
const ROAD_TYPES = ["Urban arterial", "Urban local street", "Rural highway (2-lane)", "Rural highway (4-lane divided)", "Freeway", "Intersection", "Bridge"];
const VOLUMES = ["Low (<1,000 AADT)", "Moderate (1,000–10,000 AADT)", "High (10,000–30,000 AADT)", "Very high (>30,000 AADT)"];

const INP = "w-full bg-white border border-black/15 text-[#0A0A0A] px-3.5 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-[#FF5F15] font-body";
const LBL = "block font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5";

async function createJobWithAttachments(f, files) {
  const payload = { ...f, lanes_total: +f.lanes_total, lanes_closed: +f.lanes_closed, speed_limit: +f.speed_limit };
  const { data } = await api.post("/jobs", payload);
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/jobs/${data.id}/attachments`, fd);
    } catch (err) {
      toast.error(`Attachment "${file.name}" failed: ${apiError(err)}`);
    }
  }
  if (!files.length) return data;
  const res = await api.get(`/jobs/${data.id}`);
  return res.data;
}

function SiteFields({ f, set }) {
  return (
    <>
      <div className="md:col-span-2">
        <label className={LBL}>Job title *</label>
        <input data-testid="form-title-input" className={INP} value={f.title} onChange={set("title")} placeholder="e.g. Watermain repair — Lonsdale Ave" required />
      </div>
      <div className="md:col-span-2">
        <label className={LBL}>Location (address / road, BC) *</label>
        <input data-testid="form-location-input" className={INP} value={f.location} onChange={set("location")} placeholder="e.g. Lonsdale Ave & 13th St, North Vancouver" required />
      </div>
      <div>
        <label className={LBL}>Works / event type</label>
        <select data-testid="form-works-type-select" className={INP} value={f.works_type} onChange={set("works_type")}>
          {WORKS_TYPES.map((w) => <option key={w}>{w}</option>)}
        </select>
      </div>
      <div>
        <label className={LBL}>Road type</label>
        <select data-testid="form-road-type-select" className={INP} value={f.road_type} onChange={set("road_type")}>
          {ROAD_TYPES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className={LBL}>Start date</label>
        <input data-testid="form-start-date-input" className={INP} type="date" value={f.start_date} onChange={set("start_date")} />
      </div>
      <div>
        <label className={LBL}>Duration</label>
        <input data-testid="form-duration-input" className={INP} value={f.duration} onChange={set("duration")} placeholder="e.g. 3 days, 07:00–17:00" />
      </div>
    </>
  );
}

function TrafficFields({ f, set }) {
  return (
    <>
      <div>
        <label className={LBL}>Total lanes</label>
        <input data-testid="form-lanes-total-input" className={INP} type="number" min="1" max="12" value={f.lanes_total} onChange={set("lanes_total")} />
      </div>
      <div>
        <label className={LBL}>Lanes to close</label>
        <input data-testid="form-lanes-closed-input" className={INP} type="number" min="0" max="12" value={f.lanes_closed} onChange={set("lanes_closed")} />
      </div>
      <div>
        <label className={LBL}>Posted speed (km/h)</label>
        <input data-testid="form-speed-input" className={INP} type="number" min="20" max="120" step="10" value={f.speed_limit} onChange={set("speed_limit")} />
      </div>
      <div>
        <label className={LBL}>Traffic volume</label>
        <select data-testid="form-volume-select" className={INP} value={f.traffic_volume} onChange={set("traffic_volume")}>
          {VOLUMES.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={LBL}>Known hazards</label>
        <textarea data-testid="form-hazards-input" className={INP} rows={2} value={f.hazards} onChange={set("hazards")} placeholder="e.g. School zone nearby, limited sightlines on crest, bus route" />
      </div>
      <div className="md:col-span-2">
        <label className={LBL}>Additional notes</label>
        <textarea data-testid="form-notes-input" className={INP} rows={2} value={f.notes} onChange={set("notes")} placeholder="Anything else ATOM should consider" />
      </div>
    </>
  );
}

function AttachmentsField({ files, setFiles }) {
  return (
    <div className="md:col-span-2">
      <label className={LBL}>Attachments — site photos, drawings, permits (PDF / image / txt, max 10 MB each)</label>
      <input data-testid="form-attachments-input" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        className="block w-full text-sm text-zinc-500 font-body file:mr-3 file:bg-[#0A0A0A] file:text-white file:border-0 file:px-4 file:py-2 file:rounded-sm file:text-xs file:font-mono file:uppercase file:tracking-wider file:cursor-pointer" />
      {files.length > 0 && (
        <p data-testid="form-attachments-names" className="font-mono text-[10px] text-zinc-500 mt-1.5">{files.map((x) => x.name).join(" · ")}</p>
      )}
    </div>
  );
}

export default function RequestForm({ onCreated }) {
  const [f, setF] = useState({
    title: "", location: "", works_type: WORKS_TYPES[0], start_date: "", duration: "",
    road_type: ROAD_TYPES[0], lanes_total: 2, lanes_closed: 1, speed_limit: 50,
    traffic_volume: VOLUMES[1], hazards: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const job = await createJobWithAttachments(f, files);
      toast.success("Request submitted — ready for ATOM generation");
      onCreated(job);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl animate-rise" data-testid="request-form">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FF5F15] mb-2">New Job Request</p>
      <h1 className="font-heading text-4xl font-bold tracking-tight text-[#0A0A0A] mb-1">Traffic Management Request</h1>
      <p className="text-sm text-zinc-500 mb-8 font-body">Provide site details. A.T.O.M will generate a TMM 2020-compliant plan.</p>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SiteFields f={f} set={set} />
          <TrafficFields f={f} set={set} />
          <AttachmentsField files={files} setFiles={setFiles} />
        </div>
        <button data-testid="form-submit-button" disabled={busy}
          className="bg-[#0A0A0A] text-white font-heading font-bold px-8 py-3.5 rounded-sm text-sm uppercase tracking-wide hover:bg-black/80 transition-colors duration-150 disabled:opacity-50">
          {busy ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
