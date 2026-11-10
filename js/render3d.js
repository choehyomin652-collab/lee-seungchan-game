// ============================================================
//  render3d.js — 3D 화면 (경기장 · 친구 캐릭터 모양 · 효과 · 카메라 · 조명)
// ============================================================
"use strict";
// =============== 3D 그리기 ===============
// 3D 장면(three.js) 위에 2D 캔버스를 겹쳐서 체력바·이름·숫자를 그려요
const gl = $("gl"), cv = $("cv"), ctx = cv.getContext("2d");
const HAS3D = typeof THREE !== "undefined";
let W = 0, H3 = 0, H = 0, ic = 0, itemY = 0;
const CX = 3.25 * SQ3, BENCH_Z = 7.7, SLOT_W = 13.2 / BENCH, BENCH_X0 = -6.6;
const worldX = (X) => X * SQ3 - CX, worldZ = (Y) => Y * 1.5 - 5.25;
const benchX = (i) => BENCH_X0 + SLOT_W * (i + 0.5);
const gridX = (r, c) => c + (r & 1) * 0.5;
let renderer, scene, camera, raycaster, pickPlane, carousel, camBase = null, chalk = null;
const tiles = [], pads = [], GEO = {}, PAPER = {}, TEXC = {};
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const SKINS = [0xf1c9a5, 0xe8b98f, 0xf3d1b3, 0xdcae88];
const HAIRC = [0x1c1612, 0x2a1d15, 0x3a291c, 0x141414, 0x4a3324];
const TRACK = [0x2f5fa8, 0x2f8a5a, 0x8a2f3a, 0x3d3d8a];
const COST_HEX = [0, 0xc9d1cc, 0x7fe0b0, 0x7fc4ff, 0xe39cff, 0xffcc4d];

