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
// 가운데 보석 + 양쪽으로 쓸어 올린 날개. 티어가 오를수록 겹이 늘어요
const EM_R = [ // 오른쪽 반쪽 조각들 (왼쪽은 거울), [나오는 티어, 모양]
  [0, "M60 72C70 63 84 52 103 36C99 53 91 66 77 78C71 81 65 81 60 80Z"], // 큰 날개
  [1, "M63 64C76 53 88 42 97 25C97 41 90 54 75 65Z"], // 윗 깃
  [3, "M62 81C74 84 90 78 103 66C97 82 83 92 64 90Z"], // 아래 날개
  [5, "M67 52C71 40 77 30 86 17C84 31 80 43 72 55Z"], // 안쪽 뿔
  [6, "M90 46C101 37 110 26 115 12C116 28 111 41 101 52Z"], // 바깥 뿔
  [8, "M100 58C108 54 114 48 119 40C118 52 112 60 104 64Z"], // 옆 가시
];
function tierEmblem(i, cls) {
  const T = TIERS[i], id = "tg" + i;
  const parts = EM_R.filter(([t]) => i >= t).map(([, d]) => d);
  const wing = (d) => `<path d="${d}" fill="url(#${id}a)" stroke="${T.hi}" stroke-opacity=".55" stroke-width="1.2"/><path d="${d}" fill="url(#${id}a)" stroke="${T.hi}" stroke-opacity=".55" stroke-width="1.2" transform="translate(120 0) scale(-1 1)"/>`;
  const crown = i >= 7 ? `<path d="M60 14L65 40L60 50L55 40Z" fill="url(#${id}a)" stroke="${T.hi}" stroke-width="1"/>` : "";
  const tiara = i === 9 ? `<path d="M46 44L51 32L56 40L60 28L64 40L69 32L74 44Z" fill="${T.gem}" opacity=".9"/>` : "";
  return `<svg class="temb ${cls || ""}" viewBox="0 0 120 100" role="img" aria-label="${T.n}" style="--tg:${T.gem}">
    <defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.hi}"/><stop offset=".45" stop-color="${T.c2}"/><stop offset="1" stop-color="${T.c1}"/></linearGradient>
    <radialGradient id="${id}g" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${T.gem}"/><stop offset="1" stop-color="${T.c1}"/></radialGradient></defs>
    ${parts.slice().reverse().map(wing).join("")}${crown}${tiara}
    <path d="M60 46L72 64L60 88L48 64Z" fill="url(#${id}g)" stroke="${T.hi}" stroke-width="1.4"/>
    <path d="M60 52L66 64L60 76L54 64Z" fill="#fff" opacity="${0.25 + i * 0.05}"/>
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
