// 밸런스 재기: 같은 코스트 구성(1·2·2·3·3코 ★2 + 4·4·5코 ★1)의 무작위 팀끼리 전투를 많이 돌려
// 친구별 승률(그 친구가 있는 팀이 이긴 비율)·특성 단계별 승률·합체로봇 팀 승률을 보여 줘요. 아이템·증강은 빼요
// 사용: node tools/preview/balance.js . [판 수=4000]   (12000판에 몇 분 걸려요)
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const dir = path.resolve(process.argv[2]), N = +process.argv[3] || 4000;
const mini = fs.readFileSync(path.join(dir, "tools/preview/mini-three.js"), "utf8");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await p.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); if (u.includes("three.min.js")) return r.fulfill({ contentType: "text/javascript", body: mini }); return r.abort(); });
  await p.goto("file://" + dir + "/index.html"); await p.waitForTimeout(1500);
  const res = await p.evaluate((N) => {
    const PROF = [[1, 2], [2, 2], [2, 2], [3, 2], [3, 2], [4, 1], [4, 1], [5, 1]];
    const byCost = {}; DEFS.forEach((d, i) => (byCost[d.c] = byCost[d.c] || []).push(i));
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    function team(forced) {
      const used = new Set(), specs = [];
      PROF.forEach(([c, s], k) => { let d; do { d = pick(byCost[c]); } while (used.has(d)); used.add(d); specs.push({ d, star: s }); });
      if (forced) forced(specs, used);
      const melee = specs.filter((x) => CLASS[DEFS[x.d].k].rg <= 1), rest = specs.filter((x) => CLASS[DEFS[x.d].k].rg > 1);
      const cols = [3, 2, 4, 1, 5, 0, 6], out = []; let fi = 0, bi = 0;
      melee.forEach((x) => { const lr = fi < 7 ? 0 : 1; out.push({ spec: mkUnit(x.d, x.star), lr, c: cols[fi++ % 7] }); });
      rest.forEach((x) => { const lr = bi < 7 ? 3 : 2; out.push({ spec: mkUnit(x.d, x.star), lr, c: cols[bi++ % 7] }); });
      return out;
    }
    const P0 = () => ({ emb: {}, buff: null });
    function fight(a, bb) { const B = makeBattle(a, bb, false, P0(), P0()); runBattle(B); return B.win; }
    const unit = DEFS.map(() => [0, 0]), trait = {}, draws = [0];
    for (let i = 0; i < N; i++) {
      const A = team(), Bt = team(), w = fight(A, Bt);
      if (w == null) { draws[0]++; continue; }
      [[A, w === 0], [Bt, w === 1]].forEach(([T, won]) => {
        T.forEach((x) => { unit[x.spec.d][0] += won; unit[x.spec.d][1]++; });
        const cnt = traitCounts(T.map((x) => x.spec.d));
        for (const t of Object.keys(TRAITS)) { const L = traitLvl(t, cnt[t] || 0); const k = t + " " + L; trait[k] = trait[k] || [0, 0]; trait[k][0] += won; trait[k][1]++; }
      });
    }
    // 합체로봇 4명을 넣은 팀 vs 무작위 팀
    const RB = ["이보경", "윤동욱", "조하윤", "박희찬"].map((n) => DEFS.findIndex((d) => d.n === n));
    let rw = 0, rn = 0;
    for (let i = 0; i < 800; i++) {
      const A = team((specs, used) => { RB.forEach((d) => { if (used.has(d)) return; const c = DEFS[d].c; const k = specs.findIndex((x) => DEFS[x.d].c === c && !RB.includes(x.d)); if (k >= 0) { used.delete(specs[k].d); specs[k] = { d, star: specs[k].star }; used.add(d); } }); });
      const w = fight(A, team()); if (w == null) continue; rn++; rw += w === 0;
    }
    return { unit: DEFS.map((d, i) => [d.n, d.c, unit[i][1] ? unit[i][0] / unit[i][1] : 0, unit[i][1]]), trait, draws: draws[0], robot: [rw / rn, rn] };
  }, N);
  if (process.argv.includes("--json")) console.log(JSON.stringify(res));
  else {
    const pc = (w, n) => (n ? (w / n * 100).toFixed(1) + "%" : "-");
    res.unit.sort((a, b) => a[1] - b[1] || b[2] - a[2]).forEach(([n, c, w]) => console.log(`${c}코 ${n}\t${(w * 100).toFixed(1)}%`));
    console.log("--- 특성 (이름 단계: 승률)");
    Object.entries(res.trait).sort().forEach(([k, [w, n]]) => n > 100 && console.log(`${k}: ${pc(w, n)}`));
    console.log(`--- 합체로봇 4명 넣은 팀: ${(res.robot[0] * 100).toFixed(1)}%  무승부 ${res.draws}`);
  }
  if (errs.length) console.error("오류", errs.slice(0, 3)); await b.close();
})();
