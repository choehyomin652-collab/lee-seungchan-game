// ============================================================
//  social.js — 게임 결과 · 내 기록 · 마스코트 감정 표현 · 채팅
//  · 결과 화면: 게임이 끝나면 등수, 영토 점수(오르내림), 마지막 덱(친구·시너지), 최근 등수를 보여 줘요
//  · 기록: 내 기기(localStorage "uri-record")에만 저장해요. 최근 20판까지
//  · 감정 표현: 왼쪽 위 웃는 얼굴 버튼 → 펭귄 기사가 춤추기 · 울기 · 최고! · 화내기 (그림은 render3d.js 의 stepEmote)
//    친구와 같이 하는 중이면 채팅에도 "OO의 펭귄이 춤춰요"가 떠요
//  · 채팅: 친구와 같이 하기 방에 들어가면(로비 · 게임 중 · 게임 끝난 뒤) 쓸 수 있어요
//    따로 서버 없이, 각자 "내 상태"(presence)에 최근 메시지 6개를 붙여 보내고 서로 읽어요
//    → claude.ai 의 room 과 앱의 공개 중계 서버(approom.js) 둘 다 같은 방법으로 돼요
// ============================================================
"use strict";

// ---------- 영토 점수 · 등급 ----------
// 등수별 점수: 1~4등은 오르고 5~8등은 내려가요 (0점 아래로는 안 내려가요)
const PLACE_PTS = [0, 40, 30, 20, 10, -5, -15, -25, -35];
const RANKS = [
  { p: 0, n: "새싹 영주", i: "🌱" },
  { p: 100, n: "마을 영주", i: "🏡" },
  { p: 250, n: "성주", i: "🏰" },
  { p: 450, n: "대영주", i: "🛡️" },
  { p: 700, n: "영토 군주", i: "👑" },
  { p: 1000, n: "전설의 군주", i: "🌟" },
];
const rankOf = (p) => RANKS.filter((r) => p >= r.p).pop();
const REC_KEY = "uri-record", REC_MAX = 20;
function loadRecord() {
  let r = null; try { r = JSON.parse(localStorage.getItem(REC_KEY)); } catch (e) {}
  if (!r || typeof r !== "object" || !Array.isArray(r.games)) r = { pts: 0, games: [] };
  r.pts = Math.max(0, +r.pts || 0);
  return r;
}
function saveRecord(r) { try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {} }

