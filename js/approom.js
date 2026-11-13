// ============================================================
//  approom.js — 홈 화면 앱(PWA)에서 "친구와 같이 하기"
//  · claude.ai 아티팩트 안에서는 claude 의 room 기능을 쓰고, 앱에서는 이 파일이 같은 모양의 방을 만들어 줘요
//  · 무료 공개 MQTT 중계 서버로 메시지를 주고받아요 (회원 가입 · 서버 필요 없음). 하나가 안 되면 다음 서버로
//  · 각자 2초마다 "나 여기 있어요 + 내 상태"를 보내고, 7초 동안 소식이 없으면 나간 걸로 봐요
//  · online.js 가 쓰는 것만 만들어요: peers() · presence(바꿀 내용) · onPeers(바뀌면 부를 함수)
//  ※ 공개 서버라서 같은 방 코드를 아는 사람은 이름과 배치를 볼 수 있어요. 개인 정보는 보내지 않아요
// ============================================================
"use strict";
const APP_BROKERS = window.__SSIPTO_BROKERS || ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"];
const APP_TOPIC = "ssipto-chess/v1/", APP_BEAT = 2000, APP_TIMEOUT = 7000;
const MQTT_SRC = "https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js";
function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
// 서버에 하나씩 연결해 봐요 (6초 안에 안 되면 다음 서버)
function appConnect(i = 0) {
  if (i >= APP_BROKERS.length) return Promise.reject(new Error("no broker"));
  return new Promise((ok, no) => {
    const c = window.mqtt.connect(APP_BROKERS[i], { connectTimeout: 6000, reconnectPeriod: 2000, keepalive: 30, clean: true });
    const t = setTimeout(() => { c.end(true); no(); }, 7000);
    c.once("connect", () => { clearTimeout(t); ok(c); });
    c.once("error", () => { clearTimeout(t); c.end(true); no(); });
  }).catch(() => appConnect(i + 1));
}
async function appRoom() {
  if (!window.mqtt) await loadScript(MQTT_SRC);
  const client = await appConnect();
  const me = "p" + Math.random().toString(36).slice(2, 12);
  const state = {}, others = new Map(), cbs = [];
  let room = null, sentAt = 0, sendTimer = null;
  const topic = (rm) => APP_TOPIC + rm + "/p/";
  const notify = () => cbs.forEach((f) => { try { f(); } catch (e) {} });
  const send = (obj, rm = room) => { if (rm) client.publish(topic(rm) + me, JSON.stringify(obj), { qos: 0 }); };
  const beat = () => { sentAt = Date.now(); send({ s: state }); };
  // 너무 자주 보내지 않게 (0.15초에 한 번까지)
  const soon = () => { if (sendTimer) return; const wait = Math.max(0, 150 - (Date.now() - sentAt)); sendTimer = setTimeout(() => { sendTimer = null; beat(); }, wait); };
  client.on("message", (t, buf) => {
    if (!room || !t.startsWith(topic(room))) return;
    const peer = t.slice(topic(room).length);
    if (!peer || peer === me || peer.length > 20) return;
    let m = null; try { m = JSON.parse(String(buf)); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    if (m.bye) { if (others.delete(peer)) notify(); return; }
    if (!m.s || typeof m.s !== "object") return;
    const isNew = !others.has(peer);
    others.set(peer, { presence: m.s, seen: Date.now() });
    if (isNew) beat(); // 새로 온 친구가 나를 바로 볼 수 있게
    notify();
  });
  client.on("connect", () => { if (room) { client.subscribe(topic(room) + "+"); beat(); } }); // 다시 연결되면 방에 다시 들어가요
  setInterval(() => {
    if (room) beat();
    let gone = false; const now = Date.now();
    for (const [p, o] of others) if (now - o.seen > APP_TIMEOUT) { others.delete(p); gone = true; }
    if (gone) notify();
  }, APP_BEAT);
  addEventListener("pagehide", () => send({ bye: 1 }));
  return {
    peers: () => [{ peer: me, presence: { ...state }, sameTab: true, guest: false }, ...[...others].map(([peer, o]) => ({ peer, presence: o.presence, sameTab: false, guest: false }))],
    presence(patch) {
      Object.assign(state, patch || {});
      const rm = state.app && state.rm ? String(state.rm) : null;
      if (rm !== room) { // 방이 바뀌었어요: 예전 방에 인사하고 나가서 새 방을 들어요
        if (room) { send({ bye: 1 }); client.unsubscribe(topic(room) + "+"); }
        room = rm; others.clear();
        if (room) client.subscribe(topic(room) + "+");
        notify();
      }
      soon();
      return Promise.resolve();
    },
    onPeers(cb) { cbs.push(cb); },
  };
}
