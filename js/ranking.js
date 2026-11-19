// ============================================================
//  ranking.js — 실시간 랭킹 (친구들 티어 순위표)
//  · 로그인한 계정은 내 티어 · 점수 · 레벨을 공개 중계 서버(approom.js 와 같은 MQTT 서버)에 "남겨 두는 메시지"(retain)로 올려요
//    → 랭킹을 여는 사람은 모두의 메시지를 받아 점수 순으로 1등, 2등… 보여 주고, 누가 게임을 끝내면 바로 바뀌어요
//  · 올리는 때: 앱을 열 때 · 게임이 끝날 때 · 닉네임 · 대표 캐릭터 · 칭호를 바꿀 때 (account.js 의 pushServer)
//  · 올리는 것: 닉네임 · 대표 캐릭터 · 칭호 · 영토 점수 · 레벨 · 1등 횟수 · 판 수 (아이디 · 비밀번호는 안 보내요)
//  ※ 공개 서버라서 이 게임을 아는 사람은 랭킹을 볼 수 있어요. 서버가 메시지를 오래 안 남겨 두면, 각자 앱을 열 때 다시 올라와요
// ============================================================
"use strict";
const RANK_TOPIC = APP_TOPIC + "rank/main/", RANK_MAX = 100, RANK_OLD = 60 * 864e5; // 60일 넘게 안 한 계정은 빼요
const RANK = { conn: null, rows: new Map(), pubT: 0, flash: new Set() };
const rankKey = (p) => `${p.id}-${(+p.made || 0).toString(36)}`.replace(/[^a-z0-9_-]/g, "").slice(0, 40); // 기기 계정이라 아이디가 겹칠 수 있어서 만든 시각도 붙여요
const okStr = (v, n) => typeof v === "string" && v.length <= n;
function rankValid(m) {
  return m && typeof m === "object" && okStr(m.n, 12) && m.n && okStr(m.av || "", 8) && okStr(m.t || "", 20)
    && Number.isFinite(m.pts) && m.pts >= 0 && m.pts < 1e5 && Number.isFinite(m.lv) && m.lv >= 1 && m.lv < 1000 && Number.isFinite(m.at);
}
function rankConnect() {
  if (RANK.conn) return RANK.conn;
  RANK.conn = (async () => {
    if (!window.mqtt) await loadScript(MQTT_SRC);
    const c = await appConnect();
    c.on("message", (t, buf) => {
      if (!t.startsWith(RANK_TOPIC)) return;
      const k = t.slice(RANK_TOPIC.length);
      if (!k || k.length > 40) return;
      if (!buf || !buf.length) { RANK.rows.delete(k); return rankRender(); }
      let m = null; try { m = JSON.parse(String(buf)); } catch (e) { return; }
      if (!rankValid(m)) return;
      const old = RANK.rows.get(k);
      RANK.rows.set(k, { ...m, k });
      if (old && old.pts !== m.pts) { RANK.flash.add(k); setTimeout(() => { RANK.flash.delete(k); rankRender(); }, 1600); } // 점수가 바뀐 줄은 잠깐 반짝
      rankRender();
    });
    const sub = () => c.subscribe(RANK_TOPIC + "+", { qos: 1 });
    sub(); c.on("connect", sub);
    return c;
  })().catch((e) => { RANK.conn = null; throw e; });
  return RANK.conn;
}
// 내 정보를 올려요 (여러 번 불려도 0.8초에 한 번만)
function rankPublish() {
  const p = typeof loadProfile === "function" && loadProfile(); if (!p) return;
  clearTimeout(RANK.pubT);
  RANK.pubT = setTimeout(() => {
    const rec = loadRecord(), msg = { n: cleanName(p.name) || p.id, av: p.av || "", t: p.title || "", pts: rec.pts, lv: levelOf(p.xp).lv, w: p.tot.w, g: p.tot.g, at: Date.now() };
    rankConnect().then((c) => c.publish(RANK_TOPIC + rankKey(p), JSON.stringify(msg), { qos: 1, retain: true })).catch(() => {});
    RANK.rows.set(rankKey(p), { ...msg, k: rankKey(p) }); rankRender(); // 내 줄은 바로
  }, 800);
}
function rankList() {
  const now = Date.now();
  return [...RANK.rows.values()].filter((r) => now - r.at < RANK_OLD).sort((a, b) => b.pts - a.pts || b.lv - a.lv || a.at - b.at);
}
function rankRow(r, i, me) {
  const T = tierOf(r.pts), place = i + 1;
  return `<li class="${r.k === me ? "me" : ""}${RANK.flash.has(r.k) ? " flash" : ""}">
    <span class="lbp${place <= 3 ? " m" + place : ""}">${place}</span>${avatarHtml(r.av)}
    <span class="acn"><b>${esc(r.n)}</b><small>Lv.${r.lv}${r.t ? " · " + esc(r.t) : ""}</small></span>
    ${tierEmblem(T.i, "sm")}<span class="lbt"><b class="t${T.i}">${esc(T.name)}</b><small>${T.lp}점 · 1등 ${+r.w || 0}번</small></span></li>`;
}
function rankRender() {
  const el = $("lblist"), m = $("acctm"); if (!el || !m || m.hidden) return;
  const p = loadProfile(), me = p ? rankKey(p) : "", L = rankList(), mine = L.findIndex((r) => r.k === me);
  el.innerHTML = L.length ? L.slice(0, RANK_MAX).map((r, i) => rankRow(r, i, me)).join("") : `<li class="lbempty">아직 랭킹에 올라온 친구가 없어요</li>`;
  $("lbme").innerHTML = mine >= 0 ? `내 순위 <b>${mine + 1}등</b> / ${L.length}명` : p ? "내 정보를 올리는 중…" : "로그인하면 나도 랭킹에 올라가요";
}
function showLiveRanking() {
  acctModal(`<h2>실시간 랭킹</h2>
    <p class="lbstat" id="lbstat"><i class="lbdot"></i>연결하는 중…</p>
    <p class="lbme" id="lbme"></p>
    <ol class="lbrank" id="lblist"></ol>
    <p class="acnote">로그인한 친구들의 티어 순위예요. 누가 게임을 끝내면 바로 바뀌어요.</p>`);
  rankRender();
  rankConnect().then(() => { $("lbstat") && ($("lbstat").innerHTML = `<i class="lbdot on"></i>실시간 연결됨`); rankPublish(); })
    .catch(() => { $("lbstat") && ($("lbstat").innerHTML = `<i class="lbdot"></i>랭킹 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요`); });
}
// 앱을 열면 (로그인돼 있으면) 내 정보를 올려 둬요
setTimeout(() => { if (typeof loadProfile === "function" && loadProfile()) rankPublish(); }, 3000);