// 게임이 끝나면 game.js 의 gameOver 가 불러요
function recordGame(place) {
  const H = human(), rec = loadRecord(), before = rec.pts;
  const board = [];
  for (const row of H.board) for (const u of row) if (u) board.push(u);
  board.sort((a, b) => DEFS[b.d].c - DEFS[a.d].c || b.star - a.star);
  const cnt = traitCounts(board.map((u) => u.d));
  for (const [t, n] of Object.entries(H.emb || {})) cnt[t] = (cnt[t] || 0) + n;
  const traits = Object.entries(cnt).filter(([t, n]) => TRAITS[t] && traitLvl(t, n) > 0).sort((a, b) => traitLvl(b[0], b[1]) - traitLvl(a[0], a[1]) || b[1] - a[1]);
  const delta = Math.max(-before, PLACE_PTS[place] || 0);
  rec.pts = before + delta;
  rec.games.unshift({ t: Date.now(), pl: place, d: delta, r: `${S.stage}-${S.k}`, on: S.players.some((p) => p.remote), u: board.map((u) => [DEFS[u.d].n, u.star, DEFS[u.d].c]), tr: traits.map(([t, n]) => [t, n]) });
  rec.games = rec.games.slice(0, REC_MAX);
  saveRecord(rec);
  showResult(rec, before);
}
const unitChip = ([n, star, c]) => `<span class="uchip" style="--cc:var(${COST_COLOR[c] || "--c1"})">${esc(n)}<i>${"★".repeat(star)}</i></span>`;
const placeDot = (g) => `<span class="pdot p${g.pl <= 1 ? 1 : g.pl <= 4 ? 4 : 8}" title="${g.pl}등">${g.pl}</span>`;
function showResult(rec, before) {
  const g = rec.games[0], r0 = rankOf(before), r1 = rankOf(rec.pts);
  const sign = g.d > 0 ? `<b class="up">+${g.d}</b>` : g.d < 0 ? `<b class="down">${g.d}</b>` : `<b>±0</b>`;
  const change = r1.p > r0.p ? `<p class="rankup">등급이 올랐어요! ${r0.i} ${r0.n} → ${r1.i} ${r1.n}</p>` : r1.p < r0.p ? `<p class="rankdown">등급이 내려갔어요: ${r1.i} ${r1.n}</p>` : "";
  $("result").innerHTML = `
    <div class="resrank"><span class="rbadge">${r1.i}</span><span>${r1.n} · ${rec.pts}점</span>${sign}</div>${change}
    <div class="ressec"><h3>마지막 덱</h3><div class="chips">${g.u.length ? g.u.map(unitChip).join("") : "<span class='muted'>경기장에 친구가 없었어요</span>"}</div>
    ${g.tr.length ? `<div class="chips">${g.tr.map(([t, n]) => `<span class="tchip">${esc(t)} ${n}</span>`).join("")}</div>` : ""}</div>
    <div class="ressec"><h3>최근 등수</h3><div class="chips">${rec.games.slice(0, 10).map(placeDot).join("")}</div></div>`;
  $("result").hidden = false; $("hist").hidden = true;
  renderRankLine();
}
// 시작 화면: 내 등급 한 줄 + 기록 보기
function renderRankLine() {
  const rec = loadRecord(), r = rankOf(rec.pts), next = RANKS.find((x) => x.p > rec.pts);
  $("rankline").innerHTML = `<span>${r.i} ${r.n} · 영토 점수 ${rec.pts}${next ? ` <small>(${next.n}까지 ${next.p - rec.pts})</small>` : ""}</span>${rec.games.length ? `<button class="linkbtn" id="histbtn">기록 보기</button>` : ""}`;
  if ($("histbtn")) $("histbtn").onclick = toggleHistory;
}
function toggleHistory() {
  const el = $("hist");
  if (!el.hidden) { el.hidden = true; return; }
  const rec = loadRecord(), G = rec.games, n = G.length;
  if (!n) return;
  const avg = G.reduce((s, g) => s + g.pl, 0) / n, wins = G.filter((g) => g.pl === 1).length, top4 = G.filter((g) => g.pl <= 4).length;
  const day = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  el.innerHTML = `<p class="hstat">최근 ${n}판 · 1등 ${wins}번 · 4등 안 ${top4}번 · 평균 ${avg.toFixed(1)}등</p>
    <ol class="hlist">${G.map((g) => `<li>${placeDot(g)}<div><div class="hmeta">${day(g.t)} · ${g.r} · ${g.on ? "친구와" : "혼자"} · <b class="${g.d > 0 ? "up" : g.d < 0 ? "down" : ""}">${g.d > 0 ? "+" : ""}${g.d}</b></div>
      <div class="chips">${g.tr.slice(0, 3).map(([t, k]) => `<span class="tchip">${esc(t)} ${k}</span>`).join("")}${g.u.slice(0, 4).map(unitChip).join("")}</div></div></li>`).join("")}</ol>`;
  el.hidden = false; $("result").hidden = true;
}

// ---------- 감정 표현 버튼 ----------
// 스티커 그림 · 목록은 stickers.js (EMOTES)
const EMO_SAY = { dance: "의 펭귄이 춤춰요", cheer: "의 펭귄: 최고!", laugh: "의 펭귄: ㅋㅋㅋ", love: "의 펭귄이 하트를 보내요", wow: "의 펭귄이 깜짝 놀랐어요", cry: "의 펭귄이 울어요", angry: "의 펭귄이 화났어요", tease: "의 펭귄: 메롱~" };
let emoAt = 0;
function doEmote(k) {
  $("emomenu").hidden = true; $("emobtn").setAttribute("aria-expanded", "false");
  const now = Date.now(); if (now - emoAt < 1200) return; emoAt = now; // 너무 연달아 누르면 무시
  tactEmote(k);
  if (chatOn()) chatSend("", k);
}

