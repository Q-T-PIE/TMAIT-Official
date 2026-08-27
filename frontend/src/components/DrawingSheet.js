import { Printer } from "@phosphor-icons/react";
import { DEFAULT_COMPANY_PROFILE, PRODUCT_BRAND } from "../config/branding";

function staticMapUrl(frame) {
  const b = frame?.bounds;
  if (!b) return null;
  const bbox = [b.west, b.south, b.east, b.north].join(",");
  const params = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "4326",
    size: "1800,1050",
    format: "png32",
    transparent: "false",
    f: "image",
  });
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

function pointStyle(object, bounds) {
  if (!bounds) return {};
  const width = bounds.east - bounds.west;
  const height = bounds.north - bounds.south;
  const left = width ? ((object.lng - bounds.west) / width) * 100 : 50;
  const top = height ? ((bounds.north - object.lat) / height) * 100 : 50;
  return { left: `${left}%`, top: `${top}%` };
}

function MapObject({ object, bounds }) {
  if (object.hidden) return null;
  const isSign = object.kind === "sign";
  const className = isSign
    ? "bg-[#FF5F15] border-black text-black"
    : object.kind === "tcp"
      ? "bg-blue-600 border-black text-white"
      : object.kind === "cone"
        ? "bg-amber-400 border-black text-black"
        : "bg-white border-black text-black";
  return (
    <div
      style={{ ...pointStyle(object, bounds), transform: `translate(-50%, -50%) rotate(${object.rotation || 0}deg)` }}
      className={`absolute z-10 border-2 rounded-[2px] shadow-sm ${className} ${isSign ? "px-1.5 py-1 min-w-[44px]" : "w-6 h-6"}`}
      title={object.label}
    >
      <div className={`font-mono font-bold text-center leading-none ${isSign ? "text-[7px]" : "text-[10px]"}`}>
        {isSign ? object.key : object.glyph}
      </div>
    </div>
  );
}

function InfoCell({ label, value, wide = false }) {
  return (
    <div className={`border-r border-t border-black px-2 py-1.5 ${wide ? "col-span-2" : ""}`}>
      <div className="font-mono text-[7px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-mono text-[10px] font-bold text-black min-h-[14px]">{value || "—"}</div>
    </div>
  );
}

export default function DrawingSheet({ job }) {
  const state = job?.plan?.editor_state;
  const frame = state?.print_frame;
  const bounds = frame?.bounds;
  const objects = state?.objects || [];
  const mapUrl = staticMapUrl(frame);
  const company = DEFAULT_COMPANY_PROFILE;

  if (!frame || !bounds) {
    return (
      <div className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl">
        <h3 className="font-heading font-bold text-lg">No plan map frame locked yet</h3>
        <p className="text-sm text-zinc-500 mt-2">Open Drafting Editor, frame the exact site image you want on the drawing, then press <b>Lock Plan View</b>.</p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #tmait-print-sheet, #tmait-print-sheet * { visibility: visible !important; }
          #tmait-print-sheet { position: absolute !important; left: 0; top: 0; width: 100% !important; box-shadow: none !important; }
          .tmait-no-print { display: none !important; }
          @page { size: landscape; margin: 0.2in; }
        }
      `}</style>

      <div className="tmait-no-print flex justify-end mb-3">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] text-white rounded-sm font-mono text-xs uppercase hover:bg-[#6B21A8]">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      <div id="tmait-print-sheet" className="bg-white border-2 border-black shadow-sm p-3 aspect-[11/8.5] min-h-[720px] flex flex-col">
        <div className="relative flex-1 min-h-0 border-2 border-black overflow-hidden bg-zinc-200">
          {mapUrl && <img src={mapUrl} alt="Locked traffic management plan map" className="absolute inset-0 w-full h-full object-fill" />}
          {objects.map((object) => <MapObject key={object.id} object={object} bounds={bounds} />)}

          <div className="absolute top-3 right-3 bg-white/90 border border-black w-12 h-16 flex flex-col items-center justify-center font-mono font-bold shadow-sm">
            <span className="text-lg leading-none">N</span>
            <span className="text-2xl leading-none">↑</span>
          </div>
          <div className="absolute left-2 bottom-2 bg-white/90 border border-black px-2 py-1 font-mono text-[7px]">
            Imagery: Esri World Imagery · Plan view locked at zoom {frame.zoom}
          </div>
        </div>

        <div className="mt-2 border-l border-b border-black grid grid-cols-6">
          <div className="col-span-1 row-span-2 border-r border-t border-black p-2 flex flex-col justify-center">
            <div className="font-heading font-black text-xl tracking-tight">{company.shortName || company.name}</div>
            <div className="font-mono text-[8px] uppercase">{company.name}</div>
            <div className="font-mono text-[7px] mt-1 text-zinc-500">{company.phone}</div>
            <div className="font-mono text-[7px] text-zinc-500">{company.email}</div>
          </div>
          <InfoCell label="Project" value={job?.title} wide />
          <InfoCell label="Location" value={job?.location} wide />
          <InfoCell label="Plan No." value={job?.id ? job.id.slice(0, 8).toUpperCase() : ""} />
          <InfoCell label="Work Type" value={job?.works_type} wide />
          <InfoCell label="Posted Speed" value={job?.speed_limit ? `${job.speed_limit} km/h` : ""} />
          <InfoCell label="Prepared By" value={company.preparedBy} />
          <div className="border-r border-t border-black px-2 py-1.5">
            <div className="font-mono text-[7px] uppercase tracking-wider text-zinc-500">Software</div>
            <div className="font-mono text-[9px] font-bold">{PRODUCT_BRAND.name} powered by {PRODUCT_BRAND.poweredBy}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
