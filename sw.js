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
  "js/sound.js", "js/approom.js", "js/online.js", "js/cardpics.js", "js/photos.js", "js/figure.js", "js/hero.js", "js/stickers.js", "js/render3d.js", "js/ui.js", "js/practice.js", "js/ping.js", "js/social.js",
  ...["264e6bd68a2c650b492c1dc6323e184d", "c084b0de9c9b195fee549e8f97d9ea18", "6aee6c7bd14f060b99cc998ca9189a6d", "563237f2f1a3547d18a32898c1374476",
    "7ff0207f57255560ce6a3051f66ca17b", "845f256a22b6e9c4c39004a8eb92b5cf", "5222d38967af0784aef52d443ef0df91", "3bff9474594a6588873ad9bfe078e3de",
    "3bf362f3a07f7dbe065481282e4c0d9c", "4149220f3f8d1008942372463b05ec31", "9095b56b47d55663c996ac30108f7e12", "7d50b9e62657f7d2e5b0873b190bfc11",
    "07017e5c1a1261fd81b005ad7e8a8c5c", "2edb14e321fc90ebea9098d6657e3d21", "64b47f57b49c563147068c86b91217d2"].map((id) => "cards/" + id + ".jpg"), // 친구 카드 사진 (photos.js 의 BUILTIN_CARDS)
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
    await c.addAll(FILES.map((u) => new Request(u, { cache: "reload" }))); // 브라우저에 남은 예전 파일 말고 서버의 새 파일로
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
