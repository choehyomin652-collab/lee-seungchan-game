// ============================================================
//  ping.js — 핑 찍기 (미아핑 "?" · 위험! · 노려! · 좋아!)
//  · 찍는 법: 경기장을 꾹 누르기(0.45초) 또는 왼쪽 위 핑 버튼을 켜고 누르기 → 핑 바퀴에서 고르기
//    컴퓨터는 Alt + 클릭 하면 바로 물음표 핑
//  · 어디에: 내 보드 · 정찰 중인 상대 보드(상대 친구 위) · 전투 중 상대 팀/우리 팀 친구 위 · 빈 땅
//  · 친구와 같이 하기 중이면 상대에게도 보여요:
//      준비 시간 — 내가 정찰하는 반의 보드에 찍으면, 그 반 주인 화면의 자기 보드에 떠요 (그 반을 정찰 중인 다른 친구에게도)
//      전투 중 — 지금 나와 싸우는 상대 화면에 같은 친구 위로 떠요
//    내 보드 · 내 친구에 핑이 찍히면 오른쪽에 "OO 님이 … 핑!" 알림도 떠요
//  · 보내는 방법은 채팅과 같아요: 각자 상태(presence)에 최근 핑 4개를 붙여 보내요
//  · 보이는 것만 바꿔요 (전투 계산 · 난수는 건드리지 않아요)
// ============================================================
"use strict";
const PING = { life: 3.2, list: [], out: [], seq: Date.now() % 1e7, mode: false, recent: [], seen: new Set(), peers: new Set(), tgt: null, lp: null, down: null, eat: false };
const PING_HOLD = 450; // 핑은 PING.life 초 동안 보여요
const PING_NAME = Object.fromEntries(PINGS.map((p) => [p[0], p[1]]));
const riOf = (P) => (P.ri != null ? P.ri : NET.on ? "ai" + P.i : P.i); // 온라인에서 컴퓨터 반은 각자 화면에만 있어서 번호가 겹치지 않게
function pingBattleKey() {
  if (!S || !S.battle) return null;
  const a = riOf(human()), b = S.opp ? riOf(S.opp) : -1;
  return `${netRound()}:${Math.min(a, b)}:${Math.max(a, b)}`;
}
const inBattleView = () => S && S.battle && (S.phase === "combat" || S.phase === "result");
const inPlanView = () => S && (S.phase === "plan" || S.phase === "wait");