function canvasTex(w, h, paint) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.userData = { c, paint }; return t;
}
function repaint(t) { const { c, paint } = t.userData; paint(c.getContext("2d"), c.width, c.height); t.needsUpdate = true; }
const DF = () => TOK["--display"];
function paintChalk(g, w, h) {
  g.fillStyle = "#24453a"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 160, 10 + Math.random() * 30, Math.random(), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(240,244,232,.92)"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `190px ${DF()}`; g.fillText("우리반 오토배틀", w / 2, h * 0.44);
  g.fillStyle = "rgba(245,215,110,.9)"; g.font = `70px ${DF()}`; g.fillText("오늘의 목표: 끝까지 살아남기!", w / 2, h * 0.78);
  g.textAlign = "right"; g.fillStyle = "rgba(240,244,232,.85)"; g.font = `58px ${DF()}`;
  g.fillText("11월 9일 월요일", w - 70, 80); g.fillText("주번: 정주환", w - 70, 160);
  g.textAlign = "left"; g.fillText("떠든 사람:", 70, 80);
}
function paperTex(name) {
  if (PAPER[name]) return PAPER[name];
  return (PAPER[name] = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = "#f7f4ea"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8c6d8"; g.lineWidth = 3;
    for (let y = 92; y < h; y += 30) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
    g.fillStyle = "#24302a"; g.textAlign = "center"; g.font = `52px ${DF()}`; g.fillText(name, w / 2, 58);
    g.strokeStyle = "#e0453a"; g.lineWidth = 9; g.beginPath(); g.arc(w * 0.66, h * 0.68, 52, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#e0453a"; g.font = `50px ${DF()}`; g.fillText("0점", w * 0.66, h * 0.71);
    g.strokeStyle = "rgba(224,69,58,.8)"; g.lineWidth = 6;
    for (const [x, y] of [[50, 120], [70, 180], [40, 240]]) { g.beginPath(); g.moveTo(x - 16, y - 16); g.lineTo(x + 16, y + 16); g.moveTo(x + 16, y - 16); g.lineTo(x - 16, y + 16); g.stroke(); }
  }));
}
function textTex(key, w, h, paint) { return TEXC[key] || (TEXC[key] = canvasTex(w, h, paint)); }
function M(hex, rough = 0.8, extra = {}) { return new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: 0, ...extra }); }
function addBox(parent, w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function noiseTex(size, base, specks, repeat) {
  const t = canvasTex(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (const [col, n, r0, r1] of specks) for (let i = 0; i < n; i++) {
      g.fillStyle = col; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r0 + Math.random() * (r1 - r0), (r0 + Math.random() * (r1 - r0)) * 0.6, Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return t;
}
let OUT = null, PLATFORM = null, SKY = null, BACKDROP = null;
// 배경 사진: 이 기기의 브라우저에만 저장돼요 (게임 파일에는 들어가지 않음)
function loadBackdrop() {
  let url = null; try { url = localStorage.getItem("uri-backdrop"); } catch (e) {}
  if (!url) return applyBackdrop(null);
  const img = new Image(); img.onload = () => applyBackdrop(img); img.onerror = () => applyBackdrop(null); img.src = url;
}
function applyBackdrop(img) {
  BACKDROP = img;
  const on = !!img;
  if (OUT) OUT.visible = !on;
  if (PLATFORM) PLATFORM.visible = on;
  if (pollen) pollen.visible = !on;
  scene.fog = on ? null : new THREE.Fog(lin(0xe2bf9c), 40, 95);
  if (!on) { scene.background = SKY; return; }
  // 화면 비율에 맞게 가운데를 잘라서 꽉 채워요
  const cw = 1600, ch = Math.round(cw * (H || 800) / (W || 1200));
  const t = canvasTex(cw, ch, (g, w, h) => {
    const k = Math.max(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k;
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  });
  if (scene.background && scene.background !== SKY && scene.background.dispose) scene.background.dispose();
  scene.background = t;
}
function pickBackdrop(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.85);
      try { localStorage.setItem("uri-backdrop", url); } catch (e) { toast("사진이 너무 커서 저장은 못 했어요. 이번 판에만 보여요"); }
      const im2 = new Image(); im2.onload = () => { applyBackdrop(im2); toast("배경 사진을 넣었어요"); }; im2.src = url;
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}
function buildWorld() {
  OUT = new THREE.Group(); scene.add(OUT);
  // 하늘
  scene.background = canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#5f7fb0"); gr.addColorStop(0.45, "#b49ab8"); gr.addColorStop(0.75, "#e8b48a"); gr.addColorStop(1, "#f3d2a6");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(lin(0xe2bf9c), 40, 95);
  // 떠 있는 섬
  const grass = noiseTex(512, "#4f7a30", [["rgba(40,80,25,.35)", 500, 2, 7], ["rgba(150,180,80,.25)", 400, 1, 5], ["rgba(120,95,55,.18)", 40, 10, 30]], 10);
  const top = new THREE.Mesh(new THREE.CircleGeometry(24, 48), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.0; top.receiveShadow = true; OUT.add(top);
  const rockMat = new THREE.MeshStandardMaterial({ color: lin(0x8a7a68), roughness: 0.95, flatShading: true });
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(24, 15, 10, 28, 3), rockMat);
  const cp = cliff.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < 4.9) { cp.setX(i, cp.getX(i) * (0.92 + Math.random() * 0.16)); cp.setZ(i, cp.getZ(i) * (0.92 + Math.random() * 0.16)); } }
  cliff.geometry.computeVertexNormals(); cliff.position.y = -5.02; OUT.add(cliff);
  // 경기장 바닥(흙길이 섞인 풀밭)
  const arena = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#5a8236"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${150 + Math.random() * 30},${120 + Math.random() * 20},${70 + Math.random() * 20},${0.25 + Math.random() * 0.25})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 20 + Math.random() * 60, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 9000; i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = Math.random() < 0.5 ? "rgba(60,100,30,.5)" : "rgba(170,200,90,.35)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 6); g.stroke(); }
    for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(140,135,120,.55)"; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 14, 6 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
  });
  const af = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 16.8), new THREE.MeshStandardMaterial({ map: arena, roughness: 0.95 }));
  af.rotation.x = -Math.PI / 2; af.position.set(0, 0.16, 0.9); af.receiveShadow = true; scene.add(af);
  // 돌 테두리
  const stoneMat = new THREE.MeshStandardMaterial({ color: lin(0xb8ab92), roughness: 0.9, flatShading: true });
  const stoneGeo = new THREE.DodecahedronGeometry(0.6, 0);
  const stone = (x, z, s, y = 0.15, parent = scene) => { const m = new THREE.Mesh(stoneGeo, stoneMat); m.position.set(x, y, z); m.scale.set(s * (0.8 + Math.random() * 0.5), s * (0.5 + Math.random() * 0.4), s * (0.8 + Math.random() * 0.5)); m.rotation.set(Math.random(), Math.random() * 3, Math.random()); m.castShadow = true; m.receiveShadow = true; parent.add(m); };
  for (let z = -7.6; z <= 9.6; z += 0.95) { stone(-8.1 - Math.random() * 0.3, z, 0.9); stone(8.1 + Math.random() * 0.3, z, 0.9); }
  for (let x = -7.8; x <= 7.8; x += 0.95) stone(x, -7.9 - Math.random() * 0.3, 0.95);
  for (let x = -7.8; x <= 7.8; x += 1.1) stone(x, 9.4 + Math.random() * 0.2, 0.7, 0.1);
  // 나무
  const leafA = new THREE.MeshStandardMaterial({ color: lin(0x3f6e2e), roughness: 0.9, flatShading: true });
  const leafB = new THREE.MeshStandardMaterial({ color: lin(0x5a8a34), roughness: 0.9, flatShading: true });
  const leafC = new THREE.MeshStandardMaterial({ color: lin(0xb5763a), roughness: 0.9, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: lin(0x5a3e2a), roughness: 0.9 });
  const pine = (x, z, s) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); OUT.add(g);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 7), bark); tr.position.y = 0.6; tr.castShadow = true; g.add(tr);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.3, 1.6, 8), leafA); c.position.y = 1.4 + i * 0.85; c.castShadow = true; g.add(c); }
  };
  const round = (x, z, s, mat) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); OUT.add(g);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), bark); tr.position.y = 0.7; tr.castShadow = true; g.add(tr);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 - i * 0.12, 1), mat); b.position.set((i - 1) * 0.5, 1.9 + (i % 2) * 0.4, (i % 2) * 0.3); b.castShadow = true; g.add(b); }
  };
  const spots = [[-12, -9], [-14, -3], [-12.5, 3], [-15, 8], [-11, 12], [12, -9], [14.5, -2], [12, 4], [15, 9], [11, 12.5], [-6, -12], [-1, -13.5], [5, -12.5], [9, -14], [-10, -14], [-18, 0], [18, 2], [-17, -10], [17, -8]];
  spots.forEach(([x, z], i) => { const s = 0.9 + Math.random() * 0.7; if (i % 3 === 0) pine(x, z, s * 1.2); else round(x, z, s * 1.1, i % 5 === 1 ? leafC : leafB); });
  for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, r = 17 + Math.random() * 6; stone(Math.cos(a) * r, Math.sin(a) * r, 0.6 + Math.random() * 1.2, 0.1, OUT); }
  // 멀리 떠 있는 작은 섬들
  for (const [x, y, z, s] of [[-34, -2, -30, 1.6], [30, 3, -36, 2.2], [-40, 6, 8, 1.3], [38, -4, 2, 1.5]]) {
    const isl = new THREE.Group(); isl.position.set(x, y, z); isl.scale.setScalar(s); OUT.add(isl);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 0.5, 4, 9), rockMat); t.position.y = -2; isl.add(t);
    const gtop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 9), leafB); isl.add(gtop);
    const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), leafA); tr.position.y = 1.4; isl.add(tr);
  }
  // 횃불
  TORCH.length = 0;
  for (const x of [-7.6, 7.6]) {
    const g = new THREE.Group(); g.position.set(x, 0, 9.2); scene.add(g);
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.6, 8), stoneMat); pil.position.y = 0.8; pil.castShadow = true; g.add(pil);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.3, 10), new THREE.MeshStandardMaterial({ color: lin(0x3a3028), roughness: 0.6, metalness: 0.4 })); bowl.position.y = 1.75; g.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), new THREE.MeshBasicMaterial({ color: lin(0xffa23a), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.y = 2.3; g.add(flame);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8), new THREE.MeshBasicMaterial({ color: lin(0xfff0a0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    inner.position.y = 2.2; g.add(inner);
    const light = new THREE.PointLight(0xffa040, 1.4, 9, 2); light.position.y = 2.5; g.add(light);
    TORCH.push({ flame, inner, light });
  }
}
const TORCH = [];
function buildArena() {
  // 육각 칸: 얇은 선과 옅은 칠
  const fillGeo = new THREE.CircleGeometry(0.9, 6, Math.PI / 2);
  const ringPts = []; for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + (i / 6) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0)); }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  for (let r = 0; r < ROWS; r++) {
    tiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      const g = new THREE.Group(); g.rotation.x = -Math.PI / 2; g.position.set(worldX(gridX(r, c)), 0.18, worldZ(r));
      const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04, depthWrite: false }));
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
      g.add(fill); g.add(line); scene.add(g);
      tiles[r][c] = { g, fill, line };
    }
  }
  // 대기석: 돌판
  const slabMat = new THREE.MeshStandardMaterial({ color: lin(0xa89c86), roughness: 0.9 });
  addBox(scene, 13.8, 0.26, 1.5, slabMat, 0, 0.06, BENCH_Z, false).receiveShadow = true;
  const slotGeo = new THREE.PlaneGeometry(SLOT_W - 0.18, 1.2);
  for (let i = 0; i < BENCH; i++) {
    const p = new THREE.Mesh(slotGeo, new THREE.MeshStandardMaterial({ color: lin(0x8f846f), roughness: 0.9 })); p.rotation.x = -Math.PI / 2;
    p.position.set(benchX(i), 0.2, BENCH_Z); p.receiveShadow = true; scene.add(p); pads.push(p);
  }
  // 급식 줄 원판
  carousel = new THREE.Group(); scene.add(carousel);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.9, 0.2, 64), new THREE.MeshStandardMaterial({ color: lin(0xb8ab92), roughness: 0.85 }));
  disc.position.y = 0.2; disc.receiveShadow = true; carousel.add(disc);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.14, 10, 64), new THREE.MeshStandardMaterial({ color: lin(0xd8b45a), roughness: 0.3, metalness: 0.8 }));
  rimT.rotation.x = Math.PI / 2; rimT.position.y = 0.32; carousel.add(rimT);
}
// ----- 내 마스코트(전술가) -----
let tact = null;
const TACT = { x: -6.2, z: 6.1, tx: -6.2, tz: 6.1, face: 0, walk: 0 };
function buildTactician() {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const body = M(0xffd34d, 0.55), belly = M(0xfff1b8, 0.6), beak = M(0xff9a2a, 0.5), dark = M(0x1c1410, 0.3), white = M(0xffffff, 0.3);
  const put = (geo, mat, x, y, z, s) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (s) m.scale.set(...s); m.castShadow = true; g.add(m); return m; };
  put(new THREE.SphereGeometry(0.5, 24, 18), body, 0, 0.62, 0, [1, 0.95, 1]);
  put(new THREE.SphereGeometry(0.36, 20, 14), belly, 0, 0.55, 0.2, [1, 1, 0.7]);
  for (const s of [-1, 1]) {
    put(new THREE.SphereGeometry(0.08, 12, 10), white, s * 0.17, 0.82, 0.4, [1, 1.1, 0.6]);
    put(new THREE.SphereGeometry(0.05, 10, 8), dark, s * 0.17, 0.81, 0.44);
    const w = put(new THREE.SphereGeometry(0.2, 12, 10), body, s * 0.47, 0.6, 0, [0.35, 0.8, 0.7]); w.rotation.z = s * 0.4;
    put(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), beak, s * 0.15, 0.12, 0.05);
    put(new THREE.BoxGeometry(0.16, 0.04, 0.2), beak, s * 0.15, 0.03, 0.1);
  }
  const bk = put(new THREE.ConeGeometry(0.08, 0.18, 8), beak, 0, 0.7, 0.5); bk.rotation.x = Math.PI / 2;
  put(new THREE.ConeGeometry(0.06, 0.18, 6), body, 0, 1.18, 0.05);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 36), new THREE.MeshBasicMaterial({ color: lin(0xf0cf74), transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  return g;
}
function moveTactician(p) {
  if (!p) return;
  const r = Math.hypot(p.x, p.z - 1);
  if (r > 18) return;
  TACT.tx = Math.max(-9.5, Math.min(9.5, p.x)); TACT.tz = Math.max(-8.5, Math.min(10.5, p.z));
}
function stepTactician(dt) {
  if (!tact) { tact = buildTactician(); scene.add(tact); }
  const dx = TACT.tx - TACT.x, dz = TACT.tz - TACT.z, d = Math.hypot(dx, dz);
  const sp = Math.min(d, dt * 4.5);
  if (d > 0.02) { TACT.x += (dx / d) * sp; TACT.z += (dz / d) * sp; TACT.face = Math.atan2(dx, dz); TACT.walk += dt * 14; }
  if (S.orbs && S.orbs.length) collectOrbs(false);
  const moving = d > 0.05 ? 1 : 0;
  tact.position.set(TACT.x, 0.17 + Math.abs(Math.sin(TACT.walk)) * 0.12 * moving + Math.sin(clock3d * 2) * 0.02, TACT.z);
  const cur = tact.rotation.y, df = ((((TACT.face) - cur) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  tact.rotation.y = cur + df * Math.min(1, dt * 8);
  tact.rotation.z = Math.sin(TACT.walk) * 0.12 * moving;
}
// ----- 상점 카드 그림: 친구 3D 캐릭터를 미리 찍어 둬요 -----
const PORTRAIT = {};
function makePortraits() {
  try {
    const cvs = document.createElement("canvas"); cvs.width = 240; cvs.height = 300;
    const r2 = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, preserveDrawingBuffer: true });
    r2.outputEncoding = THREE.sRGBEncoding; r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 0.95;
    const sc = new THREE.Scene();
    if (THREE.RoomEnvironment) sc.environment = new THREE.PMREMGenerator(r2).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6); key.position.set(-2, 3, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.2); rim.position.set(2, 2, -3); sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.3));
    const cam = new THREE.PerspectiveCamera(26, 240 / 300, 0.1, 20);
    cam.position.set(0.45, 1.75, 2.3); cam.lookAt(0, 1.38, 0);
    const BG = { 1: ["#4a5560", "#20262b"], 2: ["#2f7a52", "#122a1e"], 3: ["#2f5f9a", "#121f33"], 4: ["#6a3a9a", "#1f1230"], 5: ["#b07a1e", "#2e1d06"] };
    DEFS.forEach((def, i) => {
      const [a, b] = BG[def.c];
      sc.background = canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const unit = buildStudent(def, false); unit.children[0].visible = false; unit.rotation.y = 0.25;
      sc.add(unit); r2.render(sc, cam); PORTRAIT[i] = cvs.toDataURL("image/jpeg", 0.88); sc.remove(unit);
      unit.traverse((m) => { if (m.material) [].concat(m.material).forEach((x) => x.dispose()); });
    });
    r2.dispose(); if (r2.forceContextLoss) r2.forceContextLoss();
  } catch (e) { /* 그림 없이도 카드는 보여요 */ }
}
let composer = null, bloomPass = null, HQ = true, pollen = null;
try { HQ = localStorage.getItem("uri-hq") !== "0"; } catch (e) {}
const FINAL_SHADER = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.14);
      c = toSRGB(clamp(c, 0.0, 1.0));
      c = (c - 0.5) * 1.06 + 0.5;
      c *= vec3(1.025, 1.0, 0.965);
      float v = smoothstep(0.9, 0.3, length((vUv - 0.5) * vec2(1.15, 1.0)));
      c *= mix(0.74, 1.0, v);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
