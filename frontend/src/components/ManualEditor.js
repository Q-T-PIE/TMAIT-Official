import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  ArrowCounterClockwise,
  Copy,
  CornersOut,
  Crosshair,
  FloppyDisk,
  MapTrifold,
  Microphone,
  MicrophoneSlash,
  MouseSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const BC_CENTER = [53.7267, -127.6476];

const TOOLS = [
  { key: "select", label: "Select", kind: "select", glyph: "↖" },
  { key: "C-018-1A", label: "Construction Ahead", kind: "sign", glyph: "◆" },
  { key: "C-001", label: "TCP Ahead", kind: "sign", glyph: "◆" },
  { key: "C-029", label: "Prepare to Stop", kind: "sign", glyph: "◆" },
  { key: "C-030-8", label: "Single Lane Traffic", kind: "sign", glyph: "◆" },
  { key: "C-130-R", label: "Right Lane Closed", kind: "sign", glyph: "◆" },
  { key: "C-130-L", label: "Left Lane Closed", kind: "sign", glyph: "◆" },
  { key: "TCP", label: "Traffic Control Person", kind: "tcp", glyph: "●" },
  { key: "CONE", label: "Cone / Delineator", kind: "cone", glyph: "▲" },
  { key: "BARRIER", label: "Barrier", kind: "barrier", glyph: "▬" },
  { key: "WORK", label: "Work Area", kind: "work_zone", glyph: "✕" },
];

function makeIcon(item, selected = false) {
  const border = selected ? "#6B21A8" : item.kind === "sign" ? "#FF5F15" : "#111111";
  const bg = item.kind === "sign" ? "#FF5F15" : item.kind === "tcp" ? "#2563EB" : item.kind === "cone" ? "#F59E0B" : "#FFFFFF";
  const text = item.kind === "sign" ? item.key : item.glyph;
  const rotate = item.rotation || 0;
  const width = item.kind === "sign" ? 46 : 30;
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${rotate}deg);transform-origin:center;width:${width}px;height:30px;border:3px solid ${border};background:${bg};color:#111;display:flex;align-items:center;justify-content:center;font:700 ${item.kind === "sign" ? 8 : 13}px monospace;box-shadow:0 2px 8px rgba(0,0,0,.35);border-radius:3px">${text}</div>`,
    iconSize: [width, 30],
    iconAnchor: [width / 2, 15],
  });
}