// 손가락에서 가장 가까운 친구 (ui.js 의 unitAtScreen 과 같은 방법인데, 정찰 중인 상대 친구 · 전투 중 모든 친구도 골라요)
function pingUnitAt(x, y) {
  let best = null, bd = Math.max(26, Math.min(W, H) * 0.045);
  for (const it of LAST_R) {
    if (!it.g || it.bench || it.held || it.dead) continue;
    const sc = it.g.scale.x, [fx, fy] = proj(it.x, 0.2, it.z), [hx, hy] = proj(it.x, 1.6 * sc, it.z);
    const t = Math.max(0, Math.min(1, ((x - fx) * (hx - fx) + (y - fy) * (hy - fy)) / (((hx - fx) ** 2 + (hy - fy) ** 2) || 1)));
    const d = Math.hypot(x - (fx + (hx - fx) * t), y - (fy + (hy - fy) * t));
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
// 보드 칸 찾기 (준비 시간: 위 4줄 = 정찰 중인 상대 보드, 아래 4줄 = 내 보드)
function pingHexAt(px, pz) {
  let best = null, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const d = Math.hypot(px - worldX(gridX(r, c)), pz - worldZ(r)); if (d < bd) { bd = d; best = { r, c }; } }
  return bd < 1.05 ? best : null;
}
// 누른 자리 → 핑 대상
function pingTargetAt(x, y) {
  const p = groundAt(x, y), it = pingUnitAt(x, y);
  if (!p && !it) return null;
  const h = { p: it ? { x: it.x, z: it.z } : p };
  const hx = pingHexAt(h.p.x, h.p.z);
  if (hx) Object.assign(h, { g: "board", r: hx.r, c: hx.c });
  const rd = netRound();
  if (inBattleView()) {
    const B = S.battle, fi = it && it.f && it.f.alive ? B.f.indexOf(it.f) : -1;
    const X = FLIP ? (CX - h.p.x) / SQ3 : (h.p.x + CX) / SQ3, Y = FLIP ? (5.25 - h.p.z) / 1.5 : (h.p.z + 5.25) / 1.5;
    return { kind: "b", key: pingBattleKey(), fi, X, Y, rd, share: !!(S.opp && S.opp.remote && !S.oppGhost) }; // 진짜 친구와 싸울 때만 보내요
  }
  if (inPlanView() && h.g === "board") {
    if (h.r >= 4) return { kind: "p", owner: riOf(human()), lr: h.r - 4, c: h.c, rd, share: true };
    if (S.scout != null) { const Q = S.players[S.scout]; return { kind: "p", owner: riOf(Q), lr: 3 - h.r, c: COLS - 1 - h.c, rd, share: !!Q.remote }; }
  }
  return { kind: "w", x: h.p.x, z: h.p.z, rd };
}
// 핑이 지금 화면 어디에 있나요? → [x, 아이콘 높이, z] (지금 화면에 없으면 null)
function pingAnchor(p) {
  if (p.kind === "w") return [p.x, 1.0, p.z];
  if (p.rd !== netRound()) return null;
  if (p.kind === "p") {
    if (!inPlanView()) return null;
    let row, col, owner = null;
    if (p.owner === riOf(human())) { row = 4 + p.lr; col = p.c; owner = human(); }
    else if (S.scout != null && riOf(S.players[S.scout]) === p.owner) { row = 3 - p.lr; col = COLS - 1 - p.c; owner = S.players[S.scout]; }
    else return null;
    const u = owner.board[p.lr] && owner.board[p.lr][p.c];
    return [worldX(gridX(row, col)), u ? 3.3 + (u.star - 1) * 0.3 : 1.0, worldZ(row)]; // 친구가 있으면 이름표 위로
  }
  if (!inBattleView() || p.key !== pingBattleKey()) return null;
  const f = p.fi >= 0 ? S.battle.f[p.fi] : null;
  if (f && (f.alive || f.deadT > 0)) return [worldX(f.X), f.robot ? 4.6 : f.mon && f.mon.boss ? 3.8 : 3.3 + ((f.star || 1) - 1) * 0.3, worldZ(f.Y)];
  return [worldX(p.X), 1.0, worldZ(p.Y)];
}

// 핑 찍기
function placePing(k, t) {
  if (!t || !PING_NAME[k]) return;
  const now = performance.now();
  PING.recent = PING.recent.filter((x) => now - x < 2500);
  if (PING.recent.length >= 3) return toast("핑은 천천히! 잠깐 쉬었다가 찍어요");
  PING.recent.push(now);
  PING.list.push({ ...t, k, at: now, mine: true });
  pingSound(k);
  if (NET.on && NET.room && t.share) { // 컴퓨터 반 보드 · 컴퓨터와의 전투 · 빈 땅 핑은 내 화면에만
    const r2 = (v) => Math.round(v * 100) / 100;
    const e = t.kind === "p" ? [++PING.seq, k, t.rd, "p", t.owner, t.lr, t.c] : [++PING.seq, k, t.rd, "b", t.key, t.fi, r2(t.X), r2(t.Y)];
    PING.out = [...PING.out, e].slice(-4);
    NET.room.presence({ pg: PING.out }).catch(() => {});
  }
}
function pingSound(k) {
  if (muted || !AC) return;
  const now = AC.currentTime;
  const tone = (f, d, type, v, f2, delay = 0) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + delay); if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + delay + d); g.gain.setValueAtTime(v, now + delay); g.gain.exponentialRampToValueAtTime(0.0001, now + delay + d); o.connect(g).connect(AC.destination); o.start(now + delay); o.stop(now + delay + d + 0.02); };
  if (k === "q") { tone(500, 0.1, "sine", 0.07, 700); tone(700, 0.18, "sine", 0.07, 1250, 0.1); } // 띠-용?
  else if (k === "danger") { tone(880, 0.09, "square", 0.04); tone(880, 0.09, "square", 0.04, null, 0.14); }
  else if (k === "target") { tone(1400, 0.04, "square", 0.04, 900); tone(320, 0.12, "triangle", 0.06, 160, 0.03); }
  else { tone(784, 0.12, "triangle", 0.05); tone(1047, 0.18, "triangle", 0.05, null, 0.09); }
}

