// ============================================================
//  game.js — 게임 규칙 (상점 · 유닛 · 합성 · 라운드 진행 · 급식 줄 · 컴퓨터 반)
// ============================================================
"use strict";
// =============== 상태 ===============
let S = null;
const human = () => S.players[0];
function newPlayer(i) {
  return {
    i, name: i === 0 ? "우리반(나)" : CLASS_NAMES[i - 1], human: i === 0,
    hp: 100, gold: 0, level: 1, xp: 0,
    board: Array.from({ length: 4 }, () => Array(COLS).fill(null)), // 0행 = 맨 앞줄
    bench: Array(BENCH).fill(null), items: [], shop: [null, null, null, null, null],
    locked: false, streak: 0, alive: true, place: 0, lastOpp: -1,
    plan: shuffle([...MAIN_TRAITS]).slice(0, 2),
    gpr: 0, buff: { as: 0, ar: 0, ad: 0, hp: 0 }, emb: {}, augs: [],
  };
}
function newGame() {
  S = {
    stage: 1, k: 1, type: "carousel", phase: "carousel", timer: 0, timerMax: 1,
    players: Array.from({ length: 8 }, (_, i) => newPlayer(i)),
    pool: DEFS.map((d) => POOL_SIZE[d.c]),
    speed: S ? S.speed : 1, fast: S ? S.fast : false,
    battle: null, results: [], car: null, sel: null, scout: null, opp: null,
    banner: null, resultT: 0, shake: 0, orbs: [], augPending: false, t0: Date.now(),
  };
  if (NET.on) netSetup();
  aiAssignSkill(); // 내 티어에 맞춰 컴퓨터 반 실력을 정해요
  if ($("res")) $("res").hidden = true;
  startRound(true);
}

// =============== 상점과 공용 풀 ===============
function rollCost(level) {
  const o = ODDS[level]; let r = Math.random() * 100;
  for (let i = 0; i < 5; i++) { if (r < o[i]) return i + 1; r -= o[i]; }
  return 1;
}
// 상점에서 더 자주 나오게 하는 짝꿍: 덱(보드 · 대기석)에 "이 친구"가 있으면 "저 친구"가 나올 가능성이 배로 늘어요
const SHOP_BOOST = [{ has: "이다연", boost: "김예균", k: 3 }]; // 이다연이 덱에 있으면 상점에서 김예균이 3배 잘 나와요
function shopWeight(P, i) {
  let w = S.pool[i];
  if (P) for (const b of SHOP_BOOST) if (DEFS[i].n === b.boost && unitsOf(P).some((x) => DEFS[x.u.d].n === b.has)) w *= b.k;
  return w;
}
function drawFromPool(level, P) {
  for (let tries = 0; tries < 15; tries++) {
    const cost = rollCost(level);
    const cands = DEFS.map((_, i) => i).filter((i) => DEFS[i].c === cost && S.pool[i] > 0);
    const total = cands.reduce((s, i) => s + shopWeight(P, i), 0);
    if (!total) continue;
    let r = Math.random() * total;
    for (const i of cands) { r -= shopWeight(P, i); if (r < 0) { S.pool[i]--; return i; } }
  }
  return null;
}
function refreshShop(P) {
  P.shop.forEach((di) => di != null && S.pool[di]++);
  P.shop = Array.from({ length: 5 }, () => drawFromPool(P.level, P));
}

// =============== 유닛 관리 ===============
function mkUnit(d, star = 1) { return { uid: uid++, d, star, items: [] }; }
function unitsOf(P) {
  const out = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) if (P.board[r][c]) out.push({ u: P.board[r][c], w: "b", r, c });
  P.bench.forEach((u, i) => u && out.push({ u, w: "n", i }));
  return out;
}
function boardCount(P) { let n = 0; for (const row of P.board) for (const u of row) if (u) n++; return n; }
function getAt(P, l) { return l.w === "b" ? P.board[l.r][l.c] : P.bench[l.i]; }
function setAt(P, l, u) { if (l.w === "b") P.board[l.r][l.c] = u; else P.bench[l.i] = u; }
const sameLoc = (a, b) => a && b && a.w === b.w && (a.w === "b" ? a.r === b.r && a.c === b.c : a.i === b.i);