function setupPost() {
  if (!THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.ShaderPass) return;
  const opts = { format: THREE.RGBAFormat };
  const rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(16, 16, opts) : new THREE.WebGLRenderTarget(16, 16, opts);
  composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.35, 0.93);
  composer.addPass(bloomPass);
  composer.addPass(new THREE.ShaderPass(FINAL_SHADER));
}
function softTex(inner, outer) {
  return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}
function buildDecor() {
  // 풀 포기 (한 번에 그리는 인스턴스)
  const tuft = new THREE.ConeGeometry(0.05, 0.38, 3); tuft.translate(0, 0.19, 0);
  const N = HQ ? 7000 : 2500, grass = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  let n = 0;
  while (n < N) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 23.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const inArena = Math.abs(x) < 8.6 && z > -8.6 && z < 10.2;
    if (inArena && Math.random() > 0.04) continue;
    e.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5); q.setFromEuler(e);
    const sc = 0.6 + Math.random() * 0.9;
    m4.compose(new THREE.Vector3(x, inArena ? 0.16 : 0, z), q, new THREE.Vector3(sc, sc * (0.7 + Math.random() * 0.8), sc));
    grass.setMatrixAt(n, m4);
    col.setHSL(0.24 + Math.random() * 0.06, 0.45 + Math.random() * 0.2, 0.22 + Math.random() * 0.14).convertSRGBToLinear();
    grass.setColorAt(n, col); n++;
  }
  grass.receiveShadow = true; OUT.add(grass);
  // 꽃
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 500);
  const FC = [0xffffff, 0xffe066, 0xff9ac8, 0xb59aff];
  for (let i = 0; i < 500; i++) {
    let x, z; do { const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 14; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (Math.abs(x) < 8.8 && z > -8.8 && z < 10.4);
    m4.makeTranslation(x, 0.22 + Math.random() * 0.15, z); fl.setMatrixAt(i, m4); fl.setColorAt(i, col.setHex(rnd(FC)).convertSRGBToLinear());
  }
  OUT.add(fl);
  // 구름
  const cloudTex = softTex("rgba(255,255,255,.95)", "rgba(255,255,255,0)");
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: lin(i % 3 ? 0xfff1e6 : 0xf3d6e6), transparent: true, opacity: 0.75, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 26;
    sp.position.set(Math.cos(a) * r, -10 + Math.random() * 14, Math.sin(a) * r - 6);
    const w = 14 + Math.random() * 18; sp.scale.set(w, w * 0.45, 1); OUT.add(sp);
  }
  // 떠다니는 꽃가루
  const P = HQ ? 260 : 120, pos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pollen = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, map: softTex("rgba(255,244,190,1)", "rgba(255,244,190,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: lin(0xfff2b0) }));
  scene.add(pollen);
  // 뒤쪽 테두리 빛
  const rimL = new THREE.DirectionalLight(0xa8d4ff, 0.75); rimL.position.set(6, 7, -14); scene.add(rimL);
}
function stepDecor(dt) {
  if (!pollen) return;
  const a = pollen.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let y = a.getY(i) + dt * 0.25; if (y > 6) y = 0;
    a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(clock3d * 0.6 + i) * dt * 0.15);
  }
  a.needsUpdate = true;
}
function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  if (THREE.RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  }
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a6a30, scene.environment ? 0.35 : 0.8));
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.35);
  sun.position.set(-14, 18, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(10, 10, 16); scene.add(fill);
  buildWorld(); buildArena(); buildDecor(); setupPost();
  PLATFORM = new THREE.Mesh(new THREE.BoxGeometry(18.4, 3, 20.2), new THREE.MeshStandardMaterial({ color: lin(0x8a7a68), roughness: 0.95, flatShading: true }));
  PLATFORM.position.set(0, -1.52, 0.9); PLATFORM.receiveShadow = true; PLATFORM.visible = false; scene.add(PLATFORM);
  SKY = scene.background;
  loadBackdrop();
  // 캐릭터 부품
  const torsoPts = [[0, 0], [0.25, 0], [0.27, 0.12], [0.27, 0.3], [0.29, 0.42], [0.25, 0.5], [0.12, 0.56], [0, 0.565]].map(([x, y]) => new THREE.Vector2(x, y));
  Object.assign(GEO, {
    teamRing: new THREE.RingGeometry(0.5, 0.6, 40),
    torso: new THREE.LatheGeometry(torsoPts, 22),
    leg: new THREE.CylinderGeometry(0.085, 0.072, 0.52, 12),
    shoe: new THREE.SphereGeometry(0.1, 14, 10),
    sleeve: new THREE.CylinderGeometry(0.075, 0.064, 0.38, 12),
    hand: new THREE.SphereGeometry(0.06, 12, 10),
    neck: new THREE.CylinderGeometry(0.07, 0.075, 0.1, 12),
    head: new THREE.SphereGeometry(0.2, 28, 22),
    ear: new THREE.SphereGeometry(0.045, 10, 8),
    sclera: new THREE.SphereGeometry(0.042, 14, 10),
    iris: new THREE.SphereGeometry(0.026, 12, 10),
    shine: new THREE.SphereGeometry(0.009, 6, 5),
    brow: new THREE.BoxGeometry(0.075, 0.017, 0.02),
    nose: new THREE.SphereGeometry(0.021, 10, 8),
    mouth: new THREE.TorusGeometry(0.03, 0.007, 6, 14, Math.PI),
    hairCap: new THREE.SphereGeometry(0.218, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.5),
    hairBack: new THREE.SphereGeometry(0.214, 24, 18),
    fringe: new THREE.SphereGeometry(0.1, 14, 10),
    spike: new THREE.ConeGeometry(0.05, 0.14, 7),
    shirtV: new THREE.ConeGeometry(0.09, 0.2, 3),
    tie: new THREE.BoxGeometry(0.05, 0.22, 0.02),
    zip: new THREE.BoxGeometry(0.02, 0.4, 0.02),
    stripe: new THREE.CylinderGeometry(0.077, 0.077, 0.03, 12),
    pin: new THREE.SphereGeometry(0.03, 10, 8),
    lens: new THREE.TorusGeometry(0.046, 0.008, 6, 18),
    bridge: new THREE.BoxGeometry(0.05, 0.009, 0.009),
    shield: new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24),
    boss: new THREE.SphereGeometry(0.07, 12, 8),
    bat: new THREE.CylinderGeometry(0.05, 0.022, 0.62, 12),
    handle: new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8),
    prong: new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6),
    page: new THREE.BoxGeometry(0.18, 0.012, 0.24),
    pom: new THREE.IcosahedronGeometry(0.11, 1),
    band: new THREE.CylinderGeometry(0.082, 0.082, 0.08, 16, 1, true),
    ball: new THREE.SphereGeometry(0.11, 18, 14),
    paper: (() => { const g = new THREE.PlaneGeometry(0.9, 1.15, 8, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.1 * Math.cos(x * 3) + 0.04 * Math.sin(y * 5)); } g.computeVertexNormals(); return g; })(),
    bookBox: new THREE.BoxGeometry(1.0, 1.25, 0.32),
    limb: new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8),
    chalkP: new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8),
    plane: (() => { const g = new THREE.ConeGeometry(0.14, 0.45, 3); g.rotateX(Math.PI / 2); g.scale(1, 0.35, 1); return g; })(),
    spark: new THREE.SphereGeometry(0.045, 6, 5),
    ringFx: new THREE.RingGeometry(0.86, 1, 56),
  });
  raycaster = new THREE.Raycaster();
  pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.55);
}
// ----- 친구 캐릭터 -----
function nameHash(n) { let h = 7; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

function buildStudent(def, enemy) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const ud = g.userData; ud.mats = []; ud.walk = Math.random() * 6; ud.move = 0;
  const mk = (hex, rough = 0.75, extra) => { const m = M(hex, rough, extra); ud.mats.push(m); return m; };
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const h = nameHash(def.n);
  const sporty = def.t.includes("운동광"), nerd = def.t.includes("공부는 잘함"), soccer = def.t.includes("축구부");
  const kind = def.t.includes("다 퍼줌"), fierce = def.t.includes("지는 거 못 참음");
  const skin = SKINS[h % SKINS.length], hairCol = HAIRC[(h >> 3) % HAIRC.length];
  const jacket = sporty ? TRACK[(h >> 5) % TRACK.length] : 0x27324a;
  const mSkin = mk(skin, 0.55), mJacket = mk(jacket, sporty ? 0.6 : 0.85), mPants = mk(sporty ? jacket : 0x2b303b, 0.85);
  const mShirt = mk(0xf4f2ec, 0.7), mHair = mk(hairCol, 0.5), mShoe = mk(sporty ? 0xf4f4f4 : 0x2b2420, 0.45);
  const mDark = mk(0x1c1410, 0.25), mWhite = mk(0xffffff, 0.3, { emissive: lin(0x333333) });
  // 팀 표시 고리
  const rm = new THREE.MeshBasicMaterial({ color: lin(enemy ? 0xff5a4a : 0x5ae0a0), transparent: true, opacity: 0.9 });
  ud.mats.push(rm);
  const ring = new THREE.Mesh(GEO.teamRing, rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.21; g.add(ring);
  // 다리
  ud.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.8, 0); g.add(hip);
    put(GEO.leg, mPants, 0, -0.26, 0, hip);
    put(GEO.shoe, mShoe, 0, -0.54, 0.04, hip).scale.set(1, 0.55, 1.5);
    ud.legs.push(hip);
  }
  // 몸통
  const torso = new THREE.Group(); torso.position.y = 0.78; g.add(torso); ud.torso = torso;
  put(GEO.torso, mJacket, 0, 0, 0, torso).scale.z = 0.72;
  if (!sporty) {
    const v = put(GEO.shirtV, mShirt, 0, 0.42, 0.165, torso); v.rotation.x = Math.PI; v.scale.z = 0.3;
    put(GEO.tie, mk(0xb8323a, 0.6), 0, 0.33, 0.2, torso);
  } else put(GEO.zip, mWhite, 0, 0.27, 0.198, torso);
  if (kind) put(GEO.pin, mk(0xff7aa8, 0.4), 0.13, 0.4, 0.17, torso);
  put(GEO.neck, mSkin, 0, 0.6, 0, torso);
  // 머리
  const head = new THREE.Group(); head.position.y = 0.78; head.scale.setScalar(0.86); torso.add(head); ud.head = head;
  put(GEO.head, mSkin, 0, 0, 0, head).scale.set(1, 1.08, 1.02);
  for (const s of [-1, 1]) {
    put(GEO.ear, mSkin, s * 0.2, -0.01, 0, head).scale.set(0.6, 1, 1);
    put(GEO.sclera, mWhite, s * 0.07, 0.012, 0.17, head).scale.set(0.9, 0.8, 0.45);
    put(GEO.iris, mDark, s * 0.07, 0.01, 0.188, head).scale.setScalar(0.8);
    put(GEO.shine, mWhite, s * 0.07 + 0.007, 0.018, 0.2, head);
    put(GEO.brow, mDark, s * 0.07, 0.04, 0.188, head).scale.set(0.95, 0.6, 1);
    const b = put(GEO.brow, mHair, s * 0.074, 0.085, 0.178, head);
    b.rotation.z = fierce ? s * 0.28 : kind ? -s * 0.12 : 0;
  }
  put(GEO.nose, mSkin, 0, -0.03, 0.198, head);
  const mo = put(GEO.mouth, mk(0x9b4a44, 0.6), 0, -0.088, 0.182, head); mo.rotation.z = Math.PI; mo.scale.set(0.75, 0.6, 1);
  // 머리카락 (이름마다 다른 스타일)
  const style = (h >> 7) % 5;
  const back = put(GEO.hairBack, mHair, 0, 0.035, -0.035, head); back.scale.set(1.03, 1.02, 1.03);
  const cap = put(GEO.hairCap, mHair, 0, 0.02, 0, head); cap.scale.set(1.04, 1.12, 1.06); cap.rotation.x = -0.18;
  if (style === 0) { const f = put(GEO.fringe, mHair, 0, 0.13, 0.13, head); f.scale.set(1.9, 0.55, 0.9); }
  else if (style === 1) { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const sp = put(GEO.spike, mHair, Math.cos(a) * 0.11, 0.21, Math.sin(a) * 0.09 - 0.02, head); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } }
  else if (style === 2) { const f = put(GEO.fringe, mHair, 0.06, 0.14, 0.12, head); f.scale.set(1.7, 0.5, 0.95); f.rotation.z = -0.35; }
  else if (style === 3) { cap.scale.set(1.0, 1.02, 1.02); back.scale.set(0.99, 0.98, 0.99); }
  else { cap.scale.set(1.12, 1.15, 1.12); const f = put(GEO.fringe, mHair, 0, 0.09, 0.15, head); f.scale.set(2.0, 0.6, 0.7); }
  if (def.t.includes("프로게이머")) {
    const hs = mk(0x26282c, 0.4, { metalness: 0.3 }), led = mk(0x7ff0ff, 0.3, { emissive: lin(0x3fd8ff) });
    put(new THREE.TorusGeometry(0.255, 0.022, 8, 24, Math.PI), hs, 0, 0.02, 0, head);
    for (const s2 of [-1, 1]) { const cup = put(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), hs, s2 * 0.24, 0, 0, head); cup.rotation.z = Math.PI / 2; put(GEO.pin, led, s2 * 0.275, 0, 0, head).scale.setScalar(0.6); }
  }
  if (def.t.includes("전교 1등")) {
    put(new THREE.BoxGeometry(0.06, 0.14, 0.012), mk(0xc8323a, 0.6), 0, 0.42, 0.2, torso);
    const md = put(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 20), mk(0xffd24a, 0.25, { metalness: 0.85 }), 0, 0.33, 0.215, torso); md.rotation.x = Math.PI / 2;
  }
  if (nerd) {
    const mg = mk(0x222222, 0.3, { metalness: 0.6 });
    for (const s of [-1, 1]) put(GEO.lens, mg, s * 0.072, 0.012, 0.205, head);
    put(GEO.bridge, mg, 0, 0.02, 0.21, head);
  }
  // 팔
  ud.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.31, 0.47, 0); torso.add(sh);
    put(GEO.sleeve, mJacket, 0, -0.18, 0, sh);
    if (sporty) put(GEO.stripe, mWhite, 0, -0.3, 0, sh);
    put(GEO.hand, mSkin, 0, -0.39, 0, sh);
    ud.arms.push(sh);
  }
  ud.restZ = [-0.12, 0.12];
  const [L, R] = ud.arms;
  const WP = WEAPONS[def.n];
  if (WP) WP.build({ put, mk, L, R, torso, ud, g, def });
  if (!WP || def.k === "반장") switch (def.k) {
    case "수호자": {
      const sd = put(GEO.shield, mk(0xb8c4bc, 0.35, { metalness: 0.7 }), -0.1, -0.3, 0.06, L); sd.rotation.z = Math.PI / 2;
      put(GEO.boss, mk(COST_HEX[def.c], 0.4, { metalness: 0.5 }), -0.14, -0.3, 0.06, L);
      break;
    }
    case "돌격대": { const b = put(GEO.bat, mk(0xc89a5c, 0.5), 0, -0.45, 0.24, R); b.rotation.x = Math.PI / 2.4; break; }
    case "저격수": {
      const mw = mk(0x7a5232, 0.6);
      const hd = put(GEO.handle, mw, 0, -0.45, 0.08, R); hd.rotation.x = 0.4;
      for (const s of [-1, 1]) { const p = put(GEO.prong, mw, s * 0.04, -0.37, 0.14, R); p.rotation.set(0.4, 0, -s * 0.35); }
      break;
    }
    case "천재": {
      const pg = mk(0xf6f2e6, 0.8), cvr = mk(0x8a5cd0, 0.6);
      for (const s of [-1, 1]) { const p = put(GEO.page, pg, s * 0.09, -0.44, 0.12, L); p.rotation.z = s * 0.25; }
      put(GEO.page, cvr, 0, -0.455, 0.12, L).scale.set(2.05, 0.6, 1.05);
      break;
    }
    case "응원단": {
      const pm = mk(COST_HEX[def.c] || 0xffcc4d, 0.6, { flatShading: true });
      put(GEO.pom, pm, 0, -0.45, 0.02, L); put(GEO.pom, pm, 0, -0.45, 0.02, R);
      break;
    }
    case "반장": {
      const tex = textTex("armband", 256, 64, (gg, w, hh) => { gg.fillStyle = "#c8323a"; gg.fillRect(0, 0, w, hh); gg.fillStyle = "#fff"; gg.font = `44px ${DF()}`; gg.textAlign = "center"; gg.textBaseline = "middle"; for (let i = 0; i < 2; i++) gg.fillText("반장", w * (0.25 + i * 0.5), hh / 2 + 2); });
      const am = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }); ud.mats.push(am);
      put(GEO.band, am, 0, -0.12, 0, L);
      put(GEO.pin, mk(0xffcc4d, 0.3, { metalness: 0.8 }), -0.12, 0.4, 0.17, torso).scale.setScalar(1.3);
      break;
    }
  }
  return g;
}
function buildMonster(mon, enemy) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const ud = g.userData; ud.mats = []; ud.walk = Math.random() * 6; ud.move = 0;
  const mk = (hex, rough = 0.7) => { const m = M(hex, rough); ud.mats.push(m); return m; };
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const rm = new THREE.MeshBasicMaterial({ color: lin(enemy ? 0xff5a4a : 0x5ae0a0), transparent: true, opacity: 0.9 }); ud.mats.push(rm);
  const ring = new THREE.Mesh(GEO.teamRing, rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.21; g.add(ring);
  const tex = paperTex(mon.mn);
  if (mon.boss) {
    const side = mk(0xf2eee2, 0.9), front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), cover = mk(mon.col, 0.6);
    ud.mats.push(front);
    put(GEO.bookBox, [side, side, cover, cover, front, cover], 0, 1.05, 0);
  } else {
    const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }); ud.mats.push(pm);
    put(GEO.paper, pm, 0, 1.0, 0);
  }
  const mDark = mk(0x1c1410, 0.3), mWhite = mk(0xffffff, 0.3), limb = mk(0x24302a, 0.6);
  const fz = mon.boss ? 0.17 : 0.06;
  for (const s of [-1, 1]) {
    put(GEO.sclera, mWhite, s * 0.16, 1.28, fz).scale.set(1.3, 1.3, 0.5);
    put(GEO.iris, mDark, s * 0.15, 1.27, fz + 0.025);
    const b = put(GEO.brow, mDark, s * 0.16, 1.37, fz + 0.01); b.rotation.z = s * 0.4; b.scale.x = 1.4;
    const l = put(GEO.limb, limb, s * 0.22, 0.38, 0); ud[s < 0 ? "lLeg" : "rLeg"] = l;
    const a = put(GEO.limb, limb, s * (mon.boss ? 0.6 : 0.5), 1.0, 0); a.rotation.z = s * 0.9;
  }
  return g;
}
function buildUnit(sp, enemy) {
  if (sp.robot) return buildRobot(enemy);
  if (sp.mon && sp.mon.summon) {
    const g = buildStudent(SUMMON_DEF, enemy);
    for (const m of g.userData.mats) if (m.emissive) { m.emissive.copy(lin(0x1a6a60)); m.emissiveIntensity = 0.8; }
    const aura = new THREE.Mesh(GEO.ringFx, additive("#7ff0e0")); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.24; aura.scale.setScalar(0.7); g.add(aura);
    return g;
  }
  return sp.mon ? buildMonster(sp.mon, enemy) : buildStudent(DEFS[sp.d], enemy);
}
// 키(유닛·투사체 등)마다 3D 물체를 하나씩 두고, 이번 프레임에 안 쓰인 것은 지워요
const pool = new Map(); let frameId = 0, clock3d = 0;
function useMesh(key, make) {
  let e = pool.get(key);
  if (!e) { e = { o: make() }; scene.add(e.o); pool.set(key, e); }
  e.f = frameId; return e.o;
}
function sweep() {
  for (const [k, e] of pool) if (e.f !== frameId) {
    scene.remove(e.o);
    e.o.traverse((m) => { if (m.material) [].concat(m.material).forEach((x) => x.dispose()); });
    pool.delete(k);
  }
}
function fitCamera() {
  const elev = THREE.MathUtils.degToRad(W / H3 > 1.15 ? 44 : 55);
  const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
  const pts = [[-7.2, 0, -6.4], [7.2, 0, -6.4], [-7.2, 0, 8.6], [7.2, 0, 8.6], [-6.5, 1.9, -6.3], [6.5, 1.9, -6.3]].map((p) => new THREE.Vector3(...p));
  const target = new THREE.Vector3(0, 0, 1);
  const place = (d) => { camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); camera.updateMatrixWorld(); };
  const bounds = () => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const v = p.clone().project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { x0, x1, y0, y1 };
  };
  for (let it = 0; it < 5; it++) {
    let lo = 4, hi = 150;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2; place(mid); const b = bounds();
      const xl = W / H > 1.2 ? 0.62 : 0.95; if (b.x0 >= -xl && b.x1 <= xl && b.y0 >= -0.97 && b.y1 <= 0.4) hi = mid; else lo = mid;
    }
    place(hi); const b = bounds();
    target.z -= ((b.y0 + b.y1) / 2 + 0.28) * 3;
  }
  camBase = { pos: camera.position.clone() };
}
function resize() {
  W = window.innerWidth; H = window.innerHeight; H3 = H;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = Math.max(30, Math.min(W, H) * 0.062);
  IT.s = s; IT.x0 = 12; IT.cols = H < 600 ? 5 : 3; IT.y0 = H < 600 ? H * 0.4 : H * 0.5;
  if (HAS3D && renderer) {
    const pr = HQ ? Math.min(2, window.devicePixelRatio || 1) : Math.min(1.25, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false); gl.style.width = W + "px"; gl.style.height = H + "px";
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); }
    camera.aspect = W / H; camera.updateProjectionMatrix(); fitCamera();
    if (BACKDROP) applyBackdrop(BACKDROP);
  }
}
const IT = { x0: 12, y0: 300, s: 40, cols: 3 };
const itemRect = (i) => [IT.x0 + (i % IT.cols) * (IT.s + 6), IT.y0 + Math.floor(i / IT.cols) * (IT.s + 6)];
let drag = null, lastT = performance.now();
function comboOf(m) { const B = S.battle; if (!B) return null; const r = B.f.find((u) => u.combo && u.combo.members.some((q) => q.m === m)); return r && r.combo.t < r.combo.dur ? r.combo : null; }
function collect(dt) {
  const out = [], P = human(), dragging = drag && drag.moved && drag.loc.w !== "i" ? drag.obj : null;
  const push = (key, sp, x, z, o = {}) => out.push({ key, sp, x, z, ...o });
  if (S.phase === "carousel" && S.car) {
    const C = S.car;
    C.opts.forEach((o, i) => {
      if (o.taken) return;
      const a = C.ang + (i * 2 * Math.PI) / C.opts.length;
      push(o, { d: o.d, star: 1, items: o.item ? [o.item] : [] }, Math.cos(a) * 3.6, Math.sin(a) * 3.2, { face: Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2, lift: 0.14, walking: 1 });
    });
  } else if (S.battle && (S.phase === "combat" || S.phase === "result")) {
    for (const u of S.battle.f) {
      if (u.merged) {
        const k = comboOf(u);
        if (!k || k.t >= 1.25) continue;
        const mm = k.members.find((q) => q.m === u), p = Math.min(1, k.t / 1.2), ang = mm.a0 + p * 7, rad = mm.r0 * (1 - p * p);
        push(u, u, k.cx + Math.cos(ang) * rad, k.cz + Math.sin(ang) * rad, { f: null, face: ang + Math.PI, lift: p * 1.6 + Math.sin(p * Math.PI) * 0.3, alpha: 1, walking: 1 });
        continue;
      }
      if (u.combo && u.combo.t < u.combo.dur) {
        const t = u.combo.t; if (t < 1.3) continue;
        const q = Math.min(1, (t - 1.3) / 0.7), drop = q < 1 ? 4.5 * (1 - q) * (1 - q) : Math.abs(Math.sin((t - 2.0) * 9)) * 0.25 * Math.max(0, 1 - (t - 2.0) / 0.4);
        push(u, u, worldX(u.X), worldZ(u.Y), { f: u, enemy: u.team === 1, face: u.team ? 0 : Math.PI, lift: drop, alpha: 1 });
        continue;
      }
      if (!u.alive) { if (u.deadT <= 0) continue; u.deadT -= dt; }
      let x = worldX(u.X), z = worldZ(u.Y);
      if (u.lunge > 0) { const k = Math.sin((u.lunge / 0.18) * Math.PI) * 0.3; x += u.lx * SQ3 * k; z += u.ly * 1.5 * k; }
      let face = u.team ? 0 : Math.PI;
      if (u.alive && u.tgt) face = Math.atan2(worldX(u.tgt.X) - worldX(u.X), worldZ(u.tgt.Y) - worldZ(u.Y));
      push(u, u, x, z, { hit: u.alive ? { g: "board", r: u.r, c: u.c } : null, enemy: u.team === 1, f: u, flash: u.flash > 0, alpha: u.alive ? 1 : Math.max(0, u.deadT / 0.45), face,
        jump: u.castT > 0 ? Math.sin((u.castT / 0.35) * Math.PI) * 0.45 : 0, dead: !u.alive });
    }
  } else {
    if (S.scout != null) {
      const Q = S.players[S.scout];
      for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) {
        const u = Q.board[r][c]; if (!u) continue;
        push(u, u, worldX(gridX(3 - r, COLS - 1 - c)), worldZ(3 - r), { enemy: true, face: 0 });
      }
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) {
      const u = P.board[r][c]; if (!u || u === dragging) continue;
      push(u, u, worldX(gridX(4 + r, c)), worldZ(4 + r), { face: 0, hit: { g: "board", r: 4 + r, c } });
    }
  }
  P.bench.forEach((u, i) => { if (u && u !== dragging) push(u, u, benchX(i), BENCH_Z, { face: 0, bench: 1, lift: 0.0, hit: { g: "bench", i } }); });
  if (dragging && drag.wp) push(dragging, dragging, drag.wp.x, drag.wp.z, { lift: 0.5, alpha: 0.85, face: 0, held: 1 });
  return out;
}
function placeUnit(it, dt) {
  const g = useMesh(it.sp.robot ? "robot:" + (it.enemy ? 1 : 0) + ":" + (S.battle ? S.battle.t0 || (S.battle.t0 = Math.random()) : 0) : it.key, () => buildUnit(it.sp, it.enemy)), ud = g.userData;
  const sc = (it.sp.mon ? (it.sp.mon.boss ? 1.45 : it.sp.mon.summon ? 0.85 : 1.1) : [1, 1.18, 1.32, 1.48][it.sp.star] * (it.sp.robot ? 1.6 : 1)) * (it.bench ? 0.8 : 1);
  g.scale.setScalar(sc);
  // 움직임 감지 → 걷기
  const pv = ud.prev || { x: it.x, z: it.z };
  const speed = Math.hypot(it.x - pv.x, it.z - pv.z) / Math.max(dt, 1e-3);
  ud.prev = { x: it.x, z: it.z };
  const moving = it.walking ? 0.6 : it.held ? 0 : Math.min(1, speed / 2.2);
  ud.move = ud.move * 0.85 + moving * 0.15;
  ud.walk += dt * 10;
  const sw = Math.sin(ud.walk) * 0.65 * ud.move;
  const bounce = Math.abs(Math.sin(ud.walk)) * 0.05 * ud.move;
  g.position.set(it.x, (it.lift || 0) + (it.jump || 0) + bounce - (it.dead ? (1 - it.alpha) * 0.4 : 0), it.z);
  const cur = g.rotation.y, d = ((((it.face ?? 0) - cur) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  g.rotation.y = cur + d * Math.min(1, dt * 10);
  g.rotation.x = it.dead ? -(1 - it.alpha) * 1.4 : it.held ? 0.25 : 0;
  if (ud.legs) {
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
    let la = -sw * 0.8, ra = sw * 0.8, lz = ud.restZ[0], rz = ud.restZ[1];
    const f = it.f;
    if (f && f.lunge > 0) ra = -1.9 * Math.sin((f.lunge / 0.18) * Math.PI);
    else if (f && f.atkT > 0) ra = -1.3 * Math.sin((f.atkT / 0.22) * Math.PI);
    if (it.jump > 0) { lz = -0.4 - it.jump * 3; rz = 0.4 + it.jump * 3; }
    if (it.held) { la = -0.3; ra = -0.3; lz = -0.6; rz = 0.6; }
    ud.arms[0].rotation.set(la, 0, lz); ud.arms[1].rotation.set(ra, 0, rz);
    ud.torso.scale.y = 1 + Math.sin(clock3d * 2.2 + it.x) * 0.012;
    ud.head.rotation.y = Math.sin(clock3d * 0.7 + it.z * 2) * 0.18 * (1 - ud.move);
    if (ud.ball) ud.ball.rotation.x += dt * 6 * ud.move;
  } else {
    if (ud.lLeg) { ud.lLeg.rotation.x = sw; ud.rLeg.rotation.x = -sw; }
    g.position.y += Math.sin(clock3d * 2 + it.x) * 0.04;
  }
  const a = it.alpha ?? 1;
  for (const m of ud.mats) {
    const base = m.isMeshBasicMaterial ? 0.9 : 1;
    m.transparent = a < 1 || m.isMeshBasicMaterial; m.opacity = a * base;
    if (m.emissive && m.userData.e0 === undefined) m.userData.e0 = m.emissive.getHex();
    if (m.emissive) m.emissive.setHex(it.flash ? 0x3a3a3a : m.userData.e0);
  }
  it.g = g;
}
const additive = (col) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
let WFX = [];
function drawFx(list, dt) {
  for (const g of list) {
    g.t -= dt;
    const k = 1 - g.t / g.t0, x = g.w ? g.X : worldX(g.X), z = g.w ? g.Y : worldZ(g.Y);
    if (g.kind === "spark") {
      const grp = useMesh(g, () => {
        const gg = new THREE.Group(), mat = additive(g.col);
        gg.userData.dirs = [];
        for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(GEO.spark, mat); gg.add(s); gg.userData.dirs.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize()); }
        return gg;
      });
      grp.position.set(x, 0.9, z);
      grp.children.forEach((s, i) => { s.position.copy(grp.userData.dirs[i]).multiplyScalar(k * 0.7); s.scale.setScalar(1 - k * 0.7); });
      grp.children[0].material.opacity = Math.max(0, 1 - k);
    } else {
      const m = useMesh(g, () => { const mm = new THREE.Mesh(GEO.ringFx, additive(g.col)); mm.rotation.x = -Math.PI / 2; return mm; });
      m.position.set(x, 0.24, z); m.scale.setScalar(Math.max(0.05, g.r * (0.3 + 0.9 * k)));
      m.material.opacity = Math.max(0, g.t / g.t0);
    }
  }
  return list.filter((g) => g.t > 0);
}
function render3D(dt) {
  frameId++; clock3d += dt;
  const P = human();
  const holding = S.phase === "plan" && ((S.sel && S.sel.w !== "i" && getAt(P, S.sel)) || (drag && drag.moved && drag.obj && drag.loc.w !== "i"));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const sel = S.phase === "plan" && S.sel && S.sel.w === "b" && S.sel.r + 4 === r && S.sel.c === c;
    const t = tiles[r][c], on = sel || (holding && r >= 4);
    t.fill.material.opacity = sel ? 0.35 : on ? 0.12 : 0.04; t.fill.material.color.setHex(sel ? 0xffd75a : 0xffffff);
    t.line.material.opacity = on ? 0.6 : S.phase === "carousel" ? 0 : 0.22;
  }
  pads.forEach((p, i) => p.material.emissive.setHex(S.sel && S.sel.w === "n" && S.sel.i === i ? 0x5a4a08 : 0));
  stepTactician(dt);
  TORCH.forEach((t, i) => { const f = 1 + Math.sin(clock3d * 13 + i * 2) * 0.08 + Math.sin(clock3d * 29 + i) * 0.05; t.flame.scale.set(f, 1 + (f - 1) * 2, f); t.inner.scale.setScalar(f); t.light.intensity = 1.2 * f; });
  carousel.visible = S.phase === "carousel";
  if (carousel.visible && S.car) carousel.rotation.y = -S.car.ang;
  const R = collect(dt);
  LAST_R = R;
  R.forEach((it) => placeUnit(it, dt));
  const B = S.battle;
  if (B && (S.phase === "combat" || S.phase === "result")) {
    for (const p of B.projs) {
      const m = useMesh(p, () => (p.mesh = projSpecial(p)) ? p.mesh : p.trail
        ? new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({ color: lin(0xffffff), emissive: lin(0xf5d76e), emissiveIntensity: 0.6, roughness: 0.6 }))
        : new THREE.Mesh(GEO.chalkP, new THREE.MeshStandardMaterial({ color: new THREE.Color(p.col).convertSRGBToLinear(), roughness: 0.9 })));
      m.position.set(worldX(p.X), 1.05, worldZ(p.Y));
      m.lookAt(worldX(p.t.X), 1.05, worldZ(p.t.Y));
      if (!p.trail) m.rotateX(Math.PI / 2); else m.rotateZ(Math.sin(clock3d * 20) * 0.2);
    }
    B.fx = drawFx(B.fx, dt);

  }
  const crb = B && B.f.find((u) => u.combo && u.combo.t < u.combo.dur);
  if (crb && (S.phase === "combat" || S.phase === "result")) {
    const k = crb.combo, pil = useMesh(k, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 32, 1, true), additive("#9ff6ff")); return m; });
    const up = Math.min(1, k.t / 1.0), fade = k.t < 1.25 ? 1 : Math.max(0, 1 - (k.t - 1.25) / 0.5);
    pil.position.set(k.cx, 7 * up, k.cz); pil.scale.set(0.3 + up * 0.6 + Math.sin(k.t * 30) * 0.05, up, 0.3 + up * 0.6);
    pil.material.opacity = 0.55 * fade;
  }
  WFX = drawFx(WFX, dt);
  for (const o of S.orbs || []) {
    const m = useMesh(o, () => { const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), new THREE.MeshStandardMaterial({ color: lin(o.gold ? 0xffd75a : 0x7fc4ff), emissive: lin(o.gold ? 0xb08a20 : 0x2a6ab0), roughness: 0.2, metalness: 0.3 })); core.castShadow = true; g.add(core); const halo = new THREE.Mesh(GEO.ringFx, additive(o.gold ? "#f5d76e" : "#7fc4ff")); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.55; halo.scale.setScalar(0.55); g.add(halo); return g; });
    m.position.set(o.x, 0.75 + Math.sin(clock3d * 3 + o.x) * 0.12, o.z); m.rotation.y += dt;
  }
  sweep();
  if (camBase) {
    camera.position.copy(camBase.pos);
    if (S.shake > 0) { S.shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.3; camera.position.y += (Math.random() - 0.5) * 0.3; }
  }
  stepDecor(dt);
  if (composer && HQ) composer.render(); else renderer.render(scene, camera);
  return R;
}
const _v = HAS3D ? new THREE.Vector3() : null;
function proj(x, y, z) { _v.set(x, y, z).project(camera); return [((_v.x + 1) / 2) * W, ((1 - _v.y) / 2) * H3]; }
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function font(px) { return `${Math.round(px)}px ${TOK["--display"]}`; }
function drawItemBox(id, x, y, s) {
  const it = ITEMS[id];
  ctx.fillStyle = it.comp ? it.col : "#2b2410";
  roundRect(x, y, s, s, s * 0.22); ctx.fill();
  if (!it.comp) { ctx.strokeStyle = TOK["--c5"]; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.stroke(); }
  ctx.fillStyle = it.comp ? "#10201a" : TOK["--c5"];
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = font(s * 0.62);
  ctx.fillText(it.n[0], x + s / 2, y + s / 2 + 1);
}
function drawOverlay(dt, R) {
  ctx.clearRect(0, 0, W, H);
  const u0 = Math.max(10, Math.min(W, H) / 52);
  // 유닛 머리 위 정보
  for (const it of R) {
    const sc = it.g ? it.g.scale.x : 1;
    const [sx, sy] = proj(it.x, (it.lift || 0) + (it.jump || 0) + 1.95 * sc, it.z);
    if (S.phase === "carousel" && it.key && "taken" in it.key) { it.key.sx = sx; it.key.sy = sy + u0 * 1.6; }
    ctx.globalAlpha = it.alpha ?? 1;
    const sp = it.sp, fs = u0 * (it.bench ? 0.78 : 0.92);
    const name = sp.robot ? "합체로봇" : sp.mon ? sp.mon.mn : short(DEFS[sp.d].n);
    if (!sp.mon) {
      ctx.fillStyle = sp.star === 3 ? TOK["--c5"] : TOK["--accent"]; ctx.font = font(fs * 0.85);
      ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("★".repeat(sp.star), sx, sy - fs * 1.15);
    }
    ctx.font = font(fs); ctx.textBaseline = "middle";
    const tw = ctx.measureText(name).width + fs * 0.6;
    ctx.fillStyle = it.enemy ? "rgba(90,30,26,.85)" : "rgba(16,32,26,.8)";
    roundRect(sx - tw / 2, sy - fs * 1.1, tw, fs * 1.15, fs * 0.35); ctx.fill();
    ctx.fillStyle = TOK["--chalk"]; ctx.fillText(name, sx, sy - fs * 0.5);
    if (it.f && (it.f.stunT > 0 || it.f.vulnT > 0) && it.f.alive) {
      ctx.font = font(fs * 0.8); ctx.fillStyle = it.f.stunT > 0 ? TOK["--accent"] : TOK["--c4"]; ctx.textBaseline = "bottom";
      ctx.fillText(it.f.stunT > 0 ? "기절" : "약점", sx, sy - fs * (sp.mon ? 1.2 : 2.1));
    }
    if (it.f) {
      const f = it.f, bw = u0 * 2.6, bx = sx - bw / 2, by = sy + 2;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = it.enemy ? TOK["--danger"] : TOK["--c2"]; ctx.fillRect(bx, by, bw * Math.max(0, f.hp / f.maxHp), 5);
      ctx.fillStyle = "rgba(0,0,0,.6)"; for (let v = 300; v < f.maxHp; v += 300) ctx.fillRect(bx + (bw * v) / f.maxHp, by, 1, v % 1500 === 0 ? 5 : 3);
      if (f.shield > 0) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(bx, by, Math.min(bw, bw * (f.shield / f.maxHp)), 2); }
      if (f.mm !== Infinity) { ctx.fillStyle = TOK["--c3"]; ctx.fillRect(bx, by + 6, bw * Math.min(1, f.mana / f.mm), 3); }
    }
    const items = sp.items || [];
    if (items.length && !it.bench) {
      const s = fs * 0.95, w = items.length * s + (items.length - 1) * 2, y = sy + (it.f ? 12 : 3);
      items.forEach((id, i) => drawItemBox(id, sx - w / 2 + i * (s + 2), y, s));
    } else if (items.length) {
      ctx.fillStyle = TOK["--c5"]; ctx.beginPath(); ctx.arc(sx + tw / 2, sy - fs * 1.1, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 떠오르는 숫자
  const B = S.battle;
  if (B && (S.phase === "combat" || S.phase === "result")) {
    for (const f of B.floats) {
      f.t -= dt; f.h += dt * 1.3;
      const [x, y] = proj(worldX(f.X), f.h, worldZ(f.Y));
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 2));
      ctx.fillStyle = f.col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = font(u0 * (f.big ? 1.25 : 1)); ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3;
      ctx.strokeText(f.text, x, y); ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
    B.floats = B.floats.filter((f) => f.t > 0);
    const label = S.type === "pve" ? "몬스터 라운드" : S.opp ? `상대: ${S.opp.name}${S.oppGhost ? " (복제)" : ""}` : "";
  }
  // 급식 줄 안내
  if (S.phase === "carousel" && S.car) {
    const C = S.car, cur = C.order[C.turn];
    const [cx, cy] = proj(0, 0.3, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = TOK["--accent"]; ctx.font = font(u0 * 1.7); ctx.fillText("급식 줄", cx, cy - u0 * 1.2);
    ctx.fillStyle = TOK["--chalk"]; ctx.font = font(u0 * 1.05);
    const msg = !cur ? "모두 골랐어요" : cur.human ? (C.t >= C.wait ? `지금 고르세요! ${Math.ceil(C.humanT)}초` : "곧 내 차례!") : `${cur.name}이(가) 고르는 중`;
    ctx.fillText(msg, cx, cy + u0 * 0.4);
    const my = C.order.findIndex((p) => p.human);
    if (cur && my > C.turn) { ctx.fillStyle = TOK["--chalk-dim"]; ctx.fillText(`내 순서: ${my + 1}번째`, cx, cy + u0 * 1.7); }
  }
  // 대기석·아이템 줄
  const P = human();
  // 내 마스코트 체력
  if (tact) {
    const [tx, ty] = proj(tact.position.x, 1.6, tact.position.z), bw = u0 * 4;
    ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(tx - bw / 2 - 1, ty - 1, bw + 2, 8);
    ctx.fillStyle = "#4fe08a"; ctx.fillRect(tx - bw / 2, ty, bw * Math.max(0, P.hp) / 100, 6);
    ctx.fillStyle = "#fff"; ctx.font = font(u0 * 0.9); ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(String(Math.max(0, P.hp)), tx, ty - 2);
  }
  // 아이템 칸 (왼쪽)
  if (ITEMS_ON) {
  ctx.fillStyle = TOK["--chalk-dim"]; ctx.font = font(u0 * 0.95); ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText(`아이템 ${P.items.length}/${ITEM_MAX}`, IT.x0, IT.y0 - 4);
  for (let i = 0; i < ITEM_MAX; i++) {
    const [x, y] = itemRect(i);
    ctx.fillStyle = "rgba(14,20,24,.6)"; roundRect(x, y, IT.s, IT.s, 8); ctx.fill();
    ctx.strokeStyle = S.sel && S.sel.w === "i" && S.sel.i === i ? TOK["--accent"] : "rgba(180,143,74,.45)"; ctx.lineWidth = S.sel && S.sel.w === "i" && S.sel.i === i ? 3 : 1.5; ctx.stroke();
    const id = P.items[i];
    if (id && !(drag && drag.moved && drag.loc.w === "i" && drag.loc.i === i)) { const s = IT.s * 0.74; drawItemBox(id, x + (IT.s - s) / 2, y + (IT.s - s) / 2, s); }
  }
  if (drag && drag.moved && drag.obj && drag.loc.w === "i") { const s = IT.s * 0.8; drawItemBox(drag.obj, drag.x - s / 2, drag.y - s / 2, s); }
  }
  // 합체 연출: 섬광과 큰 글자
  const crb2 = S.battle && S.battle.f.find((u) => u.combo && u.combo.t < u.combo.dur);
  if (crb2) {
    const t = crb2.combo.t;
    if (t > 1.1 && t < 1.7) { ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - Math.abs(t - 1.28) / 0.4) * 0.95})`; ctx.fillRect(0, 0, W, H); }
    if (t > 1.95) {
      const q = Math.min(1, (t - 1.95) / 0.18), sc = 1 + (1 - q) * 0.8, [tx, ty] = proj(crb2.combo.cx, 3.2, crb2.combo.cz);
      ctx.save(); ctx.translate(tx, ty); ctx.scale(sc, sc); ctx.globalAlpha = q;
      ctx.font = font(u0 * 4.2); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#7ff0ff"; ctx.shadowBlur = 24; ctx.lineWidth = 8; ctx.strokeStyle = "#0b2a3a"; ctx.strokeText("합체!", 0, 0);
      const gr = ctx.createLinearGradient(0, -u0 * 2, 0, u0 * 2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, "#7ff0ff"); gr.addColorStop(1, "#ffd36b");
      ctx.fillStyle = gr; ctx.fillText("합체!", 0, 0); ctx.restore();
    } else if (t < 1.2) {
      const [tx, ty] = proj(crb2.combo.cx, 3.0, crb2.combo.cz);
      ctx.font = font(u0 * 1.6); ctx.textAlign = "center"; ctx.fillStyle = "#cff8ff"; ctx.globalAlpha = 0.6 + Math.sin(t * 20) * 0.4;
      ctx.fillText("합체 준비…", tx, ty); ctx.globalAlpha = 1;
    }
  }
  // 승패 배너
  if (S.banner) {
    S.banner.t -= dt;
    const my = H3 * 0.42;
    ctx.globalAlpha = Math.max(0, Math.min(1, S.banner.t * 2));
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, my - u0 * 2, W, u0 * 4);
    ctx.fillStyle = S.banner.col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = font(u0 * 2.6); ctx.fillText(S.banner.text, W / 2, my);
    ctx.globalAlpha = 1;
    if (S.banner.t <= 0) S.banner = null;
  }
}
function tag(text, x, y) {
  if (!text) return;
  ctx.font = font(Math.max(12, W / 32)); ctx.textAlign = "left"; ctx.textBaseline = "top";
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(16,32,26,.75)"; roundRect(x, y, w, Math.max(12, W / 32) + 10, 8); ctx.fill();
  ctx.fillStyle = TOK["--chalk"]; ctx.fillText(text, x + 7, y + 5);
}
function loop(now) {
  const real = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (S && HAS3D) {
    const paused = !$("ov").hidden;
    const dt = paused ? 0 : real * S.speed;
    if (!paused) {
      if (S.phase === "plan") { if (S.augPending && !S.fast) { S.augT -= real; $("augtier").dataset.t = Math.max(0, Math.ceil(S.augT)); if (S.augT <= 0 && S.augChoose) S.augChoose(); } if (S.augPending && S.fast) { const b = $("augs").querySelector(".augcard"); if (b) b.click(); } if (!S.augPending) { S.timer -= real * (S.fast ? 30 : 1); if (S.timer <= 0) startCombat(); } }
      else if (S.phase === "combat") {
        let left = dt;
        while (left > 0 && !S.battle.done) { const s = Math.min(1 / 60, left); stepBattle(S.battle, s); left -= s; }
        if (S.battle.done) finishCombat();
      } else if (S.phase === "result") { S.resultT -= dt; if (S.resultT <= 0) afterResult(); }
      else if (S.phase === "carousel" && S.car) stepCarousel(dt * (S.fast ? 6 : 1));
    }
    const R = render3D(paused ? real : dt);
    drawOverlay(dt, R);
    updateTimer();
    if ((S.meterT = (S.meterT || 0) + real) > 0.4) { S.meterT = 0; updateMeter(); }
  }
  requestAnimationFrame(loop);
}
