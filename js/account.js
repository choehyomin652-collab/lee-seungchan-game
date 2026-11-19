// ============================================================
//  account.js — 개인 계정 (아이디 · 비밀번호 로그인, 프로필, 레벨 · 칭호, 전적, 내 설정)
//  · 서버(Firebase)가 연결되면: 어느 기기에서나 같은 아이디로 로그인하고, 친구들 순위도 봐요
//    → FIREBASE_CONFIG 에 Firebase 콘솔의 설정을 붙여 넣으면 켜져요 (README 의 "계정 서버 연결" 참고)
//  · 연결 전(또는 연결이 안 되는 곳)에는: 이 기기 안에서만 계정을 나눠 써요 (기기 계정)
//  · 계정마다 따로 저장되는 것: 전적 · 영토 점수 · 최고 등수 · 온라인 이름 · 소리 · 화질 · 내가 바꾼 카드 사진
//    → 다른 파일은 localStorage 키를 pkey("uri-...") 로 감싸기만 하면 계정마다 나뉘어요
//  · 카드 사진은 크기가 커서 서버에는 안 올리고 그 기기에만 남아요
// ============================================================
"use strict";
// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "firebaseConfig" 를 그대로 붙여 넣어요. null 이면 기기 계정만 돼요
const FIREBASE_CONFIG = null;
const FB_VER = "10.12.2";
const ID_DOMAIN = "yeongto-chess.app"; // 아이디를 Firebase 이메일 모양으로 바꿀 때 붙이는 가짜 주소 (메일은 안 가요)

const ACCT = { cur: null, server: false, fb: null, ready: null };
try { ACCT.cur = localStorage.getItem("uri-acct") || null; } catch (e) {}
// 계정마다 따로 저장되는 키: "uri-record" → "uri@아이디:record"
const pkey = (k) => (ACCT.cur ? `uri@${ACCT.cur}:${k.slice(4)}` : k);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const SYNC_KEYS = ["uri-record", "uri-best-place", "uri-net-name", "uri-mute", "uri-hq"]; // 서버에 같이 올리는 것 (카드 사진은 빼고)

// ---------- 레벨 · 칭호 ----------
const PLACE_XP = [0, 120, 95, 75, 60, 45, 35, 25, 20]; // 등수별 경험치 (친구와 같이 하면 +20%)
const xpNeed = (lv) => 100 + (lv - 1) * 40; // lv → lv+1 에 필요한 경험치
function levelOf(xp) { let lv = 1; while (xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv++; } return { lv, cur: xp, need: xpNeed(lv) }; }
const TITLES = [
  { n: "새내기", ok: () => true, how: "처음부터" },
  { n: "영토 견습생", ok: (p) => levelOf(p.xp).lv >= 3, how: "레벨 3" },
  { n: "반장 후보", ok: (p) => levelOf(p.xp).lv >= 5, how: "레벨 5" },
  { n: "꾀돌이 전략가", ok: (p) => levelOf(p.xp).lv >= 8, how: "레벨 8" },
  { n: "전교 회장", ok: (p) => levelOf(p.xp).lv >= 12, how: "레벨 12" },
  { n: "영토체스 마스터", ok: (p) => levelOf(p.xp).lv >= 20, how: "레벨 20" },
  { n: "첫 1등", ok: (p) => p.tot.w >= 1, how: "1등 1번" },
  { n: "1등 수집가", ok: (p) => p.tot.w >= 10, how: "1등 10번" },
  { n: "4등 안 단골", ok: (p) => p.tot.t4 >= 20, how: "4등 안 20번" },
  { n: "백전노장", ok: (p) => p.tot.g >= 50, how: "50판" },
  { n: "같이 하는 게 좋아", ok: (p) => p.tot.on >= 10, how: "친구와 10판" },
  { n: "골드 영주", ok: () => tierOf(loadRecord().pts).i >= 3, how: "골드 티어" },
  { n: "다이아 군주", ok: () => tierOf(loadRecord().pts).i >= 6, how: "다이아몬드 티어" },
  { n: "챌린저", ok: () => tierOf(loadRecord().pts).i >= 9, how: "챌린저 티어" },
];
function blankProfile(id, name, av) { return { id, name, av, title: "새내기", xp: 0, tot: { g: 0, w: 0, t4: 0, sum: 0, on: 0 }, made: Date.now() }; }
function loadProfile() {
  if (!ACCT.cur) return null;
  let p = null; try { p = JSON.parse(lsGet(pkey("uri-profile"))); } catch (e) {}
  if (!p || typeof p !== "object") p = blankProfile(ACCT.cur, ACCT.cur, "");
  p.tot = Object.assign({ g: 0, w: 0, t4: 0, sum: 0, on: 0 }, p.tot); p.xp = Math.max(0, +p.xp || 0);
  return p;
}
const saveProfile = (p) => lsSet(pkey("uri-profile"), JSON.stringify(p));