function buy(P, i) {
  const di = P.shop[i]; if (di == null) return false;
  const def = DEFS[di]; if (P.gold < def.c) return false;
  const free = P.bench.indexOf(null);
  const canMerge = S.phase === "plan" || !P.human;
  if (free < 0) {
    const copies = unitsOf(P).filter((x) => x.u.d === di && x.u.star === 1).length;
    if (!canMerge || copies < 2) return false;
  }
  P.gold -= def.c; P.shop[i] = null;
  const u = mkUnit(di);
  if (free >= 0) P.bench[free] = u; else P.bench.push(u);
  if (canMerge) merge(P, di, 1);
  P.bench.length = BENCH;
  return true;
}
function merge(P, d, star) {
  if (star >= 3) return;
  const list = unitsOf(P).filter((x) => x.u.d === d && x.u.star === star);
  if (list.length < 3) return;
  const keep = list[0], others = list.slice(-2);
  for (const o of others) {
    setAt(P, o, null);
    for (const it of o.u.items) if (!addItem(keep.u, it)) giveItem(P, it);
  }
  keep.u.star = star + 1;
  if (P.human && typeof WFX !== "undefined") {
    const x = keep.w === "b" ? worldX(gridX(4 + keep.r, keep.c)) : benchX(keep.i), z = keep.w === "b" ? worldZ(4 + keep.r) : BENCH_Z;
    // 합성 연출: 빛 기둥 + 별 폭죽 + 퍼지는 고리 (★3은 금색으로 더 크게)
    const gold = star + 1 >= 3, col = gold ? "#ffd75a" : "#cfe6ff";
    WFX.push({ w: 1, X: x, Y: z, r: 1.4, col: "#ffd75a", t: 0.7, t0: 0.7 }, { w: 1, kind: "spark", X: x, Y: z, col: "#ffe9a0", t: 0.6, t0: 0.6 },
      { w: 1, kind: "pillar", X: x, Y: z, col, big: gold, t: gold ? 1.3 : 1.0, t0: gold ? 1.3 : 1.0 },
      { w: 1, kind: "stars", X: x, Y: z, col: gold ? "#fff1a8" : "#ffffff", n: gold ? 18 : 10, t: 1.1, t0: 1.1 },
      { w: 1, X: x, Y: z, r: gold ? 3.2 : 2.2, col, t: 0.9, t0: 0.9 });
    if (gold) { WFX.push({ w: 1, X: x, Y: z, r: 4.5, col: "#ff9a3a", t: 1.2, t0: 1.2 }); S.shake = Math.max(S.shake || 0, 0.4); }
  }
  if (P.human) {
    sfx("merge"); if (star + 1 >= 3) sfx("level");
    S.mergeFx = { name: DEFS[d].n, star: star + 1, t: 1.6, t0: 1.6 };
  }
  merge(P, d, star + 1);
}
function mergeAll(P) { for (let star = 1; star <= 2; star++) for (let d = 0; d < DEFS.length; d++) merge(P, d, star); }
function sellValue(u) { const c = DEFS[u.d].c; return u.star === 1 ? c : c * Math.pow(3, u.star - 1) - 1; }
function sell(P, loc) {
  const u = getAt(P, loc); if (!u) return;
  P.gold += sellValue(u); S.pool[u.d] += Math.pow(3, u.star - 1);
  u.items.forEach((it) => giveItem(P, it));
  setAt(P, loc, null);
}
function giveItem(P, id) { if (ITEMS_ON && P.items.length < ITEM_MAX) P.items.push(id); }
function canAdd(u, id) { return (ITEMS[id].comp && u.items.some((x) => ITEMS[x].comp)) || u.items.length < 3; }
function addItem(u, id) {
  if (ITEMS[id].comp) {
    const ci = u.items.findIndex((x) => ITEMS[x].comp);
    if (ci >= 0) { u.items[ci] = comboKey(u.items[ci], id); return true; }
  }
  if (u.items.length < 3) { u.items.push(id); return true; }
  return false;
}
function equip(P, ii, loc) {
  const u = getAt(P, loc), id = P.items[ii];
  if (!u || !id || !addItem(u, id)) return false;
  P.items.splice(ii, 1);
  return true;
}
function addXp(P, n) {
  if (P.level >= 10) return;
  P.xp += n;
  while (P.level < 10 && P.xp >= XPNEED[P.level]) {
    P.xp -= XPNEED[P.level]; P.level++;
    if (P.human && S.phase !== "carousel") { sfx("level"); toast(`레벨 ${P.level}! 이제 ${P.level}명까지 배치할 수 있어요`); }
  }
  if (P.level >= 10) P.xp = 0;
}
function buyXp(P) { if (P.gold < 4 || P.level >= 10) return false; P.gold -= 4; addXp(P, 4); return true; }
function reroll(P) { if (P.gold < 2) return false; P.gold -= 2; refreshShop(P); return true; }
function autoFill(P) {
  // 영웅 증강 "피의 굶주림 이현": 보드에 이현 혼자 두었으면 일부러 혼자인 거라 채우지 않아요
  const onBoard = P.board.flat().filter(Boolean);
  if (P.buff && P.buff.lee && onBoard.length === 1 && DEFS[onBoard[0].d].n === "이현") return;
  const order = [3, 2, 4, 1, 5, 0, 6];
  for (let i = 0; i < BENCH && boardCount(P) < P.level; i++) {
    const u = P.bench[i]; if (!u) continue;
    const rg = CLASS[DEFS[u.d].k].rg, rows = rg <= 1 ? [0, 1, 2, 3] : [3, 2, 1, 0];
    let placed = false;
    for (const r of rows) { for (const c of order) if (!P.board[r][c]) { P.board[r][c] = u; P.bench[i] = null; placed = true; break; } if (placed) break; }
  }
}

// =============== 시너지 ===============
function traitCounts(defIdxs) {
  const cnt = {};
  [...new Set(defIdxs)].forEach((i) => DEFS[i].t.forEach((t) => (cnt[t] = (cnt[t] || 0) + 1)));
  return cnt;
}
function traitLvl(t, n) { return TRAITS[t].t.filter((x) => n >= x).length; }

