// ============================================================
//  sw.js — 홈 화면 앱(PWA)용: 게임 파일을 기기에 저장해 두고 인터넷이 없어도 열리게 해요
//  · 처음 열 때 아래 파일들을 저장해요. 그 뒤로는 저장해 둔 걸 먼저 보여 주고, 뒤에서 새 버전을 받아 다음 실행 때 바뀌어요
//  · 새 JS 파일을 추가하면 FILES 에도 넣어 주세요
//  · claude.ai 아티팩트에서는 쓰지 않아요 (index.html 의 등록 코드가 앱 주소에서만 켜요)
// ============================================================
const CACHE = "ssipto-v1";
const FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "js/friends.js", "js/skills.js", "js/augments.js", "js/constants.js", "js/game.js", "js/battle.js", "js/robot.js", "js/weapons.js",
  "js/sound.js", "js/approom.js", "js/online.js", "js/photos.js", "js/figure.js", "js/hero.js", "js/render3d.js", "js/ui.js", "js/practice.js",
];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js",
  ...["environments/RoomEnvironment.js", "shaders/CopyShader.js", "shaders/LuminosityHighPassShader.js", "postprocessing/EffectComposer.js",
    "postprocessing/RenderPass.js", "postprocessing/ShaderPass.js", "postprocessing/UnrealBloomPass.js"].map((f) => "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/" + f),
];
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES);
    await Promise.all(CDN.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
// 저장해 둔 걸 먼저 주고(빠르게), 인터넷이 되면 뒤에서 새로 받아 저장해요
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin, lib = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!mine && !lib) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: mine });
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || (req.mode === "navigate" ? c.match("index.html") : Response.error());
  })());
});