// ---------- 서버 (Firebase) ----------
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
ACCT.ready = (async () => {
  if (!FIREBASE_CONFIG) return false;
  try {
    const base = `https://cdn.jsdelivr.net/npm/firebase@${FB_VER}/`;
    await loadScript(base + "firebase-app-compat.js");
    await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
    const app = firebase.initializeApp(FIREBASE_CONFIG);
    ACCT.fb = { auth: app.auth(), db: app.firestore() };
    await new Promise((ok) => { const off = ACCT.fb.auth.onAuthStateChanged(() => { off(); ok(); }); });
    ACCT.server = true;
    const u = ACCT.fb.auth.currentUser;
    if (ACCT.cur && u && idOf(u) === ACCT.cur) pullServer(false); // 다른 기기에서 한 판도 가져와요
    return true;
  } catch (e) { return false; }
})();
const idOf = (u) => String(u.email || "").split("@")[0];
const userDoc = () => ACCT.fb.db.collection("users").doc(ACCT.fb.auth.currentUser.uid);
function packLocal() { // 이 기기의 내 계정 데이터 → 서버로 보낼 모양
  const o = { profile: loadProfile(), at: Date.now() };
  for (const k of SYNC_KEYS) o[k.slice(4)] = lsGet(pkey(k));
  const p = o.profile, rec = loadRecord();
  Object.assign(o, { id: p.id, name: p.name, av: p.av, title: p.title, xp: p.xp, lv: levelOf(p.xp).lv, pts: rec.pts, w: p.tot.w, g: p.tot.g });
  return o;
}
function unpack(o) {
  if (o.profile) saveProfile(o.profile);
  for (const k of SYNC_KEYS) { const v = o[k.slice(4)]; try { v == null ? localStorage.removeItem(pkey(k)) : localStorage.setItem(pkey(k), v); } catch (e) {} }
}
let pushT = 0;
function pushServer() {
  if (!ACCT.server || !ACCT.cur || !ACCT.fb.auth.currentUser) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => userDoc().set(packLocal()).catch(() => toast("계정 서버에 저장하지 못했어요. 다음 판에 다시 저장해요")), 400);
}
async function pullServer(reloadIfChanged) {
  try {
    const snap = await userDoc().get();
    if (!snap.exists) return pushServer();
    const o = snap.data(), mine = loadProfile();
    if (mine && mine.xp > (o.xp || 0)) return pushServer(); // 이 기기에 더 최근 판이 있으면 올려요
    unpack(o);
    if (typeof renderRankLine === "function") renderRankLine();
    renderAcctChip();
    if (reloadIfChanged) location.reload();
  } catch (e) {}
}

// ---------- 기기 계정 (서버 없이) ----------
async function hashPw(id, pw) {
  const s = `yeongto|${id}|${pw}`;
  if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return "w" + h;
}
const devAccts = () => { try { return JSON.parse(lsGet("uri-accts")) || {}; } catch (e) { return {}; } };

