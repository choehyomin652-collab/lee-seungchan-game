// 컴퓨터 반 실력 재기: 한 판에 예전 AI(ai-old.js, 브론즈 수준)와 지금 AI(game.js)를 섞어 끝까지 돌려 평균 등수를 비교해요
// 사용: node tools/preview/ai.js . [판 수=50] [A=old] [B=new] [B 반 수=4]
//   예) node tools/preview/ai.js . 200 old new 1   → 지금 AI 1반 + 예전 AI 7반 (에메랄드 기준: 평균 2등 안팎, 1등 60% 이상)
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const repo = path.resolve(process.argv[2] || "."), N = +process.argv[3] || 50, A = process.argv[4] || "old", Bk = process.argv[5] || "new", NB = +process.argv[6] || 4;
const mini = fs.readFileSync(path.join(repo, "tools/preview/mini-three.js"), "utf8");
const oldSrc = fs.readFileSync(path.join(__dirname, "ai-old.js"), "utf8");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await p.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); if (u.includes("three.min.js")) return r.fulfill({ contentType: "text/javascript", body: mini }); return r.abort(); });
  await p.goto("file://" + repo + "/index.html"); await p.waitForTimeout(1200);
  await p.addScriptTag({ content: oldSrc });
  const res = await p.evaluate(({ N, A, Bk, NB }) => {
    renderUI = () => {}; toast = () => {}; sfx = () => {}; showAugments = () => {}; tactEmote = () => {};
    const newPlan = aiPlan, newAug = aiAugment, newCar = aiCarousel, sp0 = startPlan; let spMax = 0, spSum = 0, spN = 0;
    startPlan = function () { const t0 = performance.now(); sp0(); const dt = performance.now() - t0; spMax = Math.max(spMax, dt); spSum += dt; spN++; };
    let tPlan = 0, nPlan = 0, tMax = 0;
    aiPlan = (P) => { const t0 = performance.now(); P.kind === "old" ? aiPlan_old(P) : newPlan(P); const dt = performance.now() - t0; if (P.kind !== "old") { tPlan += dt; nPlan++; tMax = Math.max(tMax, dt); } };
    aiAugment = (P, o) => (P.kind === "old" ? rnd(o) : newAug(P, o));
    aiCarousel = (P, free) => (P.kind === "old" ? free.slice().sort((x, y) => aiUnitScore_old(P, y.d) - aiUnitScore_old(P, x.d))[0] : newCar(P, free));
    const place = { [A + "A"]: [], [Bk + "B"]: [] }, top4 = { [A + "A"]: 0, [Bk + "B"]: 0 }, wins = { [A + "A"]: 0, [Bk + "B"]: 0 };
    const lvl = { [A + "A"]: [], [Bk + "B"]: [] }, hpAt = {}, lvAt = {}, gAt = {}, hist = { [A + "A"]: Array(9).fill(0), [Bk + "B"]: Array(9).fill(0) };
    const augPl = {};
    for (let g = 0; g < N; g++) {
      newGame();
      const idx = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      S.players.forEach((P) => { P.human = false; P.skill = 1; P.aiBonus = 0; }); // 티어별 실력(aiAssignSkill)은 빼고 재요
      idx.forEach((i, j) => { S.players[i].kind = j < 8 - NB ? A : Bk; S.players[i].grp = j < 8 - NB ? A + "A" : Bk + "B"; });
      let guard = 0;
      while (guard++ < 200) {
        if (S.phase === "carousel") { let n = 0; while (S.car && n++ < 400) stepCarousel(0.5); continue; }
        if (S.phase === "plan") { if (S.k === 1 && S.stage >= 2 && S.stage <= 5) for (const P of S.players) { const key = P.grp + " " + S.stage + "-1"; (hpAt[key] = hpAt[key] || []).push(P.alive ? P.hp : 0); (lvAt[key] = lvAt[key] || []).push(P.level); (gAt[key] = gAt[key] || []).push(P.gold); }
          startCombatNow(); finishCombat(); if (alivePlayers().length <= 1) break; if (S.stage >= 9) break; nextRound(); continue; }
        break;
      }
      const al = alivePlayers().sort((x, y) => y.hp - x.hp); al.forEach((P, i) => (P.place = i + 1));
      for (const P of S.players) { place[P.grp].push(P.place); if (P.place <= 4) top4[P.grp]++; if (P.place === 1) wins[P.grp]++; hist[P.grp][P.place]++; P.augs.forEach((id, ti) => { const key = ti + ":" + (id.startsWith("emb-") ? "emb" : id); (augPl[key] = augPl[key] || []).push(P.place); }); lvl[P.grp].push(P.level); }
    }
    const avg = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2);
    const out = {};
    for (const k of Object.keys(place)) out[k] = `평균 ${avg(place[k])}등 · 4등 안 ${Math.round(100 * top4[k] / place[k].length)}% · 1등 ${Math.round(100 * wins[k] / place[k].length)}% · 끝 레벨 ${avg(lvl[k])}`;
    for (const k of Object.keys(hist)) out["등수분포 " + k] = hist[k].slice(1).join(" ");
    for (const k of Object.keys(hpAt).sort()) out[k] = `체력 ${avg(hpAt[k])} · 레벨 ${avg(lvAt[k])} · 골드 ${avg(gAt[k])}`;
    out.aug = Object.keys(augPl).sort().map((k) => `${k} ${avg(augPl[k])}(${augPl[k].length})`).join(" | ");
    out.round = `라운드 시작(모든 반 계획) 평균 ${(spSum / spN).toFixed(1)}ms, 최대 ${spMax.toFixed(0)}ms`;
    out.time = `새 AI 계획 평균 ${(tPlan / Math.max(1, nPlan)).toFixed(1)}ms, 최대 ${tMax.toFixed(0)}ms`;
    return out;
  }, { N, A, Bk, NB });
  console.log(res); console.log("errors", errs.slice(0, 5));
  await b.close();
})();
