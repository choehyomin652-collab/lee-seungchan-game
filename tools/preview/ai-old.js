// 예전 컴퓨터 반 AI (브론즈 수준) — tools/preview/ai.js 에서 새 AI 와 겨루게 할 때 써요. 게임에는 안 들어가요
// =============== 컴퓨터(AI) 반 ===============
function aiUnitScore_old(P, d) {
  const def = DEFS[d], own = unitsOf(P).filter((x) => x.u.d === d);
  let s = own.length * 2.2 + def.t.filter((t) => P.plan.includes(t)).length * 1.5 + def.c * 0.3;
  if (own.some((x) => x.u.star === 3)) s -= 10;
  return s;
}
function unitPower_old(P, u) {
  const def = DEFS[u.d];
  return def.c * Math.pow(3, u.star - 1) + def.t.filter((t) => P.plan.includes(t)).length * 0.8 + u.items.length * 1.5;
}
function aiMakeRoom_old(P) {
  while (!P.bench.includes(null)) {
    let worst = -1, ws = 1e9;
    P.bench.forEach((u, i) => { if (!u) return; const sc = aiUnitScore_old(P, u.d) + u.star * 3; if (sc < ws) { ws = sc; worst = i; } });
    sell(P, { w: "n", i: worst });
  }
}
function aiPlan_old(P) {
  const s = S.stage, k = S.k;
  const target = s === 1 ? 3 : s === 2 ? (k >= 5 ? 5 : 4) : s === 3 ? (k >= 2 ? 6 : 5) : s === 4 ? (k >= 2 ? 8 : 7) : s === 5 ? 8 : 9;
  const floor = P.hp < 35 ? 0 : s >= 5 ? 20 : s >= 4 ? 30 : 50;
  while (P.level < target && buyXp(P));
  for (let loop = 0; loop < 25; loop++) {
    for (let i = 0; i < 5; i++) {
      const di = P.shop[i]; if (di == null || P.gold < DEFS[di].c) continue;
      const total = unitsOf(P).length, sc = aiUnitScore_old(P, di);
      const need = total < P.level + 1;
      const want = need || (sc >= 2.2 && (P.gold - DEFS[di].c >= floor * 0.5 || s <= 2)) || (sc >= 1.8 && P.gold - DEFS[di].c >= floor);
      if (!want) continue;
      if (!buy(P, i)) { aiMakeRoom_old(P); buy(P, i); }
    }
    if (s >= 3 && P.gold - 2 >= floor && P.gold >= 2) reroll(P); else break;
  }
  if (P.bench.filter(Boolean).length > 7) aiMakeRoom_old(P);
  aiArrange_old(P);
  aiTrim_old(P, s <= 2 ? 5 : 4);
  aiItems_old(P);
}
// 컴퓨터 반이 대기석에 친구를 쌓아 두면 풀이 바닥나서 다른 반(사람 포함) 상점에 친구가 안 떠요.
// 대기석은 keep 칸까지만 두고, 합성 가능성이 낮은 친구부터 팔아요.
function aiTrim_old(P, keep) {
  for (let guard = 0; guard < BENCH; guard++) {
    const bench = P.bench.map((u, i) => ({ u, i })).filter((x) => x.u);
    if (bench.length <= keep) return;
    const copies = (d) => unitsOf(P).filter((x) => x.u.d === d).length;
    bench.sort((a, b) => (copies(a.u.d) >= 2) - (copies(b.u.d) >= 2) || (aiUnitScore_old(P, a.u.d) + a.u.star * 3) - (aiUnitScore_old(P, b.u.d) + b.u.star * 3));
    sell(P, { w: "n", i: bench[0].i });
  }
}
function aiArrange_old(P) {
  const all = unitsOf(P).map((x) => x.u);
  P.board = Array.from({ length: 4 }, () => Array(COLS).fill(null));
  P.bench = Array(BENCH).fill(null);
  all.sort((a, b) => unitPower_old(P, b) - unitPower_old(P, a));
  const order = [3, 2, 4, 1, 5, 0, 6], used = [0, 0, 0, 0];
  all.slice(0, P.level).forEach((u) => {
    const rg = CLASS[DEFS[u.d].k].rg;
    const pref = rg <= 1 ? [0, 1, 2, 3] : rg === 2 ? [1, 2, 0, 3] : [3, 2, 1, 0];
    for (const r of pref) if (used[r] < COLS) { P.board[r][order[used[r]++]] = u; break; }
  });
  all.slice(P.level).forEach((u, i) => { if (i < BENCH) P.bench[i] = u; });
}
function aiItems_old(P) {
  const board = unitsOf(P).filter((x) => x.w === "b").sort((a, b) => unitPower_old(P, b.u) - unitPower_old(P, a.u));
  if (!board.length) return;
  for (let ii = P.items.length - 1; ii >= 0; ii--) {
    const id = P.items[ii];
    const top = board.slice(0, 3);
    const t = (ITEMS[id].comp && top.find((x) => x.u.items.some((z) => ITEMS[z].comp))) || board.find((x) => canAdd(x.u, id));
    if (t) equip(P, ii, t);
  }
}
