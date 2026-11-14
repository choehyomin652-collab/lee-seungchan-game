// ============================================================
//  stickers.js — 감정 표현 스티커 · 핑 아이콘 (그림 파일 없이 캔버스로 직접 그려요)
//  · 스티커: 우리 마스코트 '영토 펭귄 기사' 얼굴 + 표정 8가지. 메뉴 · 머리 위 말풍선 · 채팅에 써요
//  · 핑 아이콘: 물음표(미아) · 위험 · 노려 · 좋아 — ping.js 가 써요
//  · 한 번 그린 건 저장해 두고 다시 써요 (sticker(k) → 캔버스, stickerUrl(k) → 그림 주소)
// ============================================================
"use strict";
// 감정 표현 목록: [이름표, 메뉴 글자, 3D 동작 시간(초)]
const EMOTES = [
  ["dance", "춤추기", 2.6], ["cheer", "최고!", 2.0], ["laugh", "ㅋㅋㅋ", 2.2], ["love", "하트", 2.2],
  ["wow", "깜짝", 1.8], ["cry", "울기", 2.6], ["angry", "화내기", 2.0], ["tease", "메롱", 2.0],
];
const STK = {}, STK_URL = {};
const ST_INK = "#141a33"; // 외곽선 색
function sticker(k) {
  if (STK[k]) return STK[k];
  const c = document.createElement("canvas"); c.width = c.height = 192;
  try { drawSticker(c.getContext("2d"), k); } catch (e) {}
  return (STK[k] = c);
}
function stickerUrl(k) { return STK_URL[k] || (STK_URL[k] = sticker(k).toDataURL("image/png")); }

// ---------- 작은 그림 도구 ----------
function stHeart(g, x, y, s, fill, ink = "#7a1028") {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(-14, -4, -8, -16, 0, -8); g.bezierCurveTo(8, -16, 14, -4, 0, 6); g.closePath();
  g.fillStyle = fill; g.fill(); g.lineWidth = 2.2 / s * s * 0.9; g.strokeStyle = ink; g.stroke();
  g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(-5, -7, 2.4, 1.6, -0.6, 0, Math.PI * 2); g.fill();
  g.restore();
}
function stStar(g, x, y, r, fill, ink, n = 5, inner = 0.45, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = 2.5; g.strokeStyle = ink; g.stroke(); }
}
function stSpark(g, x, y, r, fill) { stStar(g, x, y, r, fill, null, 4, 0.28, 0); }
function stDrop(g, x, y, s, fill = "#7fd3ff") {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(0, -12); g.bezierCurveTo(7, -2, 9, 4, 0, 9); g.bezierCurveTo(-9, 4, -7, -2, 0, -12); g.closePath();
  g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = "#1d5a8a"; g.stroke();
  g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(-2.5, 1, 1.6, 3, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
function stNote(g, x, y, s, fill = "#ffcf3a", dbl = false) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.12);
  g.lineJoin = "round"; g.lineWidth = 2.6; g.strokeStyle = "#5a3a00"; g.fillStyle = fill;
  const head = (hx) => { g.beginPath(); g.ellipse(hx, 0, 8, 6, -0.45, 0, Math.PI * 2); g.fill(); g.stroke(); };
  g.fillRect(5, -28, 3.6, 28); g.strokeRect(5, -28, 3.6, 28);
  if (dbl) { g.fillRect(25, -34, 3.6, 28); g.strokeRect(25, -34, 3.6, 28); g.beginPath(); g.moveTo(5, -28); g.lineTo(28.6, -34); g.lineTo(28.6, -27); g.lineTo(5, -21); g.closePath(); g.fill(); g.stroke(); head(0); head(20); }
  else { g.beginPath(); g.moveTo(8.6, -28); g.quadraticCurveTo(20, -22, 16, -10); g.quadraticCurveTo(16, -18, 8.6, -19); g.closePath(); g.fill(); g.stroke(); head(0); }
  g.restore();
}
function stPuff(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#ffffff"; g.strokeStyle = "#8a96a6"; g.lineWidth = 2.4;
  for (const [cx, cy, r] of [[-8, 2, 8], [3, -4, 10], [12, 4, 7]]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.beginPath(); for (const [cx, cy, r] of [[-8, 2, 6.6], [3, -4, 8.6], [12, 4, 5.6]]) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2); } g.fill();
  g.restore();
}
function stBang(g, x, y, s, fill = "#ffd23f") { // 느낌표 (글꼴 없이)
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.15);
  g.lineWidth = 3; g.strokeStyle = ST_INK; g.fillStyle = fill;
  g.beginPath(); g.moveTo(-6, -26); g.lineTo(6, -26); g.lineTo(3.5, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 13, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.restore();
}
function stKieuk(g, x, y, s) { // "ㅋ" (글꼴 없이 선으로)
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.12); g.lineCap = "round"; g.lineJoin = "round";
  const path = () => { g.beginPath(); g.moveTo(-9, -10); g.lineTo(9, -10); g.lineTo(5, 12); g.moveTo(-8, 1); g.lineTo(7, 1); };
  path(); g.strokeStyle = ST_INK; g.lineWidth = 9; g.stroke();
  path(); g.strokeStyle = "#ffd23f"; g.lineWidth = 4.5; g.stroke();
  g.restore();
}
function stVein(g, x, y, s) { // 화남 표시
  g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4);
    g.beginPath(); g.moveTo(4, -9); g.quadraticCurveTo(3, -3, 9, -4);
    g.strokeStyle = ST_INK; g.lineWidth = 7.5; g.stroke(); g.strokeStyle = "#ff3a4a"; g.lineWidth = 4; g.stroke();
    g.restore();
  }
  g.restore();
}

