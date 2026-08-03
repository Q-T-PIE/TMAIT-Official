export function computeLayoutGeometry(L, job) {
  const dims = L.dimensions || {};
  const A = dims.sign_spacing_A_m || 40;
  const B = dims.buffer_B_m || 30;
  const LM = dims.merge_taper_LM_m || 35;
  const LD = dims.downstream_taper_LD_m || 15;
  const WA = dims.work_area_length_m || 60;
  const lanes = Math.max(1, Math.min(8, L.lanes || job?.lanes_total || 2));
  const twoWay = !!L.two_way;
  const oppLanes = twoWay ? Math.max(1, Math.floor(lanes / 2)) : 0;
  const closedLeft = !twoWay && L.closed_side === "left";
  const maxClosable = Math.max(1, lanes - oppLanes);
  const closedCount = Math.min(Math.max(1, L.closed_lanes_count || 1), maxClosable);
  const upSigns = (L.upstream_signs || []).slice(0, 6);
  const downSigns = (L.downstream_signs || []).slice(0, 2);

  const laneW = 56, shW = 20;
  const roadW = lanes * laneW + shW * 2;
  const leftM = 200, rightM = 210;
  const W = leftM + roadW + rightM;
  const roadL = leftM, roadR = leftM + roadW;
  const pavL = roadL + shW, pavR = roadR - shW;

  const zTerm = 95, zLD = 55, zWork = 160, zBuf = 75, zTaper = 130;
  const zApproach = Math.max(2, upSigns.length) * 85 + 30;
  const top = 60;
  const yLDtop = top + zTerm;
  const yWorkTop = yLDtop + zLD;
  const yBufTop = yWorkTop + zWork;
  const yTaperTop = yBufTop + zBuf;
  const yTaperBot = yTaperTop + zTaper;
  const yBot = yTaperBot + zApproach;
  const titleH = 84;
  const H = yBot + 50 + titleH;

  const closBoundX = closedLeft ? pavL + closedCount * laneW : pavR - closedCount * laneW;
  const closEdgeX = closedLeft ? pavL : pavR;
  const signSideDefault = closedLeft ? "left" : "right";
  const signX = (side) => (side === "left" ? roadL - 24 : roadR + 24);
  const dimX = roadR + 118;

  const taperCones = [];
  for (let i = 0; i <= 6; i++) {
    taperCones.push({ x: closEdgeX + (closBoundX - closEdgeX) * (i / 6), y: yTaperBot - zTaper * (i / 6) });
  }
  const edgeCones = [];
  for (let y = yTaperTop - 14; y > yWorkTop + 6; y -= 26) edgeCones.push({ x: closBoundX, y });
  const ldCones = [];
  for (let i = 0; i <= 3; i++) ldCones.push({ x: closBoundX + (closEdgeX - closBoundX) * (i / 3), y: yWorkTop - zLD * ((3 - i) / 3) });

  const workL = Math.min(closBoundX, closEdgeX) + 6;
  const workR = Math.max(closBoundX, closEdgeX) - 6;

  const zones = [
    ["ADVANCE WARNING", (yTaperBot + yBot) / 2],
    ["TRANSITION (TAPER)", (yTaperTop + yTaperBot) / 2],
    ["BUFFER", (yBufTop + yTaperTop) / 2],
    ["WORK ACTIVITY AREA", (yWorkTop + yBufTop) / 2],
    ["TERMINATION", (top + yLDtop) / 2],
  ];

  return {
    A, B, LM, LD, WA, lanes, twoWay, oppLanes, closedLeft, closedCount, upSigns, downSigns,
    laneW, roadW, W, H, roadL, roadR, pavL, pavR, top, yLDtop, yWorkTop, yBufTop, yTaperTop,
    yTaperBot, yBot, titleH, zWork, closBoundX, closEdgeX, signSideDefault, signX, dimX,
    taperCones, edgeCones, ldCones, workL, workR, zones,
  };
}