// =============== 라운드 진행 ===============
function roundType(s, k) {
  if (s === 1) return k === 1 ? "carousel" : "pve";
  if (k === 4) return "carousel";
  if (k === 7) return "pve";
  return "pvp";
}
const alivePlayers = () => S.players.filter((p) => p.alive);
function startRound(first) {
  S.type = roundType(S.stage, S.k);
  if (!first) {
    for (const P of alivePlayers().filter(isLocal)) {
      const base = S.stage === 1 ? (S.k <= 3 ? 2 : 3) : 5;
      // 아직 줍지 않은 골드 구슬도 내 골드로 쳐요 (컴퓨터 반은 보상을 바로 받으니까)
      const orbGold = P.human ? (S.orbs || []).reduce((s, o) => s + o.gold, 0) : 0;
      const interest = Math.min(5, Math.floor((P.gold + orbGold) / 10));
      const st = Math.abs(P.streak), sb = st >= 6 ? 3 : st >= 5 ? 2 : st >= 3 ? 1 : 0;
      const inc = base + interest + sb + P.gpr + (P.human ? 0 : P.aiBonus || 0); // aiBonus: 그랜드마스터 · 챌린저 컴퓨터 반 추가 골드
      P.gold += inc;
      addXp(P, 2);
      if (!P.locked || P.shop.every((x) => x == null)) refreshShop(P);
      if (P.human) toast(`+${inc}골드 (기본 ${base}${interest ? ` · 이자 ${interest}` : ""}${sb ? ` · 연승/연패 ${sb}` : ""})`);
    }
  }
  if (S.type === "carousel") startCarousel(); else startPlan();
}
function nextRound() {
  const max = S.stage === 1 ? 4 : 7;
  if (S.k < max) S.k++; else { S.stage++; S.k = 1; }
  startRound(false);
}
function startPlan() {
  S.phase = "plan";
  S.timer = S.timerMax = S.stage === 1 ? 20 : 30;
  S.battle = null; S.sel = null; S.scout = null; S.opp = null; FLIP = false;
  const tier = AUG_ROUNDS[`${S.stage}-${S.k}`];
  for (const P of alivePlayers().filter(isLocal)) {
    mergeAll(P);
    if (tier && !P.human) { const a = aiAugment(P, augOptions(P, TIER_IX[tier])); P.augs.push(a.id); a.f(P); mergeAll(P); }
    if (!P.human) aiPlan(P);
  }
  if (tier && human().alive) showAugments(tier);
  renderUI();
}
// 손가락: 떼는 순간 한 번 실행. 뒤따라오는 클릭은 모든 버튼에서 무시해요 (한 번 탭 = 한 번 동작)
let TAP_T = 0, TAP_PENDING = false;
// 손가락 탭 뒤에는 브라우저가 클릭을 한 번 더 보내요. 그 클릭 하나는 (언제 오든) 버려요
document.addEventListener("click", (e) => { if (TAP_PENDING && performance.now() - TAP_T < 3000) { TAP_PENDING = false; e.stopPropagation(); e.preventDefault(); } }, true);
function tapButton(el, fn) {
  el.onpointerup = (e) => { if (e.pointerType === "mouse") return; TAP_T = performance.now(); TAP_PENDING = true; fn(); };
  el.onclick = () => fn();
}
function reportError(e) { try { toast("오류가 났어요: " + (e && e.message ? e.message : e)); } catch (x) {} }
window.addEventListener("error", (e) => reportError(e.error || e.message));
// 등급(ti)에 맞는 숫자를 넣은 증강 3개 (등급 전용 증강은 그 등급에서만)
function augOptions(P, ti) {
  return shuffle(AUGS.filter((a) => (ITEMS_ON || !["supplies", "complete"].includes(a.id)) && (a.id.startsWith("emb-") || !P.augs.includes(a.id)) && (!a.tiers || a.tiers.includes(ti))))
    .slice(0, 3).map((a) => { const v = a.v ? a.v[ti] : undefined; return { id: a.id, n: a.n, hero: !!a.hero, d: a.d(v), f: (Q) => a.f(Q, v) }; });
}
// 증강 카드 그림 · 한 줄 도움말 (보이는 것만)
const AUG_ICON = {
  money: "M5 7a7 3 0 1 0 14 0a7 3 0 1 0-14 0M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5",
  lunch: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3.5 2",
  study: "M3.5 5.5c3-1.2 6-1 8.5 1c2.5-2 5.5-2.2 8.5-1v13c-3-1.2-6-1-8.5 1c-2.5-2-5.5-2.2-8.5-1zM12 6.5v13",
  supplies: "M7 9a5 5 0 0 1 10 0v11.5H7zM9.5 7V5.5a2.5 2.5 0 0 1 5 0V7M7 13.5h10M10 13.5v3h4v-3",
  complete: "M4 9.5h16v4H4zM5.5 13.5h13v7h-13zM12 9.5v11M12 9.5c-2 0-5-.8-5-2.8s3-2.2 5 2.8c2-5 5-4.8 5-2.8s-3 2.8-5 2.8",
  sports: "M6.5 3.5h11v4a5.5 5.5 0 0 1-11 0zM9 20.5h6M12 13v7.5M6.5 5H3.5v1.5a3 3 0 0 0 3 3M17.5 5h3v1.5a3 3 0 0 1-3 3",
  wall: "M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6zM12 7.5v9M8.5 11h7",
  meat: "M3.5 13h17a8.5 8.5 0 0 1-17 0zM8 10c0-2 2-2 2-4M12 10c0-2 2-2 2-4M16 10c0-2 2-2 2-4",
  nurse: "M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z",
  honor: "M12 3l2.7 5.5 6 .9-4.35 4.25 1 6L12 16.8 6.65 19.65l1-6L3.3 9.4l6-.9z",
  "hero-lee": "M12 3c3 5 6.5 8 6.5 12a6.5 6.5 0 0 1-13 0c0-4 3.5-7 6.5-12zM9.5 15.5a2.5 2.5 0 0 0 2.5 2.5",
  pres: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  emb: "M12 2.8l8 4.6v9.2l-8 4.6l-8-4.6V7.4zM12 8.5v7M8.5 12h7",
};
const AUG_TIP = {
  money: "지금 바로 레벨 · 새로고침에 쓰기 좋아요", lunch: "일찍 고를수록 많이 벌어요", study: "빨리 레벨을 올리고 싶을 때",
  supplies: "아이템을 조합해서 핵심 친구에게", complete: "바로 강해지고 싶을 때", sports: "공격 속도가 중요한 팀에 좋아요",
  wall: "앞줄이 약할 때 버티기 좋아요", meat: "어떤 팀에도 무난해요", nurse: "체력이 적을 때 한 번 더 버티기",
  honor: "★2 친구를 바로 받아요", "hero-lee": "이현 한 명으로 버티는 영웅 증강", pres: "5코스트 정주환을 바로 받아요",
};
function augTip(P, a) {
  if (!a.id.startsWith("emb-")) return AUG_TIP[a.id] || "";
  const t = a.id.slice(4), n = traitCounts(sideOf(P).map((x) => x.spec.d))[t] || 0, nx = TRAITS[t] && TRAITS[t].t.find((x) => x > n);
  return n ? `지금 ${t} ${n}명${nx ? ` · ${nx}명까지 ${nx - n}` : ""}` : `${t} 시너지를 모을 때 좋아요`;
}
// 남은 시간 고리 (render3d.js 의 loop 가 계획 시간마다 불러요)
function augTick() {
  const t = Math.max(0, Math.ceil(S.augT)), frac = Math.max(0, Math.min(1, S.augT / 20));
  if ($("augsec2").textContent !== t + "초") { $("augsec").textContent = t; $("augsec2").textContent = t + "초"; $("augtimer").classList.toggle("low", t <= 5); }
  $("augtimer").style.setProperty("--f", (100 - frac * 100).toFixed(1));
}
function showAugments(tier, rerolled) {
  const P = human(), opts = augOptions(P, TIER_IX[tier]);
  S.augPending = true;
  $("augre").hidden = !!rerolled;
  tapButton($("augre"), () => { if (S.augPending) { sfx("buy"); showAugments(tier, true); } });
  const peek = (on) => { $("aug").classList.toggle("peek", on); $("augback").hidden = !on; };
  tapButton($("augpeek"), () => peek(true));
  tapButton($("augback"), () => peek(false));
  peek(false);
  $("augtier").textContent = `${tier} 증강`;
  $("augtier").className = "augtier t-" + tier;
  $("augs").innerHTML = opts.map((a, i) => `<button class="augcard t-${tier}${a.hero ? " hero" : ""}" data-i="${i}" style="--k:${i}" type="button">${a.hero ? `<span class="augbadge">영웅</span>` : ""}<span class="augicon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${AUG_ICON[a.id.startsWith("emb-") ? "emb" : a.id] || AUG_ICON.emb}"/></svg></span><b>${a.n}</b><span class="augdesc">${a.d}</span><small class="augtip">${augTip(P, a)}</small></button>`).join("");
  const choose = (i) => {
    if (!S.augPending) return;
    const a = opts[i]; S.augPending = false; $("aug").hidden = true; peek(false);
    try { P.augs.push(a.id); a.f(P); mergeAll(P); } catch (e) { reportError(e); }
    sfx("level"); toast(`증강: ${a.n}`); renderUI();
  };
  S.augChoose = () => choose(0);
  $("augs").querySelectorAll(".augcard").forEach((el) => tapButton(el, () => choose(+el.dataset.i)));
  S.augT = 20;
  augTick();
  $("aug").hidden = false;
}
function sideOf(P) {
  const out = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) if (P.board[r][c]) out.push({ spec: P.board[r][c], lr: r, c });
  return out;
}
function pveTeam(stage, k) {
  let list;
  if (stage === 1) list = k === 2 ? ["hw", "hw"] : k === 3 ? ["hw", "hw", "hw"] : ["hw", "hw", "quiz"];
  else if (stage === 2) list = ["perf", "perf", "perf"];
  else if (stage === 3) list = ["mid", "perf", "perf"];
  else if (stage === 4) list = ["fin", "perf", "perf", "perf"];
  else list = ["mock", "fin", "fin"];
  const scale = stage >= 5 ? 1 + 0.45 * (stage - 5) : 1, cols = [3, 2, 4, 1, 5];
  return list.map((m, i) => ({ spec: { mon: { ...MON[m], hp: MON[m].hp * scale, ad: MON[m].ad * scale } }, lr: 0, c: cols[i] }));
}
function pairUp() {
  const al = alivePlayers();
  let best = null;
  for (let t = 0; t < 25; t++) {
    const sh = shuffle([...al]), pairs = []; let rep = 0;
    for (let i = 0; i + 1 < sh.length; i += 2) { pairs.push({ a: sh[i], b: sh[i + 1], ghost: false }); if (sh[i].lastOpp === sh[i + 1].i) rep++; }
    if (sh.length % 2) { const x = sh[sh.length - 1]; pairs.push({ a: x, b: rnd(al.filter((p) => p !== x)), ghost: true }); }
    if (!best || rep < best.rep) best = { pairs, rep };
    if (!rep) break;
  }
  for (const p of best.pairs) {
    if (!p.ghost && p.b.human) [p.a, p.b] = [p.b, p.a];
    if (!p.ghost) { p.a.lastOpp = p.b.i; p.b.lastOpp = p.a.i; }
  }
  return best.pairs;
}
function startCombat() { if (NET.on && S.phase === "plan") return netWait(); startCombatNow(); }
function startCombatNow() {
  if ((S.phase !== "plan" && S.phase !== "wait") || S.augPending) return;
  collectOrbs(true);
  S.sel = null; S.scout = null; drag = null;
  autoFill(human());
  S.results = [];
  if (S.type === "pve") {
    for (const P of alivePlayers().filter(isLocal)) {
      const B = makeBattle(sideOf(P), pveTeam(S.stage, S.k), P.human, P, null);
      if (P.human) S.battle = B; else runBattle(B);
      S.results.push({ kind: "pve", a: P, B });
    }
    S.opp = null;
  } else {
    for (const pr of NET.on ? netPairs() : pairUp()) {
      const isH = pr.a.human || (pr.b.human && !pr.ghost); // 내 반이 다른 반의 "복제 상대"로만 뽑힌 판은 내 대결이 아니라서 화면에 띄우지 않아요
      const B = pr.net ? netBattle(pr) : makeBattle(sideOf(pr.a), sideOf(pr.b), isH, pr.a, pr.b);
      if (isH) { S.battle = B; S.opp = pr.a.human ? pr.b : pr.a; S.oppGhost = pr.ghost; } else runBattle(B);
      S.results.push({ kind: "pvp", ...pr, B });
    }
  }
  if (!S.battle) S.battle = makeBattle(sideOf(human()), [], true, human(), null);
  S.phase = "combat";
  sfx("start");
  renderUI();
}
function loot(P, win) {
  let comps = S.stage === 1 ? (S.k === 4 ? 2 : 1) : 2;
  let gold = S.stage === 1 ? S.k - 2 : 3;
  if (!win) { comps = Math.max(1, comps - 1); gold = 0; }
  const items = ITEMS_ON ? Array.from({ length: comps }, () => rnd(COMP).id) : [];
  if (!ITEMS_ON) gold += comps * 2;
  if (!P.human) { items.forEach((id) => giveItem(P, id)); P.gold += gold; return; }
  // 사람은 경기장에 떨어진 구슬을 마스코트로 주워요
  const drops = items.map((id) => ({ items: [id], gold: 0 }));
  if (!ITEMS_ON) { while (gold > 3) { drops.push({ items: [], gold: 2 }); gold -= 2; } }
  if (gold) drops.push({ items: [], gold });
  drops.forEach((o) => S.orbs.push({ ...o, x: -5 + Math.random() * 10, z: 1.6 + Math.random() * 3.2, born: performance.now() }));
  setTimeout(() => toast("골드 구슬! 빈 땅을 탭해서 마스코트로 주우세요"), 700);
}
function collectOrbs(all) {
  if (!S.orbs || !S.orbs.length) return;
  const P = human(), keep = [];
  for (const o of S.orbs) {
    if (all || Math.hypot(o.x - TACT.x, o.z - TACT.z) < 0.9) {
      o.items.forEach((id) => giveItem(P, id)); P.gold += o.gold;
      if (!all) { sfx("item"); toast(o.gold ? `+${o.gold}골드` : `${ITEMS[o.items[0]].n} 획득!`); }
      if (typeof WFX !== "undefined") WFX.push({ w: 1, X: o.x, Y: o.z, r: 1.2, col: o.gold ? "#f5d76e" : "#7fc4ff", t: 0.5, t0: 0.5 });
    } else keep.push(o);
  }
  S.orbs = keep; renderUI();
}
function finishCombat() {
  S.phase = "result";
  let hWin = null, hDmg = 0;
  const win = (P) => { if (P.remote) return; P.streak = Math.max(1, P.streak + 1); P.gold += 1; };
  const lose = (P, d) => { if (P.remote) return; P.hp -= d; P.streak = Math.min(-1, P.streak - 1); if (P.human) hDmg = d; };
  for (const R of S.results) {
    const B = R.B;
    const surv = (team) => B.f.filter((f) => f.alive && f.team === team && !(f.mon && f.mon.summon));
    const dmgFrom = (team) => STAGE_DMG[Math.min(S.stage, 7)] + surv(team).reduce((s, f) => s + (f.star >= 3 ? 2 : 1), 0);
    if (R.kind === "pve") {
      const w = B.win === 0;
      if (!w) lose(R.a, S.stage === 1 ? surv(1).length : dmgFrom(1));
      loot(R.a, w);
      if (R.a.human) hWin = w;
    } else {
      const { a, b, ghost } = R;
      if (B.win === 0) { win(a); if (!ghost) lose(b, dmgFrom(0)); }
      else if (B.win === 1) { lose(a, dmgFrom(1)); if (!ghost) win(b); }
      else { lose(a, dmgFrom(1)); if (!ghost) lose(b, dmgFrom(0)); }
      if (a.human) hWin = B.win === 0; else if (b.human && !ghost) hWin = B.win === 1; // 복제로 뽑힌 판의 결과로 승패를 띄우지 않아요
    }
  }
  // 탈락 처리
  const dead = alivePlayers().filter((p) => p.hp <= 0).sort((x, y) => x.hp - y.hp);
  let n = alivePlayers().length;
  for (const p of dead) {
    p.place = n--; p.alive = false;
    if (!p.remote) unitsOf(p).forEach((x) => (S.pool[x.u.d] += Math.pow(3, x.u.star - 1)));
    p.shop.forEach((d) => d != null && S.pool[d]++); p.shop = [];
    if (!p.human) setTimeout(() => toast(`${p.name} 탈락! (${p.place}등)`), 900);
  }
  S.banner = hWin ? { text: "승리!", col: TOK["--accent"], t: 1.8 } : { text: hDmg ? `패배  ♥-${hDmg}` : "패배", col: TOK["--danger"], t: 1.8 };
  sfx(hWin ? "win" : "lose");
  if (hWin != null) tactEmote(hWin ? "dance" : "cry"); // 내 마스코트: 이기면 춤, 지면 울어요
  S.resultT = 2.2;
  renderUI();
}
function afterResult() {
  const H = human();
  if (!H.alive) return gameOver(H.place);
  if (alivePlayers().length <= 1) { H.place = 1; return gameOver(1); }
  nextRound();
}
function gameOver(place) {
  S.phase = "over";
  netFinish();
  let best = 0; try { best = +localStorage.getItem(pkey("uri-best-place")) || 0; } catch (e) {}
  const newBest = !best || place < best;
  if (newBest) { try { localStorage.setItem(pkey("uri-best-place"), String(place)); } catch (e) {} }
  $("aug").hidden = true; S.augPending = false;
  recordGame(place, newBest && best > 0); // 결과 화면 · 영토 점수 · 기록 (social.js)
  tactEmote(place <= 4 ? "dance" : "cry", 4);
  sfx(place <= 4 ? "win" : "lose");
}

