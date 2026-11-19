// ============================================================
//  tiers.js — 티어 (아이언 → 챌린저) · 영토 점수 · 티어 문장 그림
//  · 영토 점수(rec.pts)로 티어를 정해요. 아이언 ~ 다이아몬드는 IV → I 단계가 있고, 한 단계가 100점
//    마스터(2800) · 그랜드마스터(3200) · 챌린저(3600) 는 단계 없이 점수만 쌓여요
//  · 높은 티어일수록 이겨도 점수가 덜 오르고, 지면 더 많이 내려가요 (GAIN_K · LOSS_K)
//  · 문장 그림은 SVG 로 직접 그려요: 티어가 오를수록 날개 · 뿔 · 가시가 하나씩 늘고 빛이 세져요
// ============================================================
"use strict";
const TIERS = [
  { n: "아이언", c1: "#3e3330", c2: "#8c7c74", hi: "#c9b8ae", gem: "#9a8a82" },
  { n: "브론즈", c1: "#5e3420", c2: "#c07a4e", hi: "#ffc39a", gem: "#e88a5a" },
  { n: "실버", c1: "#4a5664", c2: "#b8c6d4", hi: "#f2f7ff", gem: "#cfe0ff" },
  { n: "골드", c1: "#6e4610", c2: "#e8b452", hi: "#fff0b8", gem: "#ffd25a" },
  { n: "플래티넘", c1: "#124a58", c2: "#5cc6d8", hi: "#c8faff", gem: "#7ff0ff" },
  { n: "에메랄드", c1: "#0a4428", c2: "#3ccb78", hi: "#b8ffd4", gem: "#5affa0" },
  { n: "다이아몬드", c1: "#232e78", c2: "#7a96f0", hi: "#dbe6ff", gem: "#9ad0ff" },
  { n: "마스터", c1: "#46145e", c2: "#bb6af0", hi: "#f2d0ff", gem: "#e08aff" },
  { n: "그랜드마스터", c1: "#5e0e10", c2: "#e8503a", hi: "#ffc8a8", gem: "#ff8a4a" },
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
// 가운데 깎은 보석 + 양쪽으로 쓸어 올린 금속 날개. 날개 칼날마다 밝은 면 · 어두운 면 · 가운데 능선 · 새긴 홈이 있어 입체로 보여요
// 티어가 오를수록 칼날이 늘고(EM_BLADES 의 첫 숫자 = 나오는 티어) 뒤의 빛 · 반짝이가 세져요
const EM_BLADES = [ // [나오는 티어, 뿌리 x,y, 휘는 점 x,y, 끝 x,y, 뿌리 굵기] — 오른쪽 반쪽 (왼쪽은 거울). 가로로 넓게 퍼지고 끝이 위로 휘어요
  [6, 148, 104, 186, 104, 199, 52, 20], // 바깥 날개 끝 (위로 휨)
  [2, 102, 140, 146, 156, 182, 120, 26], // 아래 날개
  [4, 116, 100, 154, 92, 178, 44, 22], // 위 날개 뿔
  [0, 104, 120, 156, 132, 194, 72, 44], // 큰 날개
  [1, 108, 104, 132, 100, 150, 68, 22], // 안쪽 지느러미
  [0, 100, 132, 128, 138, 158, 112, 56], // 몸통 판 (가운데 아래로 V)
];
const f1 = (v) => v.toFixed(1);
// 휜 칼날 하나: 위(밝은) 면 · 아래(어두운) 면 · 능선 · 홈
function bladeSvg(x0, y0, cx, cy, x1, y1, w, G, mir) {
  const N = 14, up = [], dn = [], mid = [], groove = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, a = 1 - t;
    const x = a * a * x0 + 2 * a * t * cx + t * t * x1, y = a * a * y0 + 2 * a * t * cy + t * t * y1;
    let dx = 2 * a * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * a * (cy - y0) + 2 * t * (y1 - cy); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    let nx = -dy, ny = dx; if (ny > 0) { nx = -nx; ny = -ny; } // 위쪽을 향하는 옆 방향
    const h = (w / 2) * Math.pow(1 - t, 0.62);
    up.push([x + nx * h, y + ny * h]); dn.push([x - nx * h, y - ny * h]); mid.push([x, y]); groove.push([x + nx * h * 0.5, y + ny * h * 0.5]);
  }
  const M = (pts) => pts.map(([x, y]) => `${f1(mir ? 200 - x : x)} ${f1(y)}`).join(" L");
  const face = (side, fill) => `<path d="M${M(mid)} L${M(side.slice().reverse())}Z" fill="${fill}"/>`;
  return `<g>${face(dn, `url(#${G}d)`)}${face(up, `url(#${G}u)`)}
    <path d="M${M(up)} L${M(dn.slice().reverse())}Z" fill="none" stroke="${"var(--te)"}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M${M(mid.slice(0, -1))}" fill="none" stroke="var(--th)" stroke-width="1" stroke-opacity=".9" stroke-linecap="round"/>
    <path d="M${M(groove.slice(1, -3))}" fill="none" stroke="var(--te)" stroke-width=".8" stroke-opacity=".55" stroke-linecap="round"/></g>`;
}
const sparkle = (x, y, r, o) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`;
let EM_UID = 0;
function tierEmblem(i, cls) {
  const T = TIERS[i], G = "te" + i + "_" + EM_UID++;
  const blades = EM_BLADES.filter(([t]) => i >= t);
  const wings = blades.map(([t, x0, y0, cx, cy, x1, y1, w]) => { const g = i === 9 && (t === 1 || t === 6) ? G + "x" : G; return bladeSvg(x0, y0, cx, cy, x1, y1, w, g, true) + bladeSvg(x0, y0, cx, cy, x1, y1, w, g, false); }).join(""); // 챌린저: 윗 깃 · 바깥 뿔은 하늘색
  const spire = i >= 7 ? bladeSvg(100, 100, 100, 80, 100, 40, 22, G, false) : ""; // 마스터부터 가운데 위로 솟은 칼날
  const tiara = i === 9 ? [[86, 98, 80, 84, 76, 62, 12], [114, 98, 120, 84, 124, 62, 12]].map(([a, b, c, d, e, f, w]) => bladeSvg(a, b, c, d, e, f, w, G + "x", false)).join("") : "";
  const glow = 0.22 + i * 0.05;
  const sp = i >= 4 ? [[46, 52, 7], [158, 40, 6], [60, 146, 5], [150, 150, 6]].slice(0, i >= 7 ? 4 : 2).map(([x, y, r], k) => sparkle(x, y, r + (i >= 8 ? 2 : 0), k % 2 ? 0.7 : 0.9)).join("") : "";
  const acc = i === 9 ? "#7fe4ff" : T.gem;
  return `<svg class="temb ${cls || ""}" viewBox="0 0 200 170" role="img" aria-label="${T.n}" style="--tg:${T.gem};--th:${T.hi};--te:${T.c1}">
    <defs>
      <linearGradient id="${G}u" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${T.hi}"/><stop offset=".55" stop-color="${T.c2}"/><stop offset="1" stop-color="${T.c2}" stop-opacity=".9"/></linearGradient>
      <linearGradient id="${G}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.c2}"/><stop offset=".5" stop-color="${T.c1}"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></linearGradient>
      <linearGradient id="${G}xu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${acc}"/></linearGradient>
      <linearGradient id="${G}xd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="#1a4a6a"/></linearGradient>
      <radialGradient id="${G}h" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="${T.gem}" stop-opacity="${glow.toFixed(2)}"/><stop offset=".6" stop-color="${T.gem}" stop-opacity="${(glow * 0.35).toFixed(2)}"/><stop offset="1" stop-color="${T.gem}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${G}g" cx=".42" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${acc}"/><stop offset="1" stop-color="${T.c1}"/></radialGradient>
    </defs>
    <ellipse cx="100" cy="104" rx="100" ry="70" fill="url(#${G}h)"/>
    ${wings}${spire}${tiara}
    <path d="M100 86L130 118L100 160L70 118Z" fill="url(#${G}d)" stroke="var(--te)" stroke-width="1.2"/>
    <path d="M100 86L130 118L100 118Z" fill="url(#${G}u)"/><path d="M100 86L70 118L100 118Z" fill="${T.hi}" opacity=".85"/>
    <path d="M100 160L70 118L100 118Z" fill="${T.c1}" opacity=".6"/>
    <path d="M100 96L120 118L100 148L80 118Z" fill="url(#${G}g)" stroke="${T.hi}" stroke-width="1.2"/>
    <path d="M100 96L120 118L100 112Z" fill="#fff" opacity=".35"/><path d="M100 96L80 118L100 112Z" fill="#fff" opacity=".6"/>
    <path d="M80 118L100 148L100 126Z" fill="#000" opacity=".18"/><path d="M120 118L100 148L100 126Z" fill="#000" opacity=".32"/>
    ${sparkle(93, 108, 5, 0.95)}${sp}
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