// ---------- 가입 · 로그인 · 로그아웃 ----------
const ID_RE = /^[a-z0-9_]{3,12}$/;
function switchTo(id) { if (id) lsSet("uri-acct", id); else { try { localStorage.removeItem("uri-acct"); } catch (e) {} } location.reload(); }
function copyGuestInto(id) { // 처음 만드는 계정이면 지금까지 이 기기에 쌓인 기록을 가져가요
  if (lsGet("uri-guest-moved") || lsGet(`uri@${id}:record`)) return;
  for (const k of SYNC_KEYS) { const v = lsGet(k); if (v != null) lsSet(`uri@${id}:${k.slice(4)}`, v); }
  lsSet("uri-guest-moved", "1");
}
async function signUp(id, pw, name, av) {
  await ACCT.ready;
  if (ACCT.server) {
    try { await ACCT.fb.auth.createUserWithEmailAndPassword(`${id}@${ID_DOMAIN}`, pw); }
    catch (e) { throw new Error(e.code === "auth/email-already-in-use" ? "이미 있는 아이디예요" : e.code === "auth/weak-password" ? "비밀번호는 6자 이상이어야 해요" : "가입하지 못했어요. 인터넷 연결을 확인해 주세요"); }
  } else {
    const A = devAccts(); if (A[id]) throw new Error("이 기기에 이미 있는 아이디예요");
    A[id] = { h: await hashPw(id, pw), name }; lsSet("uri-accts", JSON.stringify(A));
  }
  copyGuestInto(id);
  ACCT.cur = id; saveProfile(blankProfile(id, name, av)); lsSet(pkey("uri-net-name"), name);
  if (ACCT.server) await userDoc().set(packLocal()).catch(() => {});
  switchTo(id);
}
async function logIn(id, pw) {
  await ACCT.ready;
  if (ACCT.server) {
    try { await ACCT.fb.auth.signInWithEmailAndPassword(`${id}@${ID_DOMAIN}`, pw); }
    catch (e) { throw new Error(e.code === "auth/network-request-failed" ? "인터넷 연결을 확인해 주세요" : e.code === "auth/too-many-requests" ? "너무 많이 틀렸어요. 잠시 뒤에 다시 해 주세요" : "아이디나 비밀번호가 틀렸어요"); }
    ACCT.cur = id;
    try { const snap = await userDoc().get(); if (snap.exists) unpack(snap.data()); else saveProfile(blankProfile(id, id, "")); } catch (e) {}
  } else {
    const a = devAccts()[id];
    if (!a || a.h !== (await hashPw(id, pw))) throw new Error("아이디나 비밀번호가 틀렸어요");
  }
  switchTo(id);
}
async function logOut() { if (ACCT.server) await ACCT.fb.auth.signOut().catch(() => {}); switchTo(null); }

// ---------- 게임이 끝나면 (social.js 의 recordGame 이 불러요) ----------
function acctOnGame(place, online) {
  const p = loadProfile(); if (!p) return;
  const before = levelOf(p.xp).lv, had = new Set(TITLES.filter((t) => t.ok(p)).map((t) => t.n));
  const gain = Math.round((PLACE_XP[place] || 20) * (online ? 1.2 : 1));
  p.xp += gain; p.tot.g++; p.tot.sum += place; if (place === 1) p.tot.w++; if (place <= 4) p.tot.t4++; if (online) p.tot.on++;
  saveProfile(p);
  const L = levelOf(p.xp), fresh = TITLES.filter((t) => t.ok(p) && !had.has(t.n)).map((t) => t.n), up = L.lv > before;
  const box = $("resxp"); // 결과 화면의 경험치 칸 (social.js 의 showResult)
  if (box) {
    box.classList.toggle("lvup", up);
    box.innerHTML = `<span class="rtl"><span>경험치 <b class="up">+${gain}</b></span>${up ? `<b class="lvtag">레벨 업! Lv.${L.lv}</b>` : `<b>Lv.${L.lv}</b>`}</span>
      <span class="xpline"><i style="width:${Math.round((L.cur / L.need) * 100)}%"></i></span>
      <small>${fresh.length ? `새 칭호: ${fresh.map(esc).join(", ")}` : `다음 레벨까지 ${L.need - L.cur}`}</small>`;
  }
  renderAcctChip(); pushServer();
}
// 설정을 바꾸면 (소리 · 화질) 서버에도
function acctSettingsChanged() { pushServer(); }