// =============== 급식 줄 (회전 선택 라운드) ===============
function startCarousel() {
  S.phase = "carousel"; S.battle = null; S.sel = null; S.scout = null; S.opp = null; FLIP = false;
  const s = S.stage;
  const costs = s === 1 ? [1] : s === 2 ? [1, 2] : s === 3 ? [2, 3] : s === 4 ? [3, 4] : [3, 3, 4, 4, 5];
  const opts = [];
  for (let i = 0; i < 9; i++) {
    // 상점과 같은 풀에서 꺼내요 (남은 수가 많은 친구가 더 자주 나와요)
    let d = null;
    for (let tries = 0; tries < 10 && d == null; tries++) {
      const cost = rnd(costs), cands = DEFS.map((_, j) => j).filter((j) => DEFS[j].c === cost && S.pool[j] > 0);
      let r = Math.random() * cands.reduce((t, j) => t + S.pool[j], 0);
      for (const j of cands) { r -= S.pool[j]; if (r < 0) { d = j; break; } }
    }
    if (d == null) { const left = DEFS.map((_, j) => j).filter((j) => S.pool[j] > 0); if (!left.length) break; d = rnd(left); } // 원하는 코스트가 다 떨어지면 남은 친구 아무나
    S.pool[d]--;
    opts.push({ d, item: ITEMS_ON ? rnd(COMP).id : null, taken: false });
  }
  const order = shuffle(alivePlayers().filter(isLocal)).sort((a, b) => a.hp - b.hp);
  S.car = { opts, order, turn: 0, t: 0, ang: 0, wait: 1.5, humanT: 12 };
  S.timer = S.timerMax = 1;
  renderUI();
}
function stepCarousel(dt) {
  const C = S.car; C.ang += dt * 0.35; C.t += dt;
  if (C.turn >= C.order.length) {
    if (C.t > 1) { C.opts.forEach((o) => { if (!o.taken) S.pool[o.d]++; }); S.car = null; nextRound(); } // 남은 친구는 풀로
    return;
  }
  if (C.t < C.wait) return;
  const P = C.order[C.turn];
  if (P.human) {
    C.humanT -= dt; S.timer = Math.max(0, C.humanT); S.timerMax = 12;
    if (C.humanT <= 0) carouselPick(P, rnd(C.opts.filter((o) => !o.taken)));
    return;
  }
  const free = C.opts.filter((o) => !o.taken);
  carouselPick(P, aiCarousel(P, free));
}
function carouselPick(P, o) {
  if (!o || o.taken) return;
  o.taken = true;
  const u = mkUnit(o.d); u.items = o.item ? [o.item] : [];
  const free = P.bench.indexOf(null), copies = unitsOf(P).filter((x) => x.u.d === o.d && x.u.star === 1).length;
  let got = true;
  if (free >= 0) P.bench[free] = u;
  else if (copies >= 2) { P.bench.push(u); merge(P, o.d, 1); P.bench.length = BENCH; } // 바로 합성돼서 자리가 생겨요
  else { got = false; P.gold += DEFS[o.d].c; S.pool[o.d]++; giveItem(P, o.item); } // 자리가 없으면 골드로 바꿔요
  S.car.turn++; S.car.t = 0; S.car.wait = 0.5;
  if (P.human) {
    sfx("buy");
    toast(!got ? `대기석이 가득 차서 ${DEFS[o.d].n} 대신 ${DEFS[o.d].c}골드를 받았어요` : o.item ? `${DEFS[o.d].n} + ${ITEMS[o.item].n} 획득!` : `${DEFS[o.d].n} 획득!`);
  }
  renderUI();
}

