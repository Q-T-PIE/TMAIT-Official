import { computeLayoutGeometry } from "../lib/layoutGeometry";

const SIGN_ORANGE = "#F97316";

function Sign({ x, y, sign, side }) {
  const tx = side === "left" ? x - 30 : x + 30;
  const anchor = side === "left" ? "end" : "start";
  return (
    <g>
      <rect x={x - 13} y={y - 13} width={26} height={26} fill={SIGN_ORANGE} stroke="#111" strokeWidth="1.5" transform={`rotate(45 ${x} ${y})`} />
      <line x1={x} y1={y + 18} x2={x} y2={y + 26} stroke="#111" strokeWidth="2" />
      <text x={tx} y={y - 2} fontSize="11" fontFamily="monospace" fontWeight="bold" fill="#111" textAnchor={anchor}>{sign.designation}</text>
      <text x={tx} y={y + 10} fontSize="8" fontFamily="monospace" fill="#555" textAnchor={anchor}>{(sign.name || "").slice(0, 26)}</text>
    </g>
  );
}

function Cone({ x, y }) {
  return <circle cx={x} cy={y} r={4} fill={SIGN_ORANGE} stroke="#111" strokeWidth="1" />;
}

function Tcp({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y - 8} r={5} fill="#3B82F6" stroke="#111" strokeWidth="1" />
      <line x1={x} y1={y - 3} x2={x} y2={y + 10} stroke="#111" strokeWidth="2.5" />
      <line x1={x - 7} y1={y + 2} x2={x + 7} y2={y + 2} stroke="#111" strokeWidth="2" />
      <text x={x + 12} y={y + 4} fontSize="10" fontFamily="monospace" fontWeight="bold" fill="#111">TCP</text>
    </g>
  );
}

function DimLine({ x, y1, y2, label }) {
  if (y2 - y1 < 14) return null;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#111" strokeWidth="1" markerStart="url(#arrUp)" markerEnd="url(#arrDown)" />
      <line x1={x - 6} y1={y1} x2={x + 6} y2={y1} stroke="#111" strokeWidth="1" />
      <line x1={x - 6} y1={y2} x2={x + 6} y2={y2} stroke="#111" strokeWidth="1" />
      <text x={x + 10} y={(y1 + y2) / 2 + 3} fontSize="10" fontFamily="monospace" fill="#111">{label}</text>
    </g>
  );
}

function LaneArrow({ x, y, down }) {
  const d = down ? `M ${x} ${y} l 0 22 m -5 -7 l 5 7 l 5 -7` : `M ${x} ${y + 22} l 0 -22 m -5 7 l 5 -7 l 5 7`;
  return <path d={d} stroke="#111" strokeWidth="2" fill="none" />;
}

function Legend({ top }) {
  return (
    <g transform={`translate(18, ${top})`}>
      <rect x="0" y="0" width="146" height="118" fill="#fff" stroke="#111" strokeWidth="1" />
      <text x="8" y="16" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#111">LEGEND</text>
      <rect x="10" y="24" width="12" height="12" fill={SIGN_ORANGE} stroke="#111" transform="rotate(45 16 30)" />
      <text x="32" y="34" fontSize="8.5" fontFamily="monospace" fill="#111">Sign (BC MoTI)</text>
      <circle cx="16" cy="50" r="4" fill={SIGN_ORANGE} stroke="#111" />
      <text x="32" y="53" fontSize="8.5" fontFamily="monospace" fill="#111">Cone / delineator</text>
      <rect x="10" y="60" width="12" height="10" fill="url(#hatch)" stroke={SIGN_ORANGE} />
      <text x="32" y="69" fontSize="8.5" fontFamily="monospace" fill="#111">Work activity area</text>
      <circle cx="16" cy="83" r="4" fill="#3B82F6" stroke="#111" />
      <text x="32" y="86" fontSize="8.5" fontFamily="monospace" fill="#111">TCP (flagger)</text>
      <rect x="10" y="94" width="13" height="9" fill="#333" />
      <text x="32" y="102" fontSize="8.5" fontFamily="monospace" fill="#111">Flashing arrow board</text>
      <text x="8" y="114" fontSize="7.5" fontFamily="monospace" fill="#888">Direction of travel: ↑</text>
    </g>
  );
}