// ---------- 펭귄 기사 얼굴 ----------
function drawSticker(g, k) {
  const CX = 96, CY = 104, R = 62;
  g.lineCap = "round"; g.lineJoin = "round";
  g.save();
  if (k === "dance") { g.translate(CX, CY); g.rotate(-0.13); g.translate(-CX, -CY); }
  if (k === "tease") { g.translate(CX, CY); g.rotate(0.1); g.translate(-CX, -CY); }
  // 스티커 흰 테두리 + 그림자
  g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 10; g.shadowOffsetY = 5;
  g.fillStyle = "#fff"; g.beginPath(); g.arc(CX, CY, R + 9, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(CX, CY - R - 4, 18, 16, 0, 0, Math.PI * 2); g.fill(); // 깃 장식 자리
  g.restore();
  // 투구 깃 장식 (초록)
  for (const s of [-1, 1]) { g.save(); g.translate(CX + s * 7, CY - R - 2); g.rotate(s * 0.35); g.beginPath(); g.ellipse(0, -6, 6, 13, 0, 0, Math.PI * 2); g.fillStyle = "#2f8a5a"; g.fill(); g.lineWidth = 3; g.strokeStyle = ST_INK; g.stroke(); g.restore(); }
  // 머리 (남색, 위쪽이 밝게)
  const hg = g.createRadialGradient(CX - 22, CY - 30, 8, CX, CY, R * 1.1);
  hg.addColorStop(0, "#4a62b8"); hg.addColorStop(0.6, "#2c3b6e"); hg.addColorStop(1, "#1d2850");
  g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.fillStyle = hg; g.fill();
  g.save(); g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.clip();
  // 투구 (은색) + 테두리 + 금 배지
  g.beginPath(); g.moveTo(CX - R - 4, CY - 30); g.quadraticCurveTo(CX, CY - 52, CX + R + 4, CY - 30); g.lineTo(CX + R + 4, 0); g.lineTo(CX - R - 4, 0); g.closePath();
  const sg = g.createLinearGradient(0, CY - R, 0, CY - 30); sg.addColorStop(0, "#ffffff"); sg.addColorStop(1, "#aeb8c8"); g.fillStyle = sg; g.fill();
  g.beginPath(); g.moveTo(CX - R - 4, CY - 30); g.quadraticCurveTo(CX, CY - 52, CX + R + 4, CY - 30); g.lineWidth = 7; g.strokeStyle = "#1a2347"; g.stroke();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(CX - 26, CY - 50, 14, 5, -0.3, 0, Math.PI * 2); g.fill();
  // 얼굴 (흰 하트 모양)
  g.beginPath(); g.arc(CX - 19, CY + 2, 27, 0, Math.PI * 2); g.arc(CX + 19, CY + 2, 27, 0, Math.PI * 2); g.ellipse(CX, CY + 22, 46, 34, 0, 0, Math.PI * 2);
  g.fillStyle = "#fbf8f0"; g.fill();
  if (k === "angry") { const rg = g.createRadialGradient(CX, CY + 10, 6, CX, CY + 10, 56); rg.addColorStop(0, "rgba(255,70,70,.45)"); rg.addColorStop(1, "rgba(255,70,70,0)"); g.fillStyle = rg; g.fillRect(0, 0, 192, 192); }
  // 볼
  const blush = k === "love" || k === "tease" ? 0.85 : k === "cry" ? 0.35 : 0.6;
  g.fillStyle = `rgba(255,128,150,${blush})`;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(CX + s * 38, CY + 24, 11, 7, 0, 0, Math.PI * 2); g.fill(); }
  if (k === "love") { g.strokeStyle = "rgba(220,60,90,.7)"; g.lineWidth = 2; for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(CX + s * 38 + i * 5 - 2, CY + 21); g.lineTo(CX + s * 38 + i * 5 + 2, CY + 27); g.stroke(); } }
  g.restore();
  // 금 배지 (투구 앞)
  g.beginPath(); g.arc(CX, CY - 44, 11, 0, Math.PI * 2); g.fillStyle = "#f2c14e"; g.fill(); g.lineWidth = 3; g.strokeStyle = ST_INK; g.stroke();
  g.beginPath(); g.moveTo(CX, CY - 51); g.lineTo(CX + 5, CY - 44); g.lineTo(CX, CY - 37); g.lineTo(CX - 5, CY - 44); g.closePath(); g.fillStyle = "#7fe0ff"; g.fill();
  // 눈 · 눈썹 · 입
  const L = [CX - 20, CY + 2], Rr = [CX + 20, CY + 2];
  const dotEye = ([x, y], s = 1) => { g.beginPath(); g.ellipse(x, y, 7.5 * s, 9.5 * s, 0, 0, Math.PI * 2); g.fillStyle = "#1a1420"; g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(x - 2.5 * s, y - 3.5 * s, 3 * s, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + 2.5 * s, y + 3 * s, 1.3 * s, 0, Math.PI * 2); g.fill(); };
  const line = (pts, w = 5, col = "#1a1420") => { g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  const happyEye = ([x, y]) => line([[x - 9, y + 4], [x, y - 11], [x + 9, y + 4]]);
  const beak = (dy = 0) => { g.beginPath(); g.moveTo(CX - 12, CY + 16 + dy); g.quadraticCurveTo(CX, CY + 10 + dy, CX + 12, CY + 16 + dy); g.quadraticCurveTo(CX + 4, CY + 30 + dy, CX, CY + 31 + dy); g.quadraticCurveTo(CX - 4, CY + 30 + dy, CX - 12, CY + 16 + dy); g.closePath(); g.fillStyle = "#ff9a3a"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#7a3a10"; g.stroke(); g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(CX - 4, CY + 15 + dy, 4, 2, -0.2, 0, Math.PI * 2); g.fill(); };
  const mouth = (w, h, dy = 0, tongue = true) => { g.beginPath(); g.ellipse(CX, CY + 30 + dy, w, h, 0, 0, Math.PI * 2); g.fillStyle = "#9a2434"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#5a1020"; g.stroke(); if (tongue) { g.save(); g.clip(); g.beginPath(); g.ellipse(CX, CY + 30 + dy + h * 0.7, w * 0.7, h * 0.6, 0, 0, Math.PI * 2); g.fillStyle = "#ff7a8a"; g.fill(); g.restore(); } };
  switch (k) {
    case "dance":
      happyEye(L); happyEye(Rr); mouth(11, 9, 2); beak(-2);
      break;
    case "cheer":
      stStar(g, ...L, 13, "#ffd23f", "#8a5a00"); stStar(g, ...Rr, 13, "#ffd23f", "#8a5a00");
      stSpark(g, L[0] - 3, L[1] - 3, 3.5, "#fff"); stSpark(g, Rr[0] - 3, Rr[1] - 3, 3.5, "#fff");
      mouth(10, 8, 2); beak(-2);
      break;
    case "laugh":
      line([[L[0] - 10, L[1] - 8], [L[0] + 2, L[1] - 2], [L[0] + 9, L[1]]]); line([[L[0] + 9, L[1]], [L[0] + 2, L[1] + 2], [L[0] - 10, L[1] + 8]]);
      line([[Rr[0] + 10, Rr[1] - 8], [Rr[0] - 2, Rr[1] - 2], [Rr[0] - 9, Rr[1]]]); line([[Rr[0] - 9, Rr[1]], [Rr[0] - 2, Rr[1] + 2], [Rr[0] + 10, Rr[1] + 8]]);
      mouth(15, 12, 4); beak(-3);
      stDrop(g, L[0] - 18, L[1] + 8, 0.7); stDrop(g, Rr[0] + 18, Rr[1] + 8, 0.7);
      break;
    case "love":
      stHeart(g, L[0], L[1] + 2, 1.15, "#ff4d6d"); stHeart(g, Rr[0], Rr[1] + 2, 1.15, "#ff4d6d");
      beak(0); line([[CX - 8, CY + 36], [CX, CY + 41], [CX + 8, CY + 36]], 3.5, "#7a3a10");
      break;
    case "wow":
      for (const p of [L, Rr]) { g.beginPath(); g.arc(p[0], p[1], 13, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 3.5; g.strokeStyle = "#1a1420"; g.stroke(); g.beginPath(); g.arc(p[0], p[1] + 1, 4.5, 0, Math.PI * 2); g.fillStyle = "#1a1420"; g.fill(); }
      line([[L[0] - 10, L[1] - 22], [L[0], L[1] - 28], [L[0] + 10, L[1] - 22]], 4); line([[Rr[0] - 10, Rr[1] - 22], [Rr[0], Rr[1] - 28], [Rr[0] + 10, Rr[1] - 22]], 4);
      mouth(7, 8, 6, false); beak(-2);
      break;
    case "cry":
      line([[L[0] - 9, L[1] - 1], [L[0], L[1] + 7], [L[0] + 9, L[1] - 1]]); line([[Rr[0] - 9, Rr[1] - 1], [Rr[0], Rr[1] + 7], [Rr[0] + 9, Rr[1] - 1]]);
      line([[L[0] - 11, L[1] - 10], [L[0], L[1] - 18], [L[0] + 9, L[1] - 20]], 4); line([[Rr[0] + 11, Rr[1] - 10], [Rr[0], Rr[1] - 18], [Rr[0] - 9, Rr[1] - 20]], 4);
      // 폭포 눈물
      for (const p of [L, Rr]) { g.beginPath(); g.moveTo(p[0] - 5, p[1] + 6); g.quadraticCurveTo(p[0] - 9, p[1] + 40, p[0] - 4, p[1] + 66); g.lineTo(p[0] + 6, p[1] + 66); g.quadraticCurveTo(p[0] + 3, p[1] + 40, p[0] + 5, p[1] + 6); g.closePath(); g.fillStyle = "rgba(127,211,255,.92)"; g.fill(); g.lineWidth = 2.4; g.strokeStyle = "#1d5a8a"; g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(p[0] - 2, p[1] + 14, 2.2, 40); }
      beak(0); line([[CX - 9, CY + 38], [CX - 4, CY + 34], [CX, CY + 38], [CX + 4, CY + 42], [CX + 9, CY + 38]], 3.2, "#7a3a10");
      stDrop(g, L[0] - 16, CY + 72, 0.8); stDrop(g, Rr[0] + 18, CY + 70, 0.9);
      break;
    case "angry":
      dotEye(L, 0.75); dotEye(Rr, 0.75);
      line([[L[0] - 13, L[1] - 18], [L[0] - 2, L[1] - 14], [L[0] + 10, L[1] - 7]], 7); line([[Rr[0] + 13, Rr[1] - 18], [Rr[0] + 2, Rr[1] - 14], [Rr[0] - 10, Rr[1] - 7]], 7);
      g.beginPath(); g.roundRect ? g.roundRect(CX - 12, CY + 28, 24, 11, 4) : g.rect(CX - 12, CY + 28, 24, 11); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = "#5a1020"; g.stroke();
      g.beginPath(); g.moveTo(CX - 12, CY + 33.5); for (let i = 0; i <= 6; i++) g.lineTo(CX - 12 + i * 4, CY + 33.5 + (i % 2 ? -3 : 3)); g.lineWidth = 1.8; g.stroke();
      beak(-6);
      stVein(g, CX + 46, CY - 46, 1.25); stPuff(g, CX - 78, CY + 20, 0.9); stPuff(g, CX + 76, CY + 24, 0.8);
      break;
    case "tease":
      line([[L[0] - 9, L[1] + 2], [L[0], L[1] - 6], [L[0] + 9, L[1] + 2]]); dotEye(Rr, 1);
      beak(-2);
      g.beginPath(); g.moveTo(CX - 7, CY + 28); g.lineTo(CX + 7, CY + 28); g.quadraticCurveTo(CX + 10, CY + 50, CX, CY + 50); g.quadraticCurveTo(CX - 10, CY + 50, CX - 7, CY + 28); g.closePath(); g.fillStyle = "#ff6f86"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = "#7a1028"; g.stroke();
      g.beginPath(); g.moveTo(CX, CY + 32); g.lineTo(CX, CY + 43); g.strokeStyle = "rgba(122,16,40,.6)"; g.lineWidth = 2; g.stroke();
      beak(-2);
      break;
    default: dotEye(L); dotEye(Rr); beak(0);
  }
  // 머리 외곽선
  g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = ST_INK; g.stroke();
  g.restore();
  // 머리 밖 장식
  if (k === "dance") { stNote(g, 30, 64, 1.1, "#ffcf3a", true); stNote(g, 160, 50, 0.95, "#7fe0ff"); stNote(g, 168, 150, 0.8, "#ff8fb0"); }
  if (k === "cheer") { stSpark(g, 26, 52, 14, "#ffd23f"); stSpark(g, 168, 44, 11, "#9ff0ff"); stSpark(g, 170, 150, 9, "#ffd23f"); stSpark(g, 22, 150, 8, "#ffffff"); }
  if (k === "laugh") { stKieuk(g, 150, 40, 1.1); stKieuk(g, 172, 66, 0.9); }
  if (k === "love") { stHeart(g, 160, 48, 1.4, "#ff6f8e"); stHeart(g, 28, 60, 1.0, "#ff4d6d"); stHeart(g, 168, 140, 0.8, "#ff9db0"); }
  if (k === "wow") { stBang(g, 162, 52, 1.2); g.save(); g.translate(150, 92); g.rotate(-0.4); stDrop(g, 0, 0, 1, "#9fe0ff"); g.restore(); }
}

// ---------- 핑 아이콘 ----------
// [이름표, 이름, 색, 소리]
const PINGS = [
  ["q", "물음표", "#ffc53d"],
  ["danger", "위험!", "#ff4a4a"],
  ["target", "노려!", "#ff8a2a"],
  ["good", "좋아!", "#4fe08a"],
];
const PING_COL = Object.fromEntries(PINGS.map((p) => [p[0], p[2]]));
const PIC = {}, PIC_URL = {};
function pingIcon(k) {
  if (PIC[k]) return PIC[k];
  const c = document.createElement("canvas"); c.width = c.height = 128;
  try { drawPingIcon(c.getContext("2d"), k); } catch (e) {}
  return (PIC[k] = c);
}
function pingIconUrl(k) { return PIC_URL[k] || (PIC_URL[k] = pingIcon(k).toDataURL("image/png")); }
function drawPingIcon(g, k) {
  const C = 64; g.lineCap = "round"; g.lineJoin = "round";
  const glyph = (txt, size, y = C + 3) => { g.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 9; g.strokeStyle = "rgba(20,26,51,.85)"; g.strokeText(txt, C, y); g.fillStyle = "#fff"; g.fillText(txt, C, y); };
  g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 10; g.shadowOffsetY = 4;
  if (k === "q") { // 물음표: 금빛 동그라미
    g.beginPath(); g.arc(C, C, 46, 0, Math.PI * 2); const gr = g.createLinearGradient(0, 18, 0, 110); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(1, "#e08a00"); g.fillStyle = gr; g.fill();
    g.restore(); g.lineWidth = 6; g.strokeStyle = ST_INK; g.stroke(); g.beginPath(); g.arc(C, C, 38, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.6)"; g.stroke();
    glyph("?", 70);
  } else if (k === "danger") { // 위험: 빨간 세모
    g.beginPath(); g.moveTo(C, 14); g.lineTo(116, 106); g.lineTo(12, 106); g.closePath(); const gr = g.createLinearGradient(0, 14, 0, 106); gr.addColorStop(0, "#ff7a6a"); gr.addColorStop(1, "#c41a28"); g.fillStyle = gr; g.fill();
    g.restore(); g.lineWidth = 7; g.strokeStyle = ST_INK; g.stroke();
    glyph("!", 62, 76);
  } else if (k === "target") { // 노려: 과녁
    g.beginPath(); g.arc(C, C, 44, 0, Math.PI * 2); g.fillStyle = "#fff4e6"; g.fill(); g.restore();
    g.lineWidth = 6; g.strokeStyle = ST_INK; g.stroke();
    g.beginPath(); g.arc(C, C, 32, 0, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = "#ff6a1a"; g.stroke();
    g.beginPath(); g.arc(C, C, 12, 0, Math.PI * 2); g.fillStyle = "#ff3a1a"; g.fill(); g.lineWidth = 3; g.strokeStyle = ST_INK; g.stroke();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { g.beginPath(); g.moveTo(C + dx * 50, C + dy * 50); g.lineTo(C + dx * 22, C + dy * 22); g.lineWidth = 9; g.strokeStyle = ST_INK; g.stroke(); g.lineWidth = 4; g.strokeStyle = "#fff"; g.stroke(); }
  } else { // 좋아: 초록 별 배지
    g.beginPath(); g.arc(C, C, 46, 0, Math.PI * 2); const gr = g.createLinearGradient(0, 18, 0, 110); gr.addColorStop(0, "#7ff0a0"); gr.addColorStop(1, "#1f9a52"); g.fillStyle = gr; g.fill();
    g.restore(); g.lineWidth = 6; g.strokeStyle = ST_INK; g.stroke();
    stStar(g, C, C + 2, 30, "#fff", ST_INK);
  }
}
