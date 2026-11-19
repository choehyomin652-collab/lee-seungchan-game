// 티어별 컴퓨터 반 실력 재기: 정석 AI(실력 1, 보너스 없음) 1반 vs 그 티어 컴퓨터 7반으로 끝까지 돌려 정석 AI 의 평균 등수
// 사람이 정석 AI 만큼 잘한다고 치면, 티어가 오를수록 등수가 내려가야 해요 (아이언 1등 근처 → 챌린저 4~5등)
// 사용: node tools/preview/aitier.js . [티어별 판 수=40] [티어들=0,2,4,6,8,9]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const repo = path.resolve(process.argv[2] || "."), N = +process.argv[3] || 40, TL = (process.argv[4] || "0,2,4,6,8,9").split(",").map(Number);
const mini = fs.readFileSync(path.join(repo, "tools/preview/mini-three.js"), "utf8");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await p.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); if (u.includes("three.min.js")) return r.fulfill({ contentType: "text/javascript", body: mini }); return r.abort(); });
  await p.goto("file://" + repo + "/index.html"); await p.waitForTimeout(1200);
  for (const t of TL) {
    const r = await p.evaluate(({ N, t }) => {
      renderUI = () => {}; toast = () => {}; sfx = () => {}; showAugments = () => {}; tactEmote = () => {};
      const pl = [];
      for (let g = 0; g < N; g++) {
        newGame();
        S.players.forEach((P) => (P.human = false));
        aiAssignSkill(t); const ref = S.players[0]; ref.skill = 1; ref.aiBonus = 0;
        let guard = 0;
        while (guard++ < 200) {
          if (S.phase === "carousel") { let n = 0; while (S.car && n++ < 400) stepCarousel(0.5); continue; }
          if (S.phase === "plan") { startCombatNow(); finishCombat(); if (alivePlayers().length <= 1 || S.stage >= 9) break; nextRound(); continue; }
          break;
        }
        const al = alivePlayers().sort((x, y) => y.hp - x.hp); al.forEach((P, i) => (P.place = i + 1));
        pl.push(ref.place);
      }
      const avg = pl.reduce((a, x) => a + x, 0) / N;
      return `${TIERS[t].n}: 정석 AI 평균 ${avg.toFixed(2)}등 · 1등 ${Math.round((100 * pl.filter((x) => x === 1).length) / N)}% · 4등 안 ${Math.round((100 * pl.filter((x) => x <= 4).length) / N)}%`;
    }, { N, t });
    console.log(r);
  }
  console.log("errors", errs.slice(0, 5)); await b.close();
})();