// 친구들 핑 받기 (0.2초마다)
function pingTick() {
  if (!NET.on || !NET.room || !S) return;
  const me = riOf(human());
  for (const p of netPeers()) {
    if (p.sameTab || !p.presence || p.presence.gid !== NET.gid) continue;
    const list = Array.isArray(p.presence.pg) ? p.presence.pg.slice(-4) : [];
    if (!PING.peers.has(p.peer)) { PING.peers.add(p.peer); list.forEach((e) => Array.isArray(e) && PING.seen.add(p.peer + ":" + e[0])); continue; } // 처음 본 친구의 예전 핑은 건너뛰어요
    const name = cleanName(p.presence.n) || "친구";
    for (const e of list) {
      if (!Array.isArray(e) || typeof e[0] !== "number") continue;
      const key = p.peer + ":" + e[0];
      if (PING.seen.has(key)) continue;
      PING.seen.add(key);
      const t = pingParse(e);
      if (!t) continue;
      PING.list.push({ ...t, at: performance.now(), mine: false, who: name });
      if (pingAnchor(t)) pingSound(t.k);
      // 내 보드 · 내 친구에 찍혔으면 알려 줘요
      let mine = null;
      if (t.kind === "p" && t.owner === me) { const u = human().board[t.lr] && human().board[t.lr][t.c]; mine = u ? `내 ${DEFS[u.d].n}` : "내 보드"; }
      if (t.kind === "b" && t.key === pingBattleKey() && t.fi >= 0) { const f = S.battle.f[t.fi]; if (f && f.team === (FLIP ? 1 : 0)) mine = f.d >= 0 && DEFS[f.d] ? `내 ${DEFS[f.d].n}` : "우리 팀"; }
      if (mine && typeof chatFeed === "function") chatFeed({ n: name, t: ` 님이 ${mine}에 ${PING_NAME[t.k]} 핑!`, em: 1 });
    }
  }
}
function pingParse(e) {
  const [, k, rd, kind] = e, num = (v) => typeof v === "number" && isFinite(v);
  if (!PING_NAME[k] || !num(rd)) return null;
  if (kind === "p") {
    const [, , , , owner, lr, c] = e;
    if (!num(owner) || !(lr >= 0 && lr < 4) || !(c >= 0 && c < COLS)) return null;
    return { kind, k, rd, owner, lr: lr | 0, c: c | 0 };
  }
  if (kind === "b") {
    const [, , , , key, fi, X, Y] = e;
    if (typeof key !== "string" || key.length > 40 || !num(fi) || !num(X) || !num(Y) || Math.abs(X) > 20 || Math.abs(Y) > 20) return null;
    return { kind, k, rd, key, fi: fi | 0, X, Y };
  }
  return null;
}

// ---------- 화면에 그리기 (render3d.js 의 drawOverlay 가 불러요) ----------
function drawPings(u0) {
  if (!PING.list.length) return;
  const now = performance.now();
  PING.list = PING.list.filter((p) => now - p.at < PING.life * 1000);
  for (const p of PING.list) {
    const A = pingAnchor(p);
    if (!A) continue;
    const age = (now - p.at) / 1000, out = Math.min(1, (PING.life - age) / 0.4), col = PING_COL[p.k];
    const [x, top, z] = A;
    ctx.save(); ctx.globalAlpha = out;
    // 바닥 고리: 퍼져 나가는 물결 2개 + 가운데 고리
    const ring = (rad, alpha, lw) => {
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, [sx, sy] = proj(x + Math.cos(a) * rad, 0.06, z + Math.sin(a) * rad); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
      ctx.globalAlpha = out * alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    };
    for (let w = 0; w < 2; w++) { const ph = ((age + w * 0.45) % 0.9) / 0.9; ring(0.3 + ph * 0.9, (1 - ph) * 0.9, u0 * 0.35); }
    ring(0.45, 0.95, u0 * 0.3);
    // 기둥 + 아이콘 (위에서 톡 떨어져서 통통)
    const [gx, gy] = proj(x, 0.06, z), [ix, iy0] = proj(x, top, z);
    const drop = age < 0.25 ? (1 - age / 0.25) ** 2 * u0 * 5 : 0, bounce = age >= 0.25 && age < 0.55 ? Math.sin((age - 0.25) / 0.3 * Math.PI) * u0 * 0.8 : 0;
    const iy = iy0 - drop - bounce - Math.sin(age * 4) * u0 * 0.15, sz = u0 * 3.9 * (age < 0.25 ? 1.3 - age * 1.2 : 1);
    ctx.globalAlpha = out * 0.8; ctx.strokeStyle = col; ctx.lineWidth = u0 * 0.22; ctx.setLineDash([u0 * 0.4, u0 * 0.3]);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ix, iy + sz * 0.4); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = out;
    const glow = ctx.createRadialGradient(ix, iy, sz * 0.2, ix, iy, sz * 0.9); glow.addColorStop(0, col + "88"); glow.addColorStop(1, col + "00");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ix, iy, sz * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(pingIcon(p.k), ix - sz / 2, iy - sz / 2, sz, sz);
    if (p.who) { // 친구가 찍은 핑엔 이름표
      ctx.font = font(u0 * 0.95); const w = ctx.measureText(p.who).width + u0;
      ctx.fillStyle = "rgba(7,16,22,.85)"; roundRect(ix - w / 2, iy + sz * 0.5, w, u0 * 1.4, u0 * 0.5); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.who, ix, iy + sz * 0.5 + u0 * 0.72);
    }
    ctx.restore();
  }
}