// ---------- 채팅 ----------
const CHAT = { out: [], seq: Date.now() % 1e7, seen: new Set(), log: [], unread: 0, room: "", sentAt: 0, open: false };
const CHAT_QUICK = ["ㅋㅋㅋ", "잘했어!", "아깝다", "나 축구부 간다", "그 친구 내가 모을게", "한 판 더?", "GG"];
const chatOn = () => !!(NET.joined && NET.room && NET.code);
const cleanMsg = (s) => String(s || "").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
function chatSend(text, em) {
  if (!chatOn()) return;
  text = cleanMsg(text);
  if (!text && !em) return;
  const now = Date.now();
  if (!em && now - CHAT.sentAt < 700) return toast("조금 천천히 보내 주세요");
  CHAT.sentAt = now;
  const m = [++CHAT.seq, text, em || 0];
  CHAT.out = [...CHAT.out, m].slice(-6);
  NET.room.presence({ ch: CHAT.out }).catch(() => {});
  if (text) TACT.say = { text, t: 3.5 }; // 내 펭귄 머리 위에도 말풍선
  chatAdd(NET.name || "나", m, true);
}
function chatAdd(name, [, text, em], mine) {
  const line = em && EMO_SAY[em] ? { n: name, t: EMO_SAY[em], em: 1, stk: em } : { n: name, t: text };
  line.mine = mine; CHAT.log.push(line); CHAT.log = CHAT.log.slice(-40);
  if (!CHAT.open && !mine) { CHAT.unread++; chatFeed(line); }
  chatRender();
}
const stkImg = (k) => (k && EMO_SAY[k] ? `<img class="stk" src="${stickerUrl(k)}" alt="">` : "");
const chatLine = (l) => l.em ? `<li class="em${l.mine ? " me" : ""}">${stkImg(l.stk)}<span><b>${esc(l.n)}</b>${esc(l.t)}</span></li>` : `<li class="${l.mine ? "me" : ""}"><b>${esc(l.n)}</b>${esc(l.t)}</li>`;
function chatRender() {
  const log = $("chatlog");
  log.innerHTML = CHAT.log.length ? CHAT.log.map(chatLine).join("") : `<li class="sys">같은 방 친구들과 이야기해요. 방 코드 ${esc(NET.code)}</li>`;
  log.scrollTop = log.scrollHeight;
  $("chatbadge").hidden = !CHAT.unread; $("chatbadge").textContent = CHAT.unread > 9 ? "9+" : String(CHAT.unread);
  $("netchat").textContent = CHAT.unread ? `채팅 (${CHAT.unread})` : "채팅";
}
// 채팅창을 닫아 두었을 때: 새 메시지를 잠깐 띄워요
function chatFeed(line) {
  const el = document.createElement("div"); el.className = "feedline"; el.innerHTML = `${stkImg(line.stk)}<b>${esc(line.n)}</b>${line.em ? "" : " "}${esc(line.t)}`;
  const box = $("chatfeed"); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 6000);
}
function chatOpen(open) {
  CHAT.open = open; $("chat").hidden = !open;
  if (open) { CHAT.unread = 0; $("chatfeed").innerHTML = ""; chatRender(); if (matchMedia("(pointer: fine)").matches) $("chatinput").focus(); }
}
// 0.4초마다: 방이 바뀌었는지, 친구들의 새 메시지가 있는지 봐요
function chatTick() {
  const on = chatOn();
  $("chatbtn").hidden = !on; $("netchat").hidden = !on;
  if (!on) { if (CHAT.open) chatOpen(false); return; }
  if (CHAT.room !== NET.code) { // 새 방: 내 메시지 · 기록을 비워요
    CHAT.room = NET.code; CHAT.out = []; CHAT.log = []; CHAT.unread = 0; CHAT.seen.clear();
    NET.room.presence({ ch: [] }).catch(() => {});
    chatRender();
  }
  for (const p of netPeers()) {
    if (p.sameTab || !netMine(p) || !Array.isArray(p.presence.ch)) continue;
    const name = cleanName(p.presence.n) || "친구";
    for (const m of p.presence.ch.slice(-6)) {
      if (!Array.isArray(m) || typeof m[0] !== "number") continue;
      const key = p.peer + ":" + m[0];
      if (CHAT.seen.has(key)) continue;
      CHAT.seen.add(key);
      const em = typeof m[2] === "string" && EMO_SAY[m[2]] ? m[2] : 0, text = cleanMsg(m[1]);
      if (text || em) chatAdd(name, [m[0], text, em], false);
    }
  }
}

// ---------- 버튼 연결 ----------
$("emomenu").innerHTML = EMOTES.map(([k, n]) => `<button data-k="${k}"><img class="ei" src="${stickerUrl(k)}" alt="">${n}</button>`).join("");
$("emomenu").querySelectorAll("button").forEach((b) => tapButton(b, () => doEmote(b.dataset.k)));
$("emobtn").onclick = (e) => { e.stopPropagation(); const m = $("emomenu"); m.hidden = !m.hidden; $("emobtn").setAttribute("aria-expanded", String(!m.hidden)); $("menu").hidden = true; };
document.addEventListener("pointerdown", (e) => { if (!e.target.closest || !e.target.closest(".mini")) { $("emomenu").hidden = true; $("emobtn").setAttribute("aria-expanded", "false"); } });
$("gear").addEventListener("click", () => { $("emomenu").hidden = true; });
$("chatbtn").onclick = () => chatOpen(!CHAT.open);
$("netchat").onclick = () => chatOpen(true);
$("chatclose").onclick = () => chatOpen(false);
$("chatquick").innerHTML = CHAT_QUICK.map((q) => `<button type="button">${esc(q)}</button>`).join("");
$("chatquick").querySelectorAll("button").forEach((b) => (b.onclick = () => chatSend(b.textContent)));
$("chatform").onsubmit = (e) => { e.preventDefault(); const v = $("chatinput").value; if (cleanMsg(v)) { chatSend(v); $("chatinput").value = ""; } };
$("chatinput").addEventListener("keydown", (e) => e.stopPropagation()); // 글 쓸 때 D·F·E·스페이스 단축키가 눌리지 않게
setInterval(chatTick, 400);
renderRankLine();
