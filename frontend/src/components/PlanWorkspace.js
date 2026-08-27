import { useState } from "react";
import { FileText, MapTrifold, TrafficCone, PencilSimpleLine, Blueprint } from "@phosphor-icons/react";
import PlanDocument from "./PlanDocument";
import TrafficMap from "./TrafficMap";
import SchematicDiagram from "./SchematicDiagram";
import ManualEditor from "./ManualEditor";
import DrawingSheet from "./DrawingSheet";

function buildTabs(hasPlan) {
  const tabs = [
    ["editor", "Drafting Editor", PencilSimpleLine],
    ["drawing", "Drawing Sheet", Blueprint],
  ];
  if (hasPlan) {
    tabs.push(["plan", "Plan Document", FileText]);
    tabs.push(["layout", "Layout Diagram", TrafficCone]);
    tabs.push(["map", "ATOM Map View", MapTrifold]);
  }
  return tabs;
}

function SheetTabs({ sheets, sheetIdx, onSelect }) {
  if (sheets.length < 2) return null;
  return (
    <div className="flex border border-black/15 rounded-sm w-fit mb-4 overflow-hidden" data-testid="sheet-tabs">
      {sheets.map((s, i) => (
        <button key={`tc-${s.sheet_title || s.layout_title || i}`} data-testid={`sheet-tab-${i}`} onClick={() => onSelect(i)}
          className={`px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${sheetIdx === i ? "bg-[#FF5F15] text-black font-bold" : "bg-white text-zinc-600 hover:text-black"}`}>
          TC-{i + 1}{s.sheet_title ? ` · ${s.sheet_title.slice(0, 24)}` : ""}
        </button>
      ))}
    </div>
  );
}

export default function PlanWorkspace({ job, sheets, isReviewer, onSavePlan }) {
  const [tab, setTab] = useState("editor");
  const [sheetIdx, setSheetIdx] = useState(0);
  const safeIdx = Math.min(sheetIdx, Math.max(sheets.length - 1, 0));
  const tabs = buildTabs(Boolean(job.plan));

  return (
    <>
      <div role="tablist" className="flex flex-wrap border border-black/15 rounded-sm w-fit mb-6 overflow-hidden">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${tab === k ? "bg-[#0A0A0A] text-white" : "text-zinc-600 hover:text-black bg-white"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade">
        {tab === "editor" && <ManualEditor job={job} onSavePlan={onSavePlan} />}
        {tab === "drawing" && <DrawingSheet job={job} />}
        {tab === "plan" && job.plan && <PlanDocument plan={job.plan} editable={isReviewer} onSave={onSavePlan} />}
        {tab === "layout" && job.plan && (
          <div>
            <SheetTabs sheets={sheets} sheetIdx={safeIdx} onSelect={setSheetIdx} />
            <SchematicDiagram layout={sheets[safeIdx] || null} job={job} sheetIndex={safeIdx} sheetCount={sheets.length} />
          </div>
        )}
        {tab === "map" && job.plan && <TrafficMap features={job.plan.map_features} />}
      </div>
      {job.plan && sheets.length > 0 && (
        <div style={{ position: "absolute", left: -20000, top: 0 }} aria-hidden="true">
          {sheets.map((l, i) => (
            <SchematicDiagram key={`export-${l.sheet_title || l.layout_title || i}`} layout={l} job={job} svgId={`layout-svg-export-${i}`} sheetIndex={i} sheetCount={sheets.length} />
          ))}
        </div>
      )}
    </>
  );
}