// =============== 컴퓨터 반 실력 = 내 티어 ===============
// 내 티어(tiers.js)가 높을수록 컴퓨터 반이 잘해요. skill 1 = 정석대로 다 하는 에메랄드 수준 AI, 낮을수록 실수가 많아요
//  · 실수: 레벨업 늦게 · 아무거나 사기 · 리롤 멈추기 · 이상하게 세우기 · 증강/급식 줄 아무거나
//  · 그랜드마스터 · 챌린저는 실수 없이 + 라운드마다 골드를 더 받아요 (AI_TIER_BONUS)
//  · 반마다 실력이 조금씩 달라요 (±AI_SKILL_SPREAD). tools/preview/aitier.js 로 티어별로 재 보며 정한 값
const AI_TIER_SKILL = [0.05, 0.18, 0.32, 0.46, 0.6, 0.72, 0.84, 0.94, 1, 1];
const AI_TIER_BONUS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const AI_SKILL_SPREAD = 0.12;
const myTier = () => { try { return tierOf(loadRecord().pts).i; } catch (e) { return 4; } };
function aiAssignSkill(t) {
  if (t == null) t = myTier();
  for (const P of S.players) {
    if (P.human || P.remote) continue;
    P.skill = Math.max(0, Math.min(1, AI_TIER_SKILL[t] + (Math.random() * 2 - 1) * AI_SKILL_SPREAD));
    P.aiBonus = AI_TIER_BONUS[t];
  }
}
const aiSk = (P) => (P.skill == null ? 1 : P.skill);
const aiSlip = (P, k = 1) => Math.random() * k > aiSk(P); // 실수할까? (실력이 낮을수록 자주)