// ---------- 화면 ----------
const avIdx = (n) => DEFS.findIndex((d) => d.n === n);
function avatarHtml(n, cls) {
  const d = avIdx(n), url = d >= 0 && typeof PORTRAIT !== "undefined" && PORTRAIT[d];
  return `<span class="av ${cls || ""}">${url ? `<img src="${esc(url)}" alt="">` : `<b>${esc(n ? short(n) : "?")}</b>`}</span>`;
}
const xpBar = (L) => `<div class="xpbar"><span>Lv.${L.lv}</span><div><i style="width:${Math.round((L.cur / L.need) * 100)}%"></i></div><small>${L.cur}/${L.need}</small></div>`;
// 시작 화면 오른쪽 "내 카드": 로그인했으면 프로필 · 경험치 · 전적 · 영토 등급 · 최근 등수, 아니면 로그인 버튼과 이 기기 기록
const GUEST_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/></svg>`;
function renderAcctChip() {
  applyStartPts();
  const el = $("acctcard"); if (!el || typeof loadRecord !== "function") return;
  const p = loadProfile(), rec = loadRecord(), G = rec.games, recent = G.slice(0, 5);
  const stat = (b, s) => `<div><b>${b}</b><small>${s}</small></div>`;
  const recentHtml = `<div class="acrecent"><span>최근 ${recent.length ? recent.length + "판" : "등수"}</span><div>${recent.length ? recent.map((g) => placeTile(g.pl)).join("") : `<em>아직 한 판도 안 했어요</em>`}</div></div>`;
  if (p) {
    const L = levelOf(p.xp), T = p.tot;
    el.innerHTML = `<div class="achd">${avatarHtml(p.av, "big")}<span class="acn"><b>${esc(p.name)}</b><small>Lv.${L.lv} · ${esc(p.title)}</small></span><button class="acbtn" id="acopen" type="button">내 계정</button></div>
      <div class="acxp"><span>경험치</span><span>${L.cur} / ${L.need}</span><span class="xpline"><i style="width:${Math.round((L.cur / L.need) * 100)}%"></i></span></div>
      <div class="acgrid">${stat(T.g, "판")}${stat(T.w, "1등")}${stat(T.t4, "4등 안")}${stat(T.g ? (T.sum / T.g).toFixed(1) : "-", "평균 등수")}</div>
      ${rankBadge(rec.pts)}${recentHtml}`;
    tapButton($("acopen"), showProfile);
  } else {
    const n = G.length, avg = n ? (G.reduce((s, g) => s + g.pl, 0) / n).toFixed(1) : "-";
    el.innerHTML = `<div class="achd"><span class="av big guest">${GUEST_SVG}</span><span class="acn"><b>손님</b><small>로그인하면 레벨 · 칭호 · 전적이 쌓여요</small></span></div>
      <div class="acbtns"><button class="acbtn gold" id="aclogin" type="button">로그인</button><button class="acbtn" id="acsignup" type="button">계정 만들기</button></div>
      ${n ? `<div class="acgrid">${stat(n, "판")}${stat(G.filter((g) => g.pl === 1).length, "1등")}${stat(G.filter((g) => g.pl <= 4).length, "4등 안")}${stat(avg, "평균 등수")}</div>` : ""}
      ${rankBadge(rec.pts)}${recentHtml}`;
    tapButton($("aclogin"), () => showLogin("in"));
    tapButton($("acsignup"), () => showLogin("up"));
  }
  if ($("histbtn")) $("histbtn").hidden = !G.length;
}
function acctModal(html) {
  let m = $("acctm");
  if (!m) { m = document.createElement("div"); m.id = "acctm"; m.className = "acctm"; m.innerHTML = `<div class="acctbox" role="dialog" aria-modal="true" aria-label="내 계정"></div>`; document.body.appendChild(m); m.onclick = (e) => { if (e.target === m) m.hidden = true; }; }
  m.querySelector(".acctbox").innerHTML = `<button class="acx" aria-label="닫기">✕</button>` + html; m.hidden = false;
  m.querySelector(".acx").onclick = () => (m.hidden = true);
  return m;
}
const modeNote = () => (ACCT.server ? "어느 기기에서나 같은 아이디로 로그인할 수 있어요." : "지금은 이 기기 안에서만 쓰는 계정이에요 (계정 서버가 아직 연결되지 않았어요).");
function avPicker(sel) {
  return `<div class="avpick">${DEFS.map((d) => `<button type="button" data-av="${esc(d.n)}" class="${d.n === sel ? "on" : ""}" aria-label="${esc(d.n)}">${avatarHtml(d.n)}</button>`).join("")}</div>`;
}
function bindAvPicker(m, cb) { m.querySelectorAll("[data-av]").forEach((b) => (b.onclick = () => { m.querySelectorAll("[data-av]").forEach((x) => x.classList.toggle("on", x === b)); cb(b.dataset.av); })); }
function showLogin(tab) {
  let av = DEFS[0].n;
  const m = acctModal(`<h2>${tab === "up" ? "계정 만들기" : "로그인"}</h2>
    <div class="actabs"><button data-tab="in" class="${tab !== "up" ? "on" : ""}">로그인</button><button data-tab="up" class="${tab === "up" ? "on" : ""}">계정 만들기</button></div>
    <form id="acform">
      <label>아이디 <input id="acid" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="12" placeholder="영어 소문자 · 숫자 3~12자"></label>
      <label>비밀번호 <input id="acpw" type="password" autocomplete="${tab === "up" ? "new-password" : "current-password"}" maxlength="40" placeholder="6자 이상"></label>
      ${tab === "up" ? `<label>닉네임 <input id="acname" maxlength="8" autocomplete="nickname" placeholder="게임에서 보일 이름"></label><p class="acsub">대표 캐릭터</p>${avPicker(av)}` : ""}
      <p class="acerr" id="acerr" role="alert"></p>
      <button class="go" type="submit">${tab === "up" ? "만들기" : "로그인"}</button>
    </form>
    <p class="acnote">${modeNote()} 비밀번호는 잊어버리면 찾을 수 없으니 꼭 기억해 두세요.</p>`);
  m.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => showLogin(b.dataset.tab)));
  if (tab === "up") bindAvPicker(m, (n) => (av = n));
  $("acform").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("acid").value.trim().toLowerCase(), pw = $("acpw").value, err = $("acerr"), btn = e.target.querySelector("button[type=submit]");
    if (!ID_RE.test(id)) return (err.textContent = "아이디는 영어 소문자 · 숫자 · _ 로 3~12자예요");
    if (pw.length < 6) return (err.textContent = "비밀번호는 6자 이상이어야 해요");
    let name = "";
    if (tab === "up") { name = cleanName($("acname").value); if (!name) return (err.textContent = "닉네임을 적어 주세요"); }
    btn.disabled = true; err.textContent = ACCT.server || !FIREBASE_CONFIG ? "" : "계정 서버에 연결하는 중…";
    try { await (tab === "up" ? signUp(id, pw, name, av) : logIn(id, pw)); } catch (x) { err.textContent = x.message; btn.disabled = false; }
  };
}
function showProfile() {
  const p = loadProfile(), rec = loadRecord(), L = levelOf(p.xp), r = tierOf(rec.pts), T = p.tot;
  const m = acctModal(`<div class="achead">${avatarHtml(p.av, "big")}<div><h2>${esc(p.name)}</h2><p class="acsub">@${esc(p.id)} · ${esc(p.title)}</p></div></div>
    ${xpBar(L)}
    <div class="acstats"><div><b>${T.g}</b><small>판</small></div><div><b>${T.w}</b><small>1등</small></div><div><b>${T.t4}</b><small>4등 안</small></div><div><b>${T.g ? (T.sum / T.g).toFixed(1) : "-"}</b><small>평균 등수</small></div><div>${tierEmblem(r.i, "sm")}<small>${r.name}</small></div></div>
    <p class="acsub">칭호 고르기</p>
    <div class="actitles">${TITLES.map((t) => { const ok = t.ok(p); return `<button data-title="${esc(t.n)}" class="${t.n === p.title ? "on" : ""}" ${ok ? "" : "disabled"} title="${esc(t.how)}">${esc(t.n)}${ok ? "" : `<small>${esc(t.how)}</small>`}</button>`; }).join("")}</div>
    <details><summary>닉네임 · 대표 캐릭터 바꾸기</summary>
      <label>닉네임 <input id="acname" maxlength="8" value="${esc(p.name)}"></label>${avPicker(p.av)}<button class="go" id="acsave">저장</button></details>
    ${ACCT.server ? `<button class="linkbtn" id="acrank">친구들 티어 순위 보기</button><div id="acranks"></div>` : ""}
    <p class="acnote">${modeNote()}</p>
    <button class="linkbtn" id="acout">로그아웃 (다른 계정으로 바꾸기)</button>`);
  let av = p.av;
  bindAvPicker(m, (n) => (av = n));
  m.querySelectorAll("[data-title]").forEach((b) => (b.onclick = () => { const q = loadProfile(); q.title = b.dataset.title; saveProfile(q); pushServer(); renderAcctChip(); showProfile(); }));
  $("acsave").onclick = () => { const q = loadProfile(), nm = cleanName($("acname").value); if (!nm) return toast("닉네임을 적어 주세요"); q.name = nm; q.av = av; saveProfile(q); lsSet(pkey("uri-net-name"), nm); if ($("netname")) $("netname").value = nm; pushServer(); renderAcctChip(); showProfile(); toast("저장했어요"); };
  $("acout").onclick = logOut;
  if ($("acrank")) $("acrank").onclick = showRanking;
}
async function showRanking() {
  const el = $("acranks"); el.innerHTML = `<p class="acnote">불러오는 중…</p>`;
  try {
    const q = await ACCT.fb.db.collection("users").orderBy("pts", "desc").limit(30).get();
    const rows = q.docs.map((d) => d.data());
    el.innerHTML = `<ol class="acrank">${rows.map((o, i) => `<li class="${o.id === ACCT.cur ? "me" : ""}"><span class="rk">${i + 1}</span>${avatarHtml(o.av)}<span class="acn"><b>${esc(o.name || o.id)}</b><small>${esc(o.title || "")}</small></span>${tierEmblem(tierOf(o.pts).i, "sm")}<span class="rv">${esc(tierOf(o.pts).name)}<small>${tierOf(o.pts).lp}점 · Lv.${o.lv || 1}</small></span></li>`).join("")}</ol>`;
  } catch (e) { el.innerHTML = `<p class="acnote">순위를 불러오지 못했어요.</p>`; }
}
// 특별 시작 티어: 이 닉네임 계정은 처음 한 번 이 점수에서 시작해요 (이미 더 높으면 그대로). 1100 = 실버 I
const START_PTS = { "헤데니": 1100 };
function applyStartPts() {
  const p = loadProfile(), pts = p && START_PTS[String(p.name || "").replace(/\s/g, "")]; // 띄어쓰기는 빼고 비교
  if (!p || p.startGift || !pts || typeof loadRecord !== "function") return;
  const rec = loadRecord(); rec.pts = Math.max(rec.pts, pts); saveRecord(rec);
  p.startGift = 1; saveProfile(p); pushServer();
}
function acctInit() {
  applyStartPts();
  renderAcctChip();
  setTimeout(renderAcctChip, 2500); // 카드 사진이 늦게 오면 다시
}
