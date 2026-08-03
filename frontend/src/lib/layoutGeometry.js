function extractDims(L) {
  const dims = L.dimensions || {};
  return {
    A: dims.sign_spacing_A_m || 40,
    B: dims.buffer_B_m || 30,
    LM: dims.merge_taper_LM_m || 35,
    LD: dims.downstream_taper_LD_m || 15,
    WA: dims.work_area_length_m || 60,
  };
}

function laneConfig(L, job) {
  const lanes = Math.max(1, Math.min(8, L.lanes || job?.lanes_total || 2));
  const twoWay = !!L.two_way;
  const oppLanes = twoWay ? Math.max(1, Math.floor(lanes / 2)) : 0;
  const closedLeft = !twoWay && L.closed_side === "left";
  const maxClosable = Math.max(1, lanes - oppLanes);
  const closedCount = Math.min(Math.max(1, L.closed_lanes_count || 1), maxClosable);
  return { lanes, twoWay, oppLanes, closedLeft, closedCount };
}

function horizontalFrame(lanes) {
  const laneW = 56, shW = 20;
  const roadW = lanes * laneW + shW * 2;
  const leftM = 200, rightM = 210;
  const roadL = leftM, roadR = leftM + roadW;
  return { laneW, roadW, W: leftM + roadW + rightM, roadL, roadR, pavL: roadL + shW, pavR: roadR - shW };
}

function verticalFrame(upSignCount) {
  const zTerm = 95, zLD = 55, zWork = 160, zBuf = 75, zTaper = 130;
  const zApproach = Math.max(2, upSignCount) * 85 + 30;
  const top = 60;
  const yLDtop = top + zTerm;
  const yWorkTop = yLDtop + zLD;
  const yBufTop = yWorkTop + zWork;
  const yTaperTop = yBufTop + zBuf;
  const yTaperBot = yTaperTop + zTaper;
  const yBot = yTaperBot + zApproach;
  const titleH = 84;
  return { zWork, zLD, zTaper, top, yLDtop, yWorkTop, yBufTop, yTaperTop, yTaperBot, yBot, titleH, H: yBot + 50 + titleH };
}

function buildCones(v, closEdgeX, closBoundX) {
  const taperCones = [];
  for (let i = 0; i <= 6; i++) {
    taperCones.push({ x: closEdgeX + (closBoundX - closEdgeX) * (i / 6), y: v.yTaperBot - v.zTaper * (i / 6) });
  }
  const edgeCones = [];
  for (let y = v.yTaperTop - 14; y > v.yWorkTop + 6; y -= 26) edgeCones.push({ x: closBoundX, y });
  const ldCones = [];
  for (let i = 0; i <= 3; i++) ldCones.push({ x: closBoundX + (closEdgeX - closBoundX) * (i / 3), y: v.yWorkTop - v.zLD * ((3 - i) / 3) });
  return { taperCones, edgeCones, ldCones };
}

function zoneLabels(v) {
  return [
    ["ADVANCE WARNING", (v.yTaperBot + v.yBot) / 2],
    ["TRANSITION (TAPER)", (v.yTaperTop + v.yTaperBot) / 2],
    ["BUFFER", (v.yBufTop + v.yTaperTop) / 2],
    ["WORK ACTIVITY AREA", (v.yWorkTop + v.yBufTop) / 2],
    ["TERMINATION", (v.top + v.yLDtop) / 2],
  ];
}

export function computeLayoutGeometry(L, job) {
  const d = extractDims(L);
  const lc = laneConfig(L, job);
  const upSigns = (L.upstream_signs || []).slice(0, 6);
  const downSigns = (L.downstream_signs || []).slice(0, 2);
  const h = horizontalFrame(lc.lanes);
  const v = verticalFrame(upSigns.length);

  const closBoundX = lc.closedLeft ? h.pavL + lc.closedCount * h.laneW : h.pavR - lc.closedCount * h.laneW;
  const closEdgeX = lc.closedLeft ? h.pavL : h.pavR;
  const signSideDefault = lc.closedLeft ? "left" : "right";
  const signX = (side) => (side === "left" ? h.roadL - 24 : h.roadR + 24);
  const cones = buildCones(v, closEdgeX, closBoundX);

  return {
    ...d, ...lc, ...h, ...v, ...cones,
    upSigns, downSigns, closBoundX, closEdgeX, signSideDefault, signX,
    dimX: h.roadR + 118,
    workL: Math.min(closBoundX, closEdgeX) + 6,
    workR: Math.max(closBoundX, closEdgeX) - 6,
    zones: zoneLabels(v),
  };
}