// =============== 컴퓨터(AI) 반 — 에메랄드 수준 ===============
// 팀 세기를 숫자로 계산해서(친구 세기 × 시너지) 가장 센 배치를 고르고, 정석대로 레벨업 · 리롤 · 증강을 골라요.
//  · aiVal: 친구 한 명의 세기  · aiTeamScore: 보드 전체 세기  · aiBestBoard: 가진 친구 중 가장 센 조합
//  · aiPlan: 계획 단계 (레벨업 → 사기/리롤 → 대기석 정리 → 배치)  · aiAugment: 증강 고르기  · aiCarousel: 급식 줄 고르기
// 시너지 단계별로 팀 세기에 더하는 비율. 무작위 팀끼리 8천 번 싸운 결과에 맞춘 값이에요 (이긴 팀을 93% 맞혀요)
// 친구나 특성을 바꾸면 다시 맞추면 좋아요. 신 · 연인 값이 큰 건 5코스트(정주환 · 김예균)가 같이 오기 때문이에요
// 합체로봇은 무작위 팀에 네 명이 다 모이는 일이 드물어서, balance.js 의 합체로봇 팀 승률(약 70%)을 보고 정했어요
const AI_TRAIT = {
  "운동광": [0, 0.06, 0.43, 0.47], "지는 거 못 참음": [0, 0.06, 0.21, 0.44], "공부는 잘함": [0, 0.01, 0.11, 0.41],
  "다 퍼줌": [0, -0.05, 0.03], "축구부": [0, 0.18, 0.55, 0.79], "댄스부": [0, 0.11, 0.13], "연인": [0, 0.52],
  "선생님": [0, 0.12], "합체로봇": [0, 0.3], "신": [0, 0.54],
  "율겸": [0, 0.1, 0.21, 0.39, 0.69], // 팀 모두 공격력·체력 +5/10/18/30% → 세기는 약 (1+x)² 배
};
const AI_SOLO = 0.06; // 혼자 켜지는 특성 (수학왕 · 프로게이머 · 전교 1등 · 화학왕)
// 친구 한 명의 세기: 체력과 공격력이 코스트 · 별에 따라 같이 커져요 (★1 1코스트 = 1)
function aiVal(u) {
  const def = DEFS[u.d], cf = 1 + (def.c - 1) * 0.22, tn = tuneOf(def);
  let v = (cf * STARM[u.star]) ** 1.6 * ((tn.hp + tn.ad) / 2) ** 0.73;
  if (def.c === 5 && u.star >= 3) v *= 4; // 전설
  return v;
}
function aiTeamScore(units, P) {
  const n = units.length; if (!n) return 0;
  const cnt = traitCounts(units.map((u) => u.d));
  for (const [t, k] of Object.entries(P.emb || {})) cnt[t] = (cnt[t] || 0) + k;
  let mult = 1, sum = 0, melee = 0;
  for (const [t, k] of Object.entries(cnt)) { const lv = traitLvl(t, k); if (lv) mult += AI_TRAIT[t] ? AI_TRAIT[t][Math.min(lv, AI_TRAIT[t].length - 1)] : AI_SOLO; }
  for (const u of units) { sum += aiVal(u); if (CLASS[DEFS[u.d].k].rg <= 1) melee++; }
  if (n >= 3 && melee < Math.min(2, n / 3)) mult *= 0.98; // 앞에서 버틸 친구가 없으면 뒷줄이 바로 맞아요
  if (n >= 4 && melee === n) mult *= 0.92;
  return sum * mult;
}
// 가진 친구 중 레벨만큼 골라 가장 센 조합 (센 순서로 고른 뒤, 하나씩 맞바꿔 보며 더 세지면 바꿔요)
function aiBestBoard(P, all) {
  all = all || unitsOf(P).map((x) => x.u);
  let pick = all.slice().sort((a, b) => aiVal(b) - aiVal(a)).slice(0, Math.min(P.level, all.length));
  let best = aiTeamScore(pick, P);
  for (let pass = 0; pass < 3; pass++) {
    let better = false;
    for (let i = 0; i < pick.length; i++) for (const o of all) {
      if (pick.includes(o)) continue;
      const trial = pick.slice(); trial[i] = o;
      const sc = aiTeamScore(trial, P);
      if (sc > best + 1e-9) { pick = trial; best = sc; better = true; }
    }
    if (!better) break;
  }
  return { pick, score: best };
}
// 새 친구(u)가 들어오면 지금 가장 센 조합이 얼마나 세지는지 (빈자리에 넣거나 한 명과 바꿔 보기)
function aiGain(P, base, u) {
  let best = 0;
  if (base.pick.length < P.level) best = aiTeamScore([...base.pick, u], P) - base.score;
  for (let i = 0; i < base.pick.length; i++) { const t = base.pick.slice(); t[i] = u; best = Math.max(best, aiTeamScore(t, P) - base.score); }
  return best;
}
// 친구 d 를 한 명 더 얻으면 얼마나 좋은지 (합성 · 보드가 세지는 정도 · 앞으로 ★2 가능성)
function aiWant(P, d, base) {
  const own = unitsOf(P).filter((x) => x.u.d === d), n1 = own.filter((x) => x.u.star === 1).length, n2 = own.filter((x) => x.u.star === 2).length;
  const u1 = { d, star: 1 }, u2 = { d, star: 2 }, u3 = { d, star: 3 };
  if (n1 === 2 && n2 === 2) return 50 + aiVal(u3); // ★3 완성
  if (n1 === 2) return 10 + Math.max(aiGain(P, base, u2), aiVal(u2) * 0.3); // ★2 완성
  const gain = aiGain(P, base, u1);
  const onBoard = base.pick.some((u) => u.d === d);
  let v = gain;
  if (n1 === 1 || (n2 >= 1 && onBoard)) v += aiVal(u2) * (onBoard ? 0.35 : 0.2); // 짝(2장) 만들기
  else if (n1 === 0 && n2 === 0) v += aiVal(u1) * 0.05;
  return v;
}
// 정석 레벨업 시점: 2-1 4레벨 · 2-5 5레벨 · 3-2 6레벨 · 3-5 7레벨 · 4-1 8레벨 · 5-2 9레벨
function aiLevelTarget(P) {
  const s = S.stage, k = S.k;
  if (s === 1) return 3;
  if (s === 2) return k >= 5 ? 5 : 4;
  if (s === 3) return k >= 5 ? 7 : k >= 2 ? 6 : 5;
  if (s === 4) return 8;
  if (s === 5) return k >= 2 ? 9 : 8;
  return P.gold >= 40 ? 10 : 9;
}
function aiPlan(P) {
  const s = S.stage, k = S.k;
  // 골드를 얼마나 남길지: 3단계까지는 이자(50), 4단계부터 30, 체력이 낮으면 다 써요 (tools/preview/ai.js 로 재 보며 정한 값)
  const hp = P.hp, weak = P.streak <= -2;
  let floor = hp <= 30 ? 0 : s >= 4 ? (hp <= 60 ? 0 : weak ? 20 : 30) : hp <= 50 ? 10 : weak && s >= 3 ? 30 : 50;
  if (s === 4 && k === 2 && !P.rolled42 && P.level >= 8) { P.rolled42 = 1; floor = Math.min(floor, hp > 75 ? 20 : 10); } // 4-2: 8레벨에서 한 번 크게 굴려 보드를 완성해요
  if (s === 3 && k === 2 && hp < 70) floor = Math.min(floor, 20); // 3-2: 체력이 깎였으면 6레벨에서 굴려요
  // 1) 레벨업: 정석 시점에는 이자보다 레벨이 먼저
  let target = aiLevelTarget(P);
  if (aiSlip(P)) target -= aiSk(P) < 0.25 ? 1 + Math.floor(Math.random() * 2) : 1; // 실수: 레벨업을 깜빡
  if (aiSlip(P)) floor = [0, 10, 50][Math.floor(Math.random() * 3)]; // 실수: 골드 관리를 엉망으로
  while (P.level < target && buyXp(P));
  while (P.level < 9 && s >= 4 && P.gold - 4 >= Math.max(floor, 50) + 4 && buyXp(P)); // 골드가 넘치면 더 올려요
  // 2) 사기 · 리롤
  const buyFloor = s <= 2 ? 0 : s === 3 ? Math.min(floor, 30) : floor; // 초반엔 짝 · 합성에 아낌없이 (리롤은 안 해요)
  for (let loop = 0; loop < 40; loop++) {
    aiBuyPass(P, buyFloor);
    const base = aiBestBoard(P); // 보드가 다 ★2 면 그만 굴려요
    const done = P.level >= 8 && base.pick.length >= P.level && base.pick.every((u) => u.star >= 2);
    if (s < 2 || (s === 2 && hp > 50) || done || P.gold - 2 < floor) break;
    if (s === 3 && hp > 60 && floor >= 50) break; // 3단계엔 체력이 넉넉하면 아껴요
    if (aiSlip(P, 1.4)) break; // 실수: 굴리다 그만둬요
    reroll(P);
  }
  aiTrim(P);
  aiArrange(P);
}
function aiBuyPass(P, floor) {
  let base = aiBestBoard(P);
  for (let i = 0; i < 5; i++) {
    const d = P.shop[i]; if (d == null || P.gold < DEFS[d].c) continue;
    const w = aiWant(P, d, base) + (Math.random() - 0.5) * (1 - aiSk(P)) * 14, c = DEFS[d].c; // 실력이 낮으면 아무거나 사요
    const spare = P.gold - c >= floor;
    // 합성은 거의 언제나, 보드가 세지면 남는 골드로, 짝 만들기는 여유 있을 때
    const take = w >= 10 || (w > 0.6 && (spare || base.pick.length < P.level)) || (w > 0.25 && spare && P.gold - c >= floor + 6);
    if (!take) continue;
    if (P.bench.indexOf(null) < 0 && w < 10 && !aiMakeRoom(P, w)) continue;
    if (buy(P, i)) base = aiBestBoard(P);
  }
}
// 대기석이 꽉 찼을 때: 새 친구(w)보다 덜 중요한 친구를 팔아 자리를 만들어요
function aiMakeRoom(P, w) {
  const base = aiBestBoard(P);
  let worst = -1, ws = 1e9;
  P.bench.forEach((u, i) => { if (!u || base.pick.includes(u)) return; const v = aiKeep(P, u, base); if (v < ws) { ws = v; worst = i; } });
  if (worst < 0 || ws >= w) return false;
  sell(P, { w: "n", i: worst }); return true;
}
// 대기석 친구를 남겨 둘 가치 (짝이 있거나 ★2 면 높아요)
function aiKeep(P, u, base) {
  const same = unitsOf(P).filter((x) => x.u.d === u.d && x.u.star === u.star).length;
  return aiVal(u) * (u.star >= 2 ? 1.2 : 0.4) + (same >= 2 ? aiVal({ d: u.d, star: u.star + 1 }) * 0.4 : 0) + (base.pick.some((x) => x.d === u.d) ? 1 : 0);
}
// 대기석 정리: 보드에 안 쓰고 짝도 없는 친구부터 팔아서 6칸 이하로 (풀이 마르지 않게)
function aiTrim(P) {
  const keep = S.stage <= 2 ? 6 : 5;
  for (let guard = 0; guard < BENCH; guard++) {
    const base = aiBestBoard(P), bench = unitsOf(P).filter((x) => !base.pick.includes(x.u));
    if (bench.length <= keep) return;
    bench.sort((a, b) => aiKeep(P, a.u, base) - aiKeep(P, b.u, base));
    sell(P, bench[0].w === "b" ? { w: "b", r: bench[0].r, c: bench[0].c } : { w: "n", i: bench[0].i });
  }
}
// 배치: 수호자를 앞줄 가운데, 돌격대는 앞줄 양옆, 원거리는 뒷줄에 서로 떨어뜨려 (광역 스킬을 덜 맞게) — 가장 센 원거리는 구석
function aiArrange(P) {
  const all = unitsOf(P).map((x) => x.u);
  let { pick } = aiBestBoard(P, all);
  if (aiSlip(P)) { const rest = all.filter((u) => !pick.includes(u)); if (rest.length && pick.length) pick = pick.slice(0, -1).concat(rest[Math.floor(Math.random() * rest.length)]); } // 실수: 센 친구 대신 다른 친구
  if (aiSk(P) < 0.3 && pick.length > 2 && Math.random() < 0.35) pick = pick.slice(0, -1); // 실수: 한 자리를 비워 둬요
  const messy = aiSlip(P, 1.2);
  P.board = Array.from({ length: 4 }, () => Array(COLS).fill(null));
  P.bench = Array(BENCH).fill(null);
  const rg = (u) => CLASS[DEFS[u.d].k].rg, byVal = (a, b) => aiVal(b) - aiVal(a);
  const tanks = pick.filter((u) => DEFS[u.d].k === "수호자").sort(byVal), divers = pick.filter((u) => rg(u) <= 1 && DEFS[u.d].k !== "수호자").sort(byVal);
  const mids = pick.filter((u) => rg(u) === 2).sort(byVal), backs = pick.filter((u) => rg(u) >= 3).sort(byVal);
  const put = (u, cells) => { if (messy) cells = shuffle(cells.slice()); for (const [r, c] of cells) if (!P.board[r][c]) { P.board[r][c] = u; return true; } return false; }; // 실수: 아무 데나 세워요
  const FRONT = [[0, 3], [0, 2], [0, 4], [0, 1], [0, 5], [0, 0], [0, 6]], SECOND = [[1, 3], [1, 2], [1, 4], [1, 1], [1, 5], [1, 0], [1, 6]];
  const BACK = [[3, 0], [3, 6], [3, 2], [3, 4], [2, 1], [2, 5], [3, 3], [2, 3], [3, 1], [3, 5], [2, 0], [2, 6], [2, 2], [2, 4]];
  tanks.forEach((u) => put(u, [...FRONT, ...SECOND]));
  divers.forEach((u) => put(u, [[0, 1], [0, 5], [0, 2], [0, 4], [0, 0], [0, 6], [0, 3], ...SECOND]));
  mids.forEach((u) => put(u, [...SECOND, ...FRONT]));
  backs.forEach((u) => put(u, [...BACK, ...SECOND]));
  all.filter((u) => !pick.includes(u)).sort(byVal).forEach((u, i) => { if (i < BENCH) P.bench[i] = u; else { P.gold += sellValue(u); S.pool[u.d] += Math.pow(3, u.star - 1); } }); // 넘치면 팔아요
}
// 증강 고르기: 등급별 증강 가치 (예전 컴퓨터 반끼리 수천 번 무작위로 골라 본 평균 등수에서 뽑은 값, 높을수록 좋아요)
const AI_AUG = { sports: [6, 8, 8], meat: [1, 10, 6], wall: [0, 6, 6], lunch: [6, 5, -2], money: [0, -1, 5], nurse: [-1, -1, 4],
  study: [-2, -1, -2], honor: [-2, -2, -1], "hero-lee": [2, -5, 0], pres: [0, 0, 4], emb: [-2, -3, -5] };
function aiAugment(P, opts) {
  const ti = TIER_IX[AUG_ROUNDS[`${S.stage}-${S.k}`]] ?? 0, base = aiBestBoard(P);
  const val = (a) => {
    if (!a.id.startsWith("emb-")) return (AI_AUG[a.id] || [0, 0, 0])[ti];
    const t = a.id.slice(4), cnt = traitCounts(base.pick.map((u) => u.d)), n = (cnt[t] || 0) + (P.emb[t] || 0);
    return traitLvl(t, n + 1) > traitLvl(t, n) ? 6 : AI_AUG.emb[ti]; // 배지: 지금 보드의 시너지가 한 단계 오르면 좋아요
  };
  if (aiSlip(P)) return rnd(opts); // 실수: 아무 증강
  return opts.slice().sort((a, b) => val(b) - val(a))[0];
}
// 급식 줄: 합성 · 보드에 가장 도움이 되는 친구
function aiCarousel(P, free) {
  if (aiSlip(P)) return rnd(free); // 실수: 아무 친구
  const base = aiBestBoard(P);
  return free.slice().sort((x, y) => aiWant(P, y.d, base) - aiWant(P, x.d, base))[0];
}