function boundsObject(map) {
  const b = map.getBounds();
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

function ViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center?.length) return;
    const current = map.getCenter();
    const targetZoom = zoom || map.getZoom();
    const moved = Math.abs(current.lat - center[0]) > 0.0000001 || Math.abs(current.lng - center[1]) > 0.0000001;
    const zoomed = map.getZoom() !== targetZoom;
    if (moved || zoomed) map.flyTo(center, targetZoom, { duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

function InitialMapState({ onViewChange }) {
  const map = useMap();
  const callbackRef = useRef(onViewChange);
  useEffect(() => { callbackRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => {
    const c = map.getCenter();
    callbackRef.current([c.lat, c.lng], map.getZoom(), boundsObject(map));
  }, [map]);
  return null;
}

function MapEvents({ activeTool, onPlace, onViewChange }) {
  useMapEvents({
    click(e) {
      if (activeTool?.kind && activeTool.kind !== "select") onPlace(e.latlng);
    },
    moveend(e) {
      const map = e.target;
      const c = map.getCenter();
      onViewChange([c.lat, c.lng], map.getZoom(), boundsObject(map));
    },
    zoomend(e) {
      const map = e.target;
      const c = map.getCenter();
      onViewChange([c.lat, c.lng], map.getZoom(), boundsObject(map));
    },
  });
  return null;
}

function useSpeechTraining(active, onPhrase) {
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onPhrase);
  useEffect(() => { callbackRef.current = onPhrase; }, [onPhrase]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-CA";
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) callbackRef.current(event.results[i][0].transcript.trim());
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") console.warn("Training speech recognition:", event.error);
    };
    recognition.onend = () => {
      if (recognitionRef.current?.__keepListening) {
        try { recognition.start(); } catch (e) { /* browser restart overlap */ }
      }
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.__keepListening = false;
      try { recognition.stop(); } catch (e) { /* noop */ }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.__keepListening = active;
    try {
      if (active) recognition.start();
      else recognition.stop();
    } catch (e) {
      // Chrome can throw while a previous start/stop is still settling.
    }
  }, [active]);

  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function emptyTrainingSession() {
  return {
    id: `training-${Date.now()}`,
    started_at: new Date().toISOString(),
    ended_at: null,
    transcript: [],
    actions: [],
  };
}

function initialViewport(existing, job) {
  if (existing?.viewport) return existing.viewport;
  const center = existing?.center || (job?.plan?.map_features?.center
    ? [job.plan.map_features.center.lat, job.plan.map_features.center.lng]
    : BC_CENTER);
  return { center, zoom: existing?.zoom || job?.plan?.map_features?.zoom || 15, bounds: existing?.print_frame?.bounds || null };
}

export default function ManualEditor({ job, onSavePlan }) {
  const existing = job?.plan?.editor_state || {};
  const initial = initialViewport(existing, job);
  const [center, setCenter] = useState(initial.center);
  const [zoom, setZoom] = useState(initial.zoom);
  const [viewBounds, setViewBounds] = useState(initial.bounds);
  const [printFrame, setPrintFrame] = useState(existing.print_frame || null);
  const [basemap, setBasemap] = useState(existing.basemap || "satellite");
  const [objects, setObjects] = useState(existing.objects || []);
  const [activeKey, setActiveKey] = useState("select");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState(job?.location || "");
  const [searching, setSearching] = useState(false);
  const [training, setTraining] = useState(false);
  const [session, setSession] = useState(emptyTrainingSession);
  const [savedSessions, setSavedSessions] = useState(existing.training_sessions || []);
  const activeTool = TOOLS.find((t) => t.key === activeKey) || TOOLS[0];

  const logAction = (type, detail = {}) => {
    if (!training) return;
    setSession((s) => ({
      ...s,
      actions: [...s.actions, { at: new Date().toISOString(), type, ...detail }],
    }));
  };

  const speechSupported = useSpeechTraining(training, (text) => {
    setSession((s) => ({
      ...s,
      transcript: [...s.transcript, { at: new Date().toISOString(), text }],
    }));
  });

  const place = ({ lat, lng }) => {
    if (activeTool.kind === "select") return;
    const item = {
      id: `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key: activeTool.key,
      label: activeTool.label,
      kind: activeTool.kind,
      glyph: activeTool.glyph,
      lat,
      lng,
      rotation: 0,
      locked: false,
      hidden: false,
    };
    setObjects((prev) => [...prev, item]);
    setSelectedId(item.id);
    logAction("place", { object: { key: item.key, label: item.label, kind: item.kind, lat, lng } });
  };

  const updateObject = (id, patch, actionType = "edit") => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const current = objects.find((o) => o.id === id);
    if (current) logAction(actionType, { object: { key: current.key, label: current.label, ...patch } });
  };

  const removeSelected = () => {
    const current = objects.find((o) => o.id === selectedId);
    if (!current) return;
    setObjects((prev) => prev.filter((o) => o.id !== selectedId));
    logAction("delete", { object: { key: current.key, label: current.label, lat: current.lat, lng: current.lng } });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    const current = objects.find((o) => o.id === selectedId);
    if (!current) return;
    const copy = {
      ...current,
      id: `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      lat: current.lat + 0.00006,
      lng: current.lng + 0.00006,
    };
    setObjects((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    logAction("duplicate", { object: { key: copy.key, label: copy.label } });
  };

  const rotateSelected = () => {
    const current = objects.find((o) => o.id === selectedId);
    if (!current) return;
    const rotation = ((current.rotation || 0) + 45) % 360;
    updateObject(current.id, { rotation }, "rotate");
  };

  const inventory = useMemo(() => {
    const counts = {};
    objects.filter((o) => !o.hidden).forEach((o) => { counts[o.key] = (counts[o.key] || 0) + 1; });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [objects]);

  const selected = objects.find((o) => o.id === selectedId) || null;

  const handleViewChange = (nextCenter, nextZoom, bounds) => {
    setCenter(nextCenter);
    setZoom(nextZoom);
    setViewBounds(bounds);
    logAction("map_view", { center: nextCenter, zoom: nextZoom, bounds });
  };

  const lockPlanView = () => {
    if (!viewBounds) {
      toast.error("Map frame is not ready yet. Pan or zoom the map once, then lock the plan view.");
      return;
    }
    const frame = {
      center,
      zoom,
      bounds: viewBounds,
      basemap,
      captured_at: new Date().toISOString(),
    };
    setPrintFrame(frame);
    logAction("lock_plan_view", { frame });
    toast.success("Plan map view locked for training");
  };

  const locate = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, British Columbia, Canada`)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en-CA" } });
      const data = await res.json();
      if (!data.length) throw new Error("Location not found");
      const next = [Number(data[0].lat), Number(data[0].lon)];
      setCenter(next);
      setZoom(18);
      logAction("locate", { query, center: next, zoom: 18 });
    } catch (e) {
      toast.error("Could not find that location");
    } finally {
      setSearching(false);
    }
  };

  const toggleBasemap = () => {
    const next = basemap === "satellite" ? "street" : "satellite";
    setBasemap(next);
    logAction("basemap", { value: next });
  };

  const toggleTraining = () => {
    if (training) {
      const finished = { ...session, ended_at: new Date().toISOString() };
      setSavedSessions((prev) => [...prev, finished]);
      setSession(emptyTrainingSession());
      setTraining(false);
      toast.success("Training session captured — save the draft to store it");
    } else {
      setSession(emptyTrainingSession());
      setTraining(true);
      toast.success("A.T.O.M Training Mode started");
    }
  };

  const save = async () => {
    const sessions = training
      ? [...savedSessions, { ...session, ended_at: new Date().toISOString(), still_active: true }]
      : savedSessions;
    const basePlan = job?.plan || {};
    const nextPlan = {
      ...basePlan,
      editor_state: {
        version: 1,
        center,
        zoom,
        viewport: { center, zoom, bounds: viewBounds },
        print_frame: printFrame,
        basemap,
        objects,
        training_sessions: sessions,
        updated_at: new Date().toISOString(),
      },
    };
    await onSavePlan(nextPlan);
  };

  return (
    <div className="grid grid-cols-[250px_minmax(0,1fr)_280px] min-h-[720px] border border-black/15 bg-white rounded-sm overflow-hidden" data-testid="manual-editor">
      <aside className="border-r border-black/10 bg-zinc-50 p-4 overflow-y-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">BC Sign Vault + Devices</p>
        <div className="space-y-1.5">
          {TOOLS.map((tool) => (
            <button key={tool.key} onClick={() => setActiveKey(tool.key)}
              className={`w-full text-left px-3 py-2.5 rounded-sm border text-xs font-mono transition-colors ${activeKey === tool.key ? "border-[#6B21A8] bg-[#6B21A8]/10 text-[#4C1D95]" : "border-black/10 bg-white hover:border-black/30"}`}>
              <span className="inline-block w-7 font-bold">{tool.glyph}</span>{tool.key === "select" ? tool.label : `${tool.key} · ${tool.label}`}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">Choose a tool, then click the map to place it. Drag placed objects to fine-tune their position.</p>
      </aside>

      <section className="min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-black/10 bg-white">
          <div className="flex min-w-[300px] flex-1 gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && locate()}
              className="flex-1 border border-black/15 rounded-sm px-3 py-2 text-sm" placeholder="Search job location" />
            <button onClick={locate} disabled={searching} className="px-3 py-2 border border-black/15 rounded-sm text-xs font-mono uppercase hover:border-[#6B21A8]">
              <Crosshair size={15} className="inline mr-1" />{searching ? "Finding" : "Locate"}
            </button>
          </div>
          <button onClick={toggleBasemap} className="px-3 py-2 border border-black/15 rounded-sm text-xs font-mono uppercase hover:border-[#6B21A8]">
            <MapTrifold size={15} className="inline mr-1" />{basemap === "satellite" ? "Satellite" : "Street"}
          </button>
          <button onClick={lockPlanView} className={`px-3 py-2 border rounded-sm text-xs font-mono uppercase ${printFrame ? "border-[#6B21A8] text-[#6B21A8]" : "border-black/15 hover:border-[#6B21A8]"}`}>
            <CornersOut size={15} className="inline mr-1" />{printFrame ? "Plan View Locked" : "Lock Plan View"}
          </button>
          <button onClick={save} className="px-3 py-2 bg-[#0A0A0A] text-white rounded-sm text-xs font-mono uppercase hover:bg-[#6B21A8]">
            <FloppyDisk size={15} className="inline mr-1" />Save Draft
          </button>
        </div>

        <div className="relative flex-1 min-h-[650px]">
          <MapContainer center={center} zoom={zoom} style={{ height: "100%", minHeight: "650px", width: "100%" }} scrollWheelZoom>
            {basemap === "satellite" ? (
              <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            ) : (
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            )}
            <ViewController center={center} zoom={zoom} />
            <InitialMapState onViewChange={handleViewChange} />
            <MapEvents activeTool={activeTool} onPlace={place} onViewChange={handleViewChange} />
            {objects.filter((o) => !o.hidden).map((o) => (
              <Marker key={o.id} position={[o.lat, o.lng]} icon={makeIcon(o, selectedId === o.id)} draggable={!o.locked}
                eventHandlers={{
                  click: () => { setSelectedId(o.id); setActiveKey("select"); },
                  dragend: (e) => {
                    const p = e.target.getLatLng();
                    updateObject(o.id, { lat: p.lat, lng: p.lng }, "move");
                  },
                }} />
            ))}
          </MapContainer>
          <div className="absolute z-[500] left-3 bottom-3 bg-white/95 border border-black/10 shadow px-3 py-2 text-[10px] font-mono uppercase">
            {activeTool.kind === "select" ? <><MouseSimple size={12} className="inline mr-1" />Select / move objects</> : <>Click map to place: {activeTool.key}</>}
          </div>
        </div>
      </section>

      <aside className="border-l border-black/10 bg-zinc-50 p-4 overflow-y-auto">
        <button onClick={toggleTraining}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-sm border font-heading font-bold text-xs uppercase tracking-wide ${training ? "bg-[#EF4444] border-[#EF4444] text-white" : "bg-[#6B21A8] border-[#6B21A8] text-white"}`}>
          {training ? <MicrophoneSlash size={16} /> : <Microphone size={16} />} {training ? "Finish Training" : "Start ATOM Training"}
        </button>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          {speechSupported ? "A.T.O.M records editor actions, map framing and your spoken explanation while you work." : "This browser does not expose live speech recognition. Editor actions and map framing will still be recorded."}
        </p>

        {training && (
          <div className="mt-4 border border-[#EF4444]/30 bg-white p-3 rounded-sm">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#EF4444]">Recording training</p>
            <p className="text-xs mt-2 text-zinc-600">{session.actions.length} actions · {session.transcript.length} spoken notes</p>
            <div className="mt-3 max-h-28 overflow-y-auto space-y-1">
              {session.transcript.slice(-5).map((t) => <p key={t.at} className="text-[11px] text-zinc-600">“{t.text}”</p>)}
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Plan Map Frame</p>
          <div className="bg-white border border-black/10 rounded-sm p-3 text-[11px] text-zinc-600">
            {printFrame ? (
              <>
                <p className="font-mono font-bold text-[#6B21A8]">LOCKED AT ZOOM {printFrame.zoom}</p>
                <p className="mt-1">The chosen map view is saved with this training example.</p>
              </>
            ) : <p>Pan and zoom until the plan image is right, explain what must be visible, then press <b>Lock Plan View</b>.</p>}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Selected Object</p>
          {!selected ? <p className="text-xs text-zinc-400">Nothing selected.</p> : (
            <div className="bg-white border border-black/10 rounded-sm p-3">
              <p className="font-mono text-xs font-bold">{selected.key}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{selected.label}</p>
              <p className="font-mono text-[10px] text-zinc-400 mt-2">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</p>
              <div className="grid grid-cols-3 gap-1 mt-3">
                <button onClick={rotateSelected} className="border border-black/10 p-2 rounded-sm" title="Rotate 45 degrees"><ArrowCounterClockwise size={15} className="mx-auto" /></button>
                <button onClick={duplicateSelected} className="border border-black/10 p-2 rounded-sm" title="Duplicate"><Copy size={15} className="mx-auto" /></button>
                <button onClick={removeSelected} className="border border-[#EF4444]/30 text-[#EF4444] p-2 rounded-sm" title="Delete"><Trash size={15} className="mx-auto" /></button>
              </div>
              <label className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
                Lock position
                <input type="checkbox" checked={selected.locked} onChange={(e) => updateObject(selected.id, { locked: e.target.checked }, "lock")} />
              </label>
              <label className="mt-2 flex items-center justify-between text-[11px] text-zinc-600">
                Hide
                <input type="checkbox" checked={selected.hidden} onChange={(e) => updateObject(selected.id, { hidden: e.target.checked }, "visibility")} />
              </label>
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Automatic Inventory</p>
          <div className="bg-white border border-black/10 rounded-sm divide-y divide-black/5">
            {inventory.length === 0 ? <p className="p-3 text-xs text-zinc-400">No devices placed.</p> : inventory.map(([key, count]) => (
              <div key={key} className="flex justify-between px-3 py-2 text-xs"><span className="font-mono">{key}</span><b>{count}</b></div>
            ))}
          </div>
        </div>

        {savedSessions.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Training Sessions</p>
            <p className="text-xs text-zinc-600">{savedSessions.length} captured for this plan.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