// ---------- 핑 바퀴 ----------
const PW = document.createElement("div");
PW.className = "pingwheel"; PW.hidden = true;
PW.innerHTML = PINGS.map(([k, n], i) => `<button class="pw${i}" data-k="${k}" aria-label="${n} 핑"><img src="${pingIconUrl(k)}" alt=""><span>${n}</span></button>`).join("") + `<button class="pwx" aria-label="닫기">✕</button>`;
document.body.appendChild(PW);
PW.querySelectorAll("button[data-k]").forEach((b) => tapButton(b, () => { const t = PING.tgt; closePingWheel(); placePing(b.dataset.k, t); }));
tapButton(PW.querySelector(".pwx"), closePingWheel);
function openPingWheel(cx, cy, t) {
  if (!t) return;
  PING.tgt = t;
  const r = Math.min(110, Math.max(80, Math.min(innerWidth, innerHeight) * 0.16));
  PW.style.setProperty("--r", r + "px");
  PW.style.left = Math.max(r + 40, Math.min(innerWidth - r - 40, cx)) + "px";
  PW.style.top = Math.max(r + 40, Math.min(innerHeight - r - 40, cy)) + "px";
  PW.hidden = false;
}
function closePingWheel() { PW.hidden = true; PING.tgt = null; }
document.addEventListener("pointerdown", (e) => { if (!PW.hidden && !PW.contains(e.target)) closePingWheel(); }, true);

// ---------- 입력 (ui.js 의 경기장 터치에서 불러요) ----------
// 눌렀을 때: 핑 모드면 바로 바퀴, Alt+클릭이면 바로 물음표, 아니면 꾹 누르기 타이머
function pingDown(e, x, y) {
  if (!S || S.phase === "over" || S.phase === "carousel") return false;
  if (e.altKey && e.pointerType === "mouse") { placePing("q", pingTargetAt(x, y)); PING.eat = true; return true; }
  if (PING.mode) { openPingWheel(e.clientX, e.clientY, pingTargetAt(x, y)); setPingMode(false); PING.eat = true; return true; }
  clearTimeout(PING.lp);
  PING.down = { x, y };
  PING.lp = setTimeout(() => {
    if (!PING.down) return;
    const t = pingTargetAt(PING.down.x, PING.down.y);
    if (!t) return;
    drag = null; $("shop").classList.remove("selling"); PING.eat = true;
    const b = cv.getBoundingClientRect();
    openPingWheel(b.left + PING.down.x, b.top + PING.down.y, t);
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
  }, PING_HOLD);
  return false;
}
function pingMove(x, y) { if (PING.down && Math.hypot(x - PING.down.x, y - PING.down.y) > 14) { clearTimeout(PING.lp); PING.down = null; } }
// 손을 뗐을 때: 꾹 누르기로 바퀴가 열렸으면 원래 탭 동작은 하지 않아요
function pingUp() { clearTimeout(PING.lp); PING.down = null; if (PING.eat) { PING.eat = false; return true; } return false; }
function setPingMode(on) {
  PING.mode = on;
  $("pingbtn").classList.toggle("on", on); $("pingbtn").setAttribute("aria-pressed", String(on));
  if (on) toast("핑 찍을 곳을 누르세요 (경기장을 꾹 눌러도 돼요)");
}
$("pingbtn").onclick = (e) => { e.stopPropagation(); setPingMode(!PING.mode); };
setInterval(pingTick, 200);