function TitleBlock({ W, H, titleH, L, job, sheetIndex, sheetCount }) {
  return (
    <g transform={`translate(0, ${H - titleH})`}>
      <rect x="10" y="0" width={W - 20} height={titleH - 10} fill="#fff" stroke="#111" strokeWidth="1.5" />
      <line x1="170" y1="0" x2="170" y2={titleH - 10} stroke="#111" strokeWidth="1" />
      <line x1={W - 250} y1="0" x2={W - 250} y2={titleH - 10} stroke="#111" strokeWidth="1" />
      <text x="24" y="30" fontSize="16" fontFamily="monospace" fontWeight="bold" fill="#111">TMAIT</text>
      <text x="24" y="46" fontSize="8" fontFamily="monospace" fill="#666">A.T.O.M · BC TMM 2020</text>
      <text x="182" y="24" fontSize="11" fontFamily="monospace" fontWeight="bold" fill="#111">{(L.layout_title || "Traffic Control Layout").slice(0, 60)}</text>
      <text x="182" y="40" fontSize="8.5" fontFamily="monospace" fill="#555">{(L.reference_layout || "").slice(0, 80)}</text>
      <text x="182" y="56" fontSize="8.5" fontFamily="monospace" fill="#555">{(L.road_name || job?.location || "").slice(0, 50)} · {L.direction_of_travel || ""} · {L.posted_speed || job?.speed_limit} km/h</text>
      <text x={W - 238} y="24" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#111">NOT TO SCALE</text>
      <text x={W - 238} y="40" fontSize="8.5" fontFamily="monospace" fill="#555">{new Date().toLocaleDateString()}</text>
      <text x={W - 238} y="56" fontSize="8.5" fontFamily="monospace" fill="#555">Sheet TC-{sheetIndex + 1} of {Math.max(sheetCount, 1)}</text>
    </g>
  );
}

