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

// ---------- 영토 점수 · 티어: tiers.js (TIERS · tierOf · placeDelta · rankBadge) ----------
const REC_KEY = "uri-record", REC_MAX = 20;
function loadRecord() {
  let r = null; try { r = JSON.parse(localStorage.getItem(pkey(REC_KEY))); } catch (e) {}
  if (!r || typeof r !== "object" || !Array.isArray(r.games)) r = { pts: 0, games: [] };
  r.pts = Math.max(0, +r.pts || 0);
  return r;
}
function saveRecord(r) { try { localStorage.setItem(pkey(REC_KEY), JSON.stringify(r)); } catch (e) {} }

// 게임이 끝나면 game.js 의 gameOver 가 불러요
function recordGame(place, newBest) {
  const H = human(), rec = loadRecord(), before = rec.pts;
  const board = [];
  for (const row of H.board) for (const u of row) if (u) board.push(u);
  board.sort((a, b) => DEFS[b.d].c - DEFS[a.d].c || b.star - a.star);
  const cnt = traitCounts(board.map((u) => u.d));
  for (const [t, n] of Object.entries(H.emb || {})) cnt[t] = (cnt[t] || 0) + n;
  const traits = Object.entries(cnt).filter(([t, n]) => TRAITS[t] && traitLvl(t, n) > 0).sort((a, b) => traitLvl(b[0], b[1]) - traitLvl(a[0], a[1]) || b[1] - a[1]);
  const delta = placeDelta(before, place); // 높은 티어일수록 덜 오르고 더 내려가요 (tiers.js)
  rec.pts = before + delta;
  const augs = (H.augs || []).map((id) => (AUGS.find((a) => a.id === id) || {}).n).filter(Boolean);
  rec.games.unshift({ t: Date.now(), pl: place, d: delta, r: `${S.stage}-${S.k}`, on: S.players.some((p) => p.remote), u: board.map((u) => [DEFS[u.d].n, u.star, DEFS[u.d].c]), tr: traits.map(([t, n]) => [t, n]), ag: augs });
  rec.games = rec.games.slice(0, REC_MAX);
  saveRecord(rec);
  const mins = S.t0 ? Math.max(1, Math.round((Date.now() - S.t0) / 60000)) : 0;
  showResult(rec, before, { newBest, mins });
  acctOnGame(place, rec.games[0].on); // 내 계정: 경험치 · 레벨 · 칭호 · 서버 저장 (account.js)
}
const unitChip = ([n, star, c]) => `<span class="uchip" style="--cc:var(${COST_COLOR[c] || "--c1"})">${esc(n)}<i>${"★".repeat(star)}</i></span>`;
const placeDot = (g) => `<span class="pdot p${g.pl <= 1 ? 1 : g.pl <= 4 ? 4 : 8}" title="${g.pl}등">${g.pl}</span>`;
const placeTile = (pl) => `<span class="ptile p${pl <= 1 ? 1 : pl <= 4 ? 4 : 8}">${pl}</span>`;
// 마지막 팀 한 명: 카드 사진 + 별 + 코스트 색 테두리
function unitTile([n, star, c]) {
  const d = DEFS.findIndex((x) => x.n === n), url = d >= 0 && typeof PORTRAIT !== "undefined" ? PORTRAIT[d] : null;
  return `<span class="runit" style="--cc:var(${COST_COLOR[c] || "--c1"})"><span class="rimg"${url ? ` style="background-image:url('${esc(url)}')"` : ""}>${url ? "" : esc(short(n))}</span><i>${"★".repeat(star)}</i><b>${esc(short(n))}</b></span>`;
}
const traitTier = (t, n) => { const th = TRAITS[t] ? TRAITS[t].t : [], lv = traitLvl(t, n); return lv >= th.length && th.length > 1 ? "l3" : lv >= 2 ? "l2" : "l1"; };
const PLACE_HEAD = ["", "우리 반 우승!", "아깝다, 2등!", "상위권 성공!", "상위권 성공!", "조금만 더!", "조금만 더!", "다음 판은 이길 거예요", "다음 판은 이길 거예요"];
// 결과 화면: 가운데 메달(등수) → 영토 점수 · 경험치 → 마지막 팀 · 시너지 · 증강 → 최근 등수 → 버튼
function showResult(rec, before, info) {
  info = info || {};
  const g = rec.games[0], pl = g.pl, r0 = tierOf(before), r1 = tierOf(rec.pts);
  const tier = pl === 1 ? "gold" : pl === 2 ? "silver" : pl <= 4 ? "bronze" : "plain";
  const C = 2 * Math.PI * 54, frac = (9 - pl) / 8;
  const sub = (pl === 1 ? "8개 반 중에서 끝까지 살아남았어요" : `${g.r} 라운드에서 탈락했어요`) + (info.mins ? ` · ${info.mins}분 동안 싸웠어요` : "");
  const sign = g.d > 0 ? `<b class="up">+${g.d}</b>` : g.d < 0 ? `<b class="down">${g.d}</b>` : `<b>±0</b>`;
  const rkChange = r1.step > r0.step ? `<small class="rkup">${r1.i > r0.i ? "티어 승급!" : "승급!"} ${r0.name} → ${r1.name}</small>` : r1.step < r0.step ? `<small class="rkdown">강등: ${r1.name}</small>` : "";
  const recent = rec.games.slice(0, 10), avg = recent.reduce((s, x) => s + x.pl, 0) / recent.length;
  const confetti = pl === 1 ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 1.6).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${["#ffd24a", "#7ff0e0", "#ff7b6b", "#b47aff", "#4fb4ff", "#3fdf8a"][i % 6]}"></i>`).join("")}</div>` : "";
  $("result").className = "rescard t-" + tier;
  const crown = pl === 1 ? `<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>` : "";
  $("result").innerHTML = `${confetti}
    <div class="rleft"><div class="medal"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="trk"/><circle cx="60" cy="60" r="54" class="arc" style="--len:${(C * frac).toFixed(1)};--full:${C.toFixed(1)}"/></svg>
      <span class="mnum">${crown}<b>${pl}등</b><small>8반 중</small></span>${info.newBest ? `<span class="mbest">최고 기록!</span>` : ""}</div>
    <h2 class="reshead">${PLACE_HEAD[pl] || pl + "등"}</h2>
    <p class="ressub">${sub}</p></div>
    <div class="rright"><div class="restiles">
      <div class="rtile pts"><span class="rtl"><span>티어 · 영토 점수</span>${sign}</span>${rankBadge(rec.pts)}${rkChange}</div>
      <div class="rtile xp" id="resxp"><span class="rtl"><span>경험치</span></span><p class="rnote">로그인하면 경험치 · 레벨 · 칭호가 쌓여요</p></div>
    </div>
    <div class="ressec"><h3>마지막 팀</h3><div class="rteam">${g.u.length ? g.u.map(unitTile).join("") : "<span class='muted'>경기장에 친구가 없었어요</span>"}</div>
      ${g.tr.length || (g.ag && g.ag.length) ? `<div class="chips">${g.tr.map(([t, n]) => `<span class="tchip ${traitTier(t, n)}">${esc(t)} ${n}</span>`).join("")}${(g.ag || []).map((a) => `<span class="achip">${esc(a)}</span>`).join("")}</div>` : ""}</div>
    <div class="resrecent"><span>최근 ${recent.length}판 · 평균 ${avg.toFixed(1)}등</span><div>${recent.map((x) => placeTile(x.pl)).join("")}</div></div>
    <div class="resbtns"><button class="go" id="resagain" type="button">${g.on ? "혼자 하기" : "다시 하기"}</button><button class="go dim" id="reshome" type="button">처음으로</button><button class="go dim" id="reshist" type="button">지난 기록</button></div></div>`;
  tapButton($("resagain"), () => $("start").onclick());
  tapButton($("reshome"), () => showTitle());
  tapButton($("reshist"), () => { showTitle(); toggleHistory(true); });
  $("res").hidden = false;
  renderRankLine();
}
// 시작 화면 오른쪽 카드 (account.js 의 renderAcctChip 이 그려요)
function renderRankLine() { renderAcctChip(); }
// 지난 기록: 시작 화면 오른쪽 칸에 (다시 누르면 내 카드로)
function toggleHistory(open) {
  if (!open && $("tside").dataset.view === "hist") return setSide("acct");
  const rec = loadRecord(), G = rec.games, n = G.length;
  const day = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  let body = `<p class="muted">아직 기록이 없어요. 한 판 해 보세요!</p>`;
  if (n) {
    const avg = G.reduce((s, g) => s + g.pl, 0) / n, wins = G.filter((g) => g.pl === 1).length, top4 = G.filter((g) => g.pl <= 4).length;
    body = `<p class="hstat">최근 ${n}판 · 1등 ${wins}번 · 4등 안 ${top4}번 · 평균 ${avg.toFixed(1)}등</p>
    <ol class="hlist">${G.map((g) => `<li>${placeTile(g.pl)}<div><div class="hmeta">${day(g.t)} · ${g.r} · ${g.on ? "친구와" : "혼자"} · <b class="${g.d > 0 ? "up" : g.d < 0 ? "down" : ""}">${g.d > 0 ? "+" : ""}${g.d}</b></div>
      <div class="chips">${g.tr.slice(0, 3).map(([t, k]) => `<span class="tchip ${traitTier(t, k)}">${esc(t)} ${k}</span>`).join("")}${g.u.slice(0, 4).map(unitChip).join("")}</div></div></li>`).join("")}</ol>`;
  }
  $("hist").innerHTML = `<div class="tchead"><h3>지난 기록</h3><button class="tcx" type="button" data-back aria-label="닫기">✕</button></div>${body}`;
  setSide("hist");
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
tapButton($("histbtn"), () => toggleHistory());
tapButton($("rulesbtn"), () => setSide($("tside").dataset.view === "rules" ? "acct" : "rules"));
$("tside").addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-back]")) setSide("acct"); });
acctInit(); // 시작 화면 오른쪽: 내 계정 카드 (account.js)
setSide(loadRecord().games.length || loadProfile() ? "acct" : "rules"); // 처음 온 친구에게는 규칙부터
