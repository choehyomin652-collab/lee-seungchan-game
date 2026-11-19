// ============================================================
//  tiers.js — 티어 (아이언 → 챌린저) · 영토 점수 · 티어 문장 그림
//  · 영토 점수(rec.pts)로 티어를 정해요. 아이언 ~ 다이아몬드는 IV → I 단계가 있고, 한 단계가 100점
//    마스터(2800) · 그랜드마스터(3200) · 챌린저(3600) 는 단계 없이 점수만 쌓여요
//  · 높은 티어일수록 이겨도 점수가 덜 오르고, 지면 더 많이 내려가요 (GAIN_K · LOSS_K)
//  · 문장 그림은 SVG 로 직접 그려요: 티어가 오를수록 날개 · 뿔 · 가시가 하나씩 늘고 빛이 세져요
// ============================================================
"use strict";
const TIERS = [
  { n: "아이언", c1: "#2a2624", c2: "#6a625e", hi: "#a8a09a", gem: "#7a7470" },
  { n: "브론즈", c1: "#5e3420", c2: "#c07a4e", hi: "#ffc39a", gem: "#e88a5a" },
  { n: "실버", c1: "#4a5664", c2: "#b8c6d4", hi: "#f2f7ff", gem: "#cfe0ff" },
  { n: "골드", c1: "#6e4610", c2: "#e8b452", hi: "#fff0b8", gem: "#ffd25a" },
  { n: "플래티넘", c1: "#124a58", c2: "#5cc6d8", hi: "#c8faff", gem: "#7ff0ff" },
  { n: "에메랄드", c1: "#0a4428", c2: "#3ccb78", hi: "#b8ffd4", gem: "#5affa0" },
  { n: "다이아몬드", c1: "#232e78", c2: "#7a96f0", hi: "#dbe6ff", gem: "#9ad0ff" },
  { n: "마스터", c1: "#46145e", c2: "#bb6af0", hi: "#f2d0ff", gem: "#e08aff" },
  { n: "그랜드마스터", c1: "#3a0608", c2: "#d83a2a", hi: "#ffb090", gem: "#ff6a2a" },
  { n: "챌린저", c1: "#5a4618", c2: "#f0cc6a", hi: "#fff6d0", gem: "#7fe4ff" },
];
const DIV_NAME = ["", "I", "II", "III", "IV"];
const MASTER_AT = 2800; // 다이아몬드 I 위 = 마스터
const TOP_AT = [2800, 3200, 3600]; // 마스터 · 그랜드마스터 · 챌린저
// 등수별 기본 점수 (1~4등 오르고 5~8등 내려가요) × 티어별 배율
const PLACE_PTS = [0, 50, 38, 26, 14, -8, -18, -28, -38];
const GAIN_K = [1.6, 1.45, 1.3, 1.1, 0.95, 0.85, 0.75, 0.62, 0.55, 0.5];
const LOSS_K = [0.4, 0.55, 0.7, 0.85, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
// 지금 점수의 티어: i(티어 번호) · div(4~1, 마스터부터 0) · name · lp(단계 안 점수) · lo/hi(이 단계 범위, 꼭대기는 hi 없음)
function tierOf(pts) {
  pts = Math.max(0, Math.floor(+pts || 0));
  if (pts < MASTER_AT) {
    const step = Math.floor(pts / 100), i = Math.floor(step / 4), div = 4 - (step % 4), lo = step * 100;
    return { i, div, name: `${TIERS[i].n} ${DIV_NAME[div]}`, lp: pts - lo, lo, hi: lo + 100, step };
  }
  const k = pts >= TOP_AT[2] ? 2 : pts >= TOP_AT[1] ? 1 : 0, i = 7 + k;
  return { i, div: 0, name: TIERS[i].n, lp: pts - MASTER_AT, lo: TOP_AT[k], hi: TOP_AT[k + 1] || null, step: 28 + k };
}
// 이번 판 점수 변화: 낮은 티어는 잘 오르고 덜 내려가요, 높은 티어는 반대
function placeDelta(pts, place) {
  const b = PLACE_PTS[place] || 0, t = tierOf(pts).i;
  const d = Math.round(b * (b > 0 ? GAIN_K[t] : LOSS_K[t]));
  return Math.max(-pts, b > 0 ? Math.max(1, d) : d);
}
// ---------- 문장 그림 (SVG) ----------
// 티어마다 모양이 완전히 달라요 (EM_DESIGN). 칼날 하나하나는 금속처럼: 밝은 윗면 · 어두운 아랫면 · 반사 띠 · 능선 하이라이트 · 아래 두께(그림자)
// 칼날 모양(prof): b 칼날 · s 둥근 깃 · l 나뭇잎 · c 수정(각진) · j 톱니  /  가운데(x=100)에서 시작해 x=100 에서 끝나는 칼날은 거울 없이 하나만
const BODY = [100, 134, 128, 140, 158, 114, 56, "b"];
const EM_DESIGN = [
  { // 아이언: 작고 투박한 쇳조각, 빛 없음
    sh: 0.15, gem: 0.7, dull: 1, glow: 0, spk: 0,
    bl: [[102, 124, 130, 126, 156, 106, 24, "b"], [100, 136, 120, 142, 140, 128, 32, "b"]] },
  { // 브론즈: 아래로 처졌다 올라가는 박쥐 날개
    sh: 0.4, gem: 0.8, glow: 0.12, spk: 0,
    bl: [[104, 120, 146, 140, 176, 92, 32, "b"], [106, 108, 126, 104, 142, 82, 16, "b"], BODY] },
  { // 실버: 뒤로 날렵하게 넘긴 깃 세 장
    sh: 0.95, gem: 0.85, glow: 0.18, spk: 1,
    bl: [[104, 128, 146, 140, 182, 112, 18, "b"], [106, 106, 140, 96, 174, 56, 18, "b"], [104, 116, 150, 118, 192, 76, 26, "b"], BODY] },
  { // 골드: 둥근 깃 날개 + 작은 왕관
    sh: 0.85, gem: 0.95, glow: 0.28, spk: 2,
    bl: [[104, 132, 146, 148, 184, 120, 30, "s"], [104, 116, 140, 106, 178, 70, 40, "s"], [92, 102, 86, 92, 80, 76, 13, "s"], [100, 100, 100, 88, 100, 68, 16, "s"], BODY] },
  { // 플래티넘: 각진 수정 조각이 위로 솟아요
    sh: 0.95, gem: 1, glow: 0.32, spk: 2,
    bl: [[104, 130, 140, 140, 172, 126, 22, "c"], [104, 118, 150, 110, 192, 66, 34, "c"], [108, 104, 124, 84, 138, 36, 20, "c"], [100, 102, 100, 70, 100, 30, 20, "c"], BODY] },
  { // 에메랄드: 나뭇잎 날개 + 가운데 새싹
    sh: 0.7, gem: 1, glow: 0.36, spk: 2,
    bl: [[104, 132, 146, 152, 188, 130, 26, "l"], [104, 118, 146, 100, 188, 74, 40, "l"], [106, 106, 122, 78, 146, 44, 26, "l"], [100, 102, 100, 76, 100, 44, 22, "l"], BODY] },
  { // 다이아몬드: 큰 수정이 부채처럼 솟고 보석이 커요
    sh: 0.95, gem: 1.18, glow: 0.42, spk: 3,
    bl: [[104, 132, 150, 148, 190, 122, 22, "c"], [104, 118, 150, 116, 196, 72, 34, "c"], [108, 106, 140, 80, 168, 32, 24, "c"], [112, 100, 120, 64, 124, 22, 18, "c"], [100, 98, 100, 60, 100, 10, 24, "c"], BODY] },
  { // 마스터: 불꽃처럼 말려 올라가는 날개 + 뿔
    sh: 0.75, gem: 1.05, glow: 0.48, spk: 3, halo: 1,
    bl: [[104, 132, 150, 150, 186, 126, 24, "b"], [104, 118, 176, 132, 184, 58, 38, "b"], [108, 106, 164, 96, 150, 36, 26, "b"], [106, 96, 130, 58, 112, 20, 18, "b"], BODY] },
  { // 그랜드마스터: 톱니 달린 악마 날개가 옆 · 아래로, 안으로 휜 뿔
    sh: 0.6, gem: 1.05, glow: 0.5, spk: 3, halo: 1,
    bl: [[104, 132, 140, 156, 168, 160, 20, "b"], [104, 116, 150, 100, 199, 114, 40, "j"], [108, 104, 150, 76, 194, 50, 28, "j"], [112, 98, 128, 62, 104, 26, 18, "b"], BODY] },
  { // 챌린저: 금빛 + 하늘빛 두 겹 날개, 수정 왕관, 뒤에 빛 고리
    sh: 1, gem: 1.2, glow: 0.58, spk: 4, halo: 2,
    bl: [[102, 142, 136, 164, 166, 162, 16, "b", 1], [104, 132, 150, 150, 192, 124, 26, "b"], [106, 106, 146, 84, 182, 38, 26, "b", 1], [104, 118, 152, 118, 196, 70, 40, "b"], [92, 102, 82, 82, 74, 54, 14, "c", 1], [100, 98, 100, 64, 100, 18, 22, "c"], BODY] },
];
const f1 = (v) => v.toFixed(1);
// 휜 칼날 하나 (아래 두께 그림자 → 아랫면 → 윗면 → 테두리 → 능선 하이라이트 → 반사 홈)
function bladeSvg(x0, y0, cx, cy, x1, y1, w, prof, G, mir, sh) {
  const N = prof === "c" ? 4 : prof === "j" ? 12 : 16, up = [], dn = [], mid = [], groove = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, a = 1 - t;
    const x = a * a * x0 + 2 * a * t * cx + t * t * x1, y = a * a * y0 + 2 * a * t * cy + t * t * y1;
    let dx = 2 * a * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * a * (cy - y0) + 2 * t * (y1 - cy); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    let nx = -dy, ny = dx; if (ny > 0 || (Math.abs(ny) < 1e-6 && nx > 0)) { nx = -nx; ny = -ny; }
    let h = (w / 2) * (prof === "l" ? Math.max(Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.7), 0.4 * a) : prof === "s" ? Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.4))) : Math.pow(a, 0.62));
    if (k === N) h = 0;
    const hd = prof === "j" && k > 1 && k < N - 1 && k % 2 ? h * 1.7 : h; // 톱니: 아랫면이 뾰족뾰족
    up.push([x + nx * h, y + ny * h]); dn.push([x - nx * hd, y - ny * hd]); mid.push([x, y]); groove.push([x + nx * h * 0.45, y + ny * h * 0.45]);
  }
  const M = (pts, oy = 0) => pts.map(([x, y]) => `${f1(mir ? 200 - x : x)} ${f1(y + oy)}`).join(" L");
  const outline = (oy) => `M${M(up, oy)} L${M(dn.slice().reverse(), oy)}Z`;
  const face = (side, fill) => `<path d="M${M(mid)} L${M(side.slice().reverse())}Z" fill="${fill}"/>`;
  return `<path d="${outline(3.2)}" fill="#000" opacity=".55"/>${face(dn, `url(#${G}d)`)}${face(up, `url(#${G}u)`)}
    <path d="${outline(0)}" fill="none" stroke="var(--te)" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M${M(mid.slice(0, -1))}" fill="none" stroke="#fff" stroke-width="1.1" stroke-opacity="${(0.35 + sh * 0.55).toFixed(2)}" stroke-linecap="round"/>
    <path d="M${M(groove.slice(1, -2))}" fill="none" stroke="#fff" stroke-width=".7" stroke-opacity="${(sh * 0.45).toFixed(2)}" stroke-linecap="round"/>`;
}
const sparkle = (x, y, r, o) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`;
// 금속 결: 윗면은 밝게 시작해 반사 띠가 한 번 더 지나가고, 아랫면은 어둡게 + 약한 반사 (광택 sh 가 높을수록 띠가 또렷)
const metalGrad = (id, T, sh, top) => top
  ? `<linearGradient id="${id}" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="${T.hi}"/><stop offset=".28" stop-color="${T.c2}"/><stop offset=".46" stop-color="${T.hi}" stop-opacity="${(0.25 + sh * 0.75).toFixed(2)}"/><stop offset=".5" stop-color="${T.c2}"/><stop offset=".78" stop-color="${T.c1}"/><stop offset="1" stop-color="${T.c2}"/></linearGradient>`
  : `<linearGradient id="${id}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${T.c2}"/><stop offset=".3" stop-color="${T.c1}"/><stop offset=".62" stop-color="${T.c2}" stop-opacity="${(0.3 + sh * 0.5).toFixed(2)}"/><stop offset=".7" stop-color="${T.c1}"/><stop offset="1" stop-color="#050505"/></linearGradient>`;
let EM_UID = 0;
function tierEmblem(i, cls) {
  const T = TIERS[i], D = EM_DESIGN[i], G = "te" + i + "_" + EM_UID++, A = { n: T.n, c1: "#0e3a5a", c2: "#4fb8f0", hi: "#e4f8ff" };
  const blade = ([x0, y0, cx, cy, x1, y1, w, prof, acc]) => {
    const g = acc ? G + "x" : G, one = x0 === 100 && x1 === 100;
    return (one ? "" : bladeSvg(x0, y0, cx, cy, x1, y1, w, prof, g, true, D.sh)) + bladeSvg(x0, y0, cx, cy, x1, y1, w, prof, g, false, D.sh);
  };
  const gc = i === 9 ? "#7fe4ff" : T.gem, s = D.gem;
  const P = (pts) => pts.map(([x, y]) => `${f1(100 + x * s)} ${f1(120 + y * s)}`).join(" L"); // 보석은 (100,120) 기준 크기 s
  const spk = [[44, 50, 7], [160, 38, 6], [58, 148, 5], [148, 152, 6]].slice(0, D.spk).map(([x, y, r], k) => sparkle(x, y, r + (i >= 8 ? 2 : 0), k % 2 ? 0.7 : 0.95)).join("");
  const halo = D.halo ? `<circle cx="100" cy="104" r="${D.halo > 1 ? 66 : 58}" fill="none" stroke="${D.halo > 1 ? "#ffe08a" : T.gem}" stroke-width="${D.halo > 1 ? 3 : 2}" stroke-opacity=".55"/>${D.halo > 1 ? `<circle cx="100" cy="104" r="74" fill="none" stroke="#7fe4ff" stroke-width="1.5" stroke-opacity=".45" stroke-dasharray="3 6"/>` : ""}` : "";
  return `<svg class="temb ${cls || ""}" viewBox="0 0 200 170" role="img" aria-label="${T.n}" style="--tg:${T.gem};--th:${T.hi};--te:${i === 8 ? "#1a0404" : T.c1}">
    <defs>${metalGrad(G + "u", T, D.sh, 1)}${metalGrad(G + "d", T, D.sh, 0)}${metalGrad(G + "xu", A, 1, 1)}${metalGrad(G + "xd", A, 1, 0)}
      <radialGradient id="${G}h" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="${T.gem}" stop-opacity="${D.glow}"/><stop offset=".6" stop-color="${T.gem}" stop-opacity="${(D.glow * 0.35).toFixed(2)}"/><stop offset="1" stop-color="${T.gem}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${G}g" cx=".42" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity="${D.dull ? 0.5 : 1}"/><stop offset=".3" stop-color="${gc}"/><stop offset="1" stop-color="${T.c1}"/></radialGradient>
    </defs>
    ${D.glow ? `<ellipse cx="100" cy="106" rx="100" ry="70" fill="url(#${G}h)"/>` : ""}${halo}
    ${D.bl.map(blade).join("")}
    <path d="M${P([[0, -36], [32, 0], [0, 44], [-32, 0]])}Z" fill="url(#${G}d)" stroke="var(--te)" stroke-width="1.3"/>
    <path d="M${P([[0, -36], [32, 0], [0, 0]])}Z" fill="url(#${G}u)"/><path d="M${P([[0, -36], [-32, 0], [0, 0]])}Z" fill="${T.hi}" opacity=".8"/>
    <path d="M${P([[0, 44], [-32, 0], [0, 0]])}Z" fill="${T.c1}" opacity=".55"/>
    <path d="M${P([[0, -25], [21, 0], [0, 29], [-21, 0]])}Z" fill="url(#${G}g)" stroke="${T.hi}" stroke-width="1.2"/>
    <path d="M${P([[0, -25], [21, 0], [0, -6]])}Z" fill="#fff" opacity="${D.dull ? 0.12 : 0.35}"/><path d="M${P([[0, -25], [-21, 0], [0, -6]])}Z" fill="#fff" opacity="${D.dull ? 0.25 : 0.6}"/>
    <path d="M${P([[-21, 0], [0, 29], [0, 7]])}Z" fill="#000" opacity=".2"/><path d="M${P([[21, 0], [0, 29], [0, 7]])}Z" fill="#000" opacity=".34"/>
    ${D.dull ? "" : sparkle(f1(100 - 7 * s), f1(108), 5 * s, 0.95)}${spk}
  </svg>`;
}
// 영토 티어 배지: 문장 · 티어 이름 · 점수 · 다음 단계까지 막대 (시작 화면 카드 · 결과 화면 · 내 계정). 누르면 티어표
function rankBadge(pts) {
  const r = tierOf(pts), top = !r.hi, pct = top ? 100 : Math.round(((pts - r.lo) / (r.hi - r.lo)) * 100);
  const next = top ? "" : r.i >= 7 ? `${TIERS[r.i + 1].n}까지 ${r.hi - pts}점` : `${r.div > 1 ? `${TIERS[r.i].n} ${DIV_NAME[r.div - 1]}` : r.i < 6 ? `${TIERS[r.i + 1].n} IV` : "마스터"}까지 ${r.hi - pts}점`;
  return `<button type="button" class="rankb tier t${r.i}" data-tiers="1" aria-label="${r.name} ${r.lp}점, 티어표 보기">${tierEmblem(r.i)}<span class="rt"><b>${r.name} <em>${r.lp}점</em></b><small>${top ? "가장 높은 티어예요" : next}</small><span class="rbar"><i style="width:${pct}%"></i></span></span></button>`;
}
// 티어표: 10개 문장 + 등수별 점수 (지금 티어 기준)
function showTierTable() {
  const pts = loadRecord().pts, r = tierOf(pts);
  const row = (k, lbl) => `<tr><th>${lbl}</th>${[1, 2, 3, 4, 5, 6, 7, 8].map((pl) => { const b = PLACE_PTS[pl], d = Math.round(b * (b > 0 ? GAIN_K[k] : LOSS_K[k])); return `<td class="${d > 0 ? "up" : "down"}">${d > 0 ? "+" + Math.max(1, d) : d}</td>`; }).join("")}</tr>`;
  acctModal(`<h2>티어</h2><p class="acsub">지금: <b>${r.name}</b> · 영토 점수 ${pts}</p>
    <div class="tiergrid">${TIERS.map((T, i) => `<div class="tcell${i === r.i ? " me" : ""}">${tierEmblem(i, "big")}<b>${T.n}</b><small>${i < 7 ? `${i * 400}점부터` : `${TOP_AT[i - 7]}점부터`}</small></div>`).join("")}</div>
    <p class="acsub">아이언 ~ 다이아몬드는 IV → III → II → I 단계 (한 단계 100점). 높은 티어일수록 덜 오르고 더 많이 내려가요</p>
    <div class="tptwrap"><table class="tpts"><thead><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<th>${p}등</th>`).join("")}</tr></thead>
    <tbody>${[0, 3, 6, 9].map((k) => row(k, TIERS[k].n)).join("")}</tbody></table></div>`);
}
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-tiers]"); if (b) showTierTable(); });