export default function SchematicDiagram({ layout, job, svgId = "layout-svg", sheetIndex = 0, sheetCount = 1 }) {
  const L = layout;
  if (!L) {
    return (
      <div data-testid="layout-missing-state" className="border border-black/10 bg-white rounded-sm p-8 max-w-2xl">
        <p className="font-heading text-lg font-bold text-[#0A0A0A] mb-2">Layout diagram not available for this plan</p>
        <p className="text-sm text-zinc-500 font-body">This plan was generated before the TMM layout engine was added. Click <span className="font-mono text-xs uppercase text-[#FF5F15]">Regenerate Plan</span> to produce the schematic traffic control layout.</p>
      </div>
    );
  }

  const {
    A, B, LM, LD, WA, lanes, twoWay, oppLanes, closedLeft, closedCount, upSigns, downSigns,
    laneW, roadW, W, H, roadL, roadR, pavL, pavR, top, yLDtop, yWorkTop, yBufTop, yTaperTop,
    yTaperBot, yBot, titleH, zWork, closEdgeX, signSideDefault, signX, dimX,
    taperCones, edgeCones, ldCones, workL, workR, zones,
  } = computeLayoutGeometry(L, job);

  return (
    <div data-testid="schematic-diagram" className="max-w-4xl">
      <svg id={svgId} viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", background: "#fff", border: "1px solid rgba(0,0,0,0.15)" }}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#FFF3EA" />
            <line x1="0" y1="0" x2="0" y2="8" stroke={SIGN_ORANGE} strokeWidth="2" />
          </pattern>
          <marker id="arrDown" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto-start-reverse">
            <path d="M1,1 L4,7 L7,1" fill="none" stroke="#111" strokeWidth="1" />
          </marker>
          <marker id="arrUp" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto">
            <path d="M1,1 L4,7 L7,1" fill="none" stroke="#111" strokeWidth="1" />
          </marker>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="#fff" />

        {/* road */}
        <rect x={roadL} y={top} width={roadW} height={yBot - top} fill="#E8E8E8" />
        <rect x={pavL} y={top} width={pavR - pavL} height={yBot - top} fill="#F7F7F7" stroke="#111" strokeWidth="1.5" />
        {Array.from({ length: lanes - 1 }, (_, i) => {
          const x = pavL + (i + 1) * laneW;
          const isCentre = twoWay && i + 1 === oppLanes;
          return isCentre
            ? <line key={`lane-${x}`} x1={x} y1={top} x2={x} y2={yBot} stroke="#EAB308" strokeWidth="3" />
            : <line key={`lane-${x}`} x1={x} y1={top} x2={x} y2={yBot} stroke="#999" strokeWidth="1.5" strokeDasharray="14 12" />;
        })}

        {/* lane direction arrows */}
        {Array.from({ length: lanes }, (_, i) => {
          const cx = pavL + i * laneW + laneW / 2;
          const opposing = twoWay && i < oppLanes;
          const isClosed = closedLeft ? i < closedCount : i >= lanes - closedCount;
          if (isClosed) return null;
          return <LaneArrow key={`arrow-${cx}`} x={cx} y={opposing ? top + 18 : yBot - 45} down={opposing} />;
        })}

        {/* zone labels left */}
        {zones.map(([t, y]) => (
          <text key={t} x={roadL - 24} y={y} fontSize="9" fontFamily="monospace" fill="#888" textAnchor="end" transform={`rotate(-90 ${roadL - 24} ${y})`}>{t}</text>
        ))}

        {/* cones */}
        {taperCones.map((c) => <Cone key={`t-${c.x.toFixed(1)}-${c.y.toFixed(1)}`} {...c} />)}
        {edgeCones.map((c) => <Cone key={`e-${c.x.toFixed(1)}-${c.y.toFixed(1)}`} {...c} />)}
        {ldCones.map((c) => <Cone key={`d-${c.x.toFixed(1)}-${c.y.toFixed(1)}`} {...c} />)}

        {/* work area */}
        <rect x={workL} y={yWorkTop + 8} width={workR - workL} height={zWork - 16} fill="url(#hatch)" stroke={SIGN_ORANGE} strokeWidth="2" />
        <text x={(workL + workR) / 2} y={yWorkTop + zWork / 2 - 16} fontSize="11" fontFamily="monospace" fontWeight="bold" fill="#B45309" textAnchor="middle" transform={`rotate(-90 ${(workL + workR) / 2} ${yWorkTop + zWork / 2})`}>WORK AREA</text>

        {/* work vehicle + arrow board */}
        {L.arrow_board !== false && (
          <g>
            <rect x={(workL + workR) / 2 - 16} y={yBufTop - 34} width={32} height={26} fill="#333" stroke="#111" strokeWidth="1" />
            <path d={`M ${(workL + workR) / 2 - 9} ${yBufTop - 21} h 12 m -5 -5 l 6 5 l -6 5`} stroke="#FDE047" strokeWidth="2" fill="none" transform={closedLeft ? `scale(-1,1) translate(${-(workL + workR)},0)` : undefined} />
            <text x={(workL + workR) / 2} y={yBufTop + 4} fontSize="8" fontFamily="monospace" fill="#555" textAnchor="middle">FAB</text>
          </g>
        )}

        {/* TCPs */}
        {(L.tcp_flaggers || 0) >= 1 && <Tcp x={closEdgeX + (closedLeft ? -34 : 20)} y={yTaperBot + 16} />}
        {(L.tcp_flaggers || 0) >= 2 && <Tcp x={pavL - 44} y={top + 40} />}

        {/* upstream signs (farthest first => lowest) */}
        {upSigns.map((s, i) => {
          const side = s.side === "both" ? signSideDefault : (s.side || signSideDefault);
          const y = yBot - 42 - i * 85;
          return <Sign key={`up-${s.designation}-${i}`} x={signX(side)} y={y} sign={s} side={side} />;
        })}
        {/* downstream signs */}
        {downSigns.map((s, i) => {
          const side = s.side || signSideDefault;
          return <Sign key={`down-${s.designation}-${i}`} x={signX(side)} y={top + 34 + i * 50} sign={s} side={side} />;
        })}

        {/* dimensions */}
        {upSigns.length > 1 && <DimLine x={dimX} y1={yBot - 42 - (upSigns.length - 1) * 85} y2={yBot - 42} label={`A = ${A} m`} />}
        <DimLine x={dimX} y1={yTaperTop} y2={yTaperBot} label={`LM = ${LM} m`} />
        <DimLine x={dimX} y1={yBufTop} y2={yTaperTop} label={`B = ${B} m`} />
        <DimLine x={dimX} y1={yWorkTop} y2={yBufTop} label={`${WA} m`} />
        <DimLine x={dimX} y1={yLDtop} y2={yWorkTop} label={`LD = ${LD} m`} />

        {/* legend + title block */}
        <Legend top={top} />
        <TitleBlock W={W} H={H} titleH={titleH} L={L} job={job} sheetIndex={sheetIndex} sheetCount={sheetCount} />
      </svg>
      {L.notes && <p className="font-mono text-[11px] text-zinc-500 mt-2">NOTE: {L.notes}</p>}
    </div>
  );
}
