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
  scene.fog = on ? null : new THREE.Fog(lin(FOG_HEX), 40, 95);
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
// ----- 숲속 절벽 경기장 -----
const FOG_HEX = 0xc7a0b6;
// 강: 경기장 왼쪽을 따라 굽이쳐 흘러요
const RIVER_HW = 1.45;
const riverX = (z) => -11.3 + Math.sin(z * 0.3 + 0.5);
const inRiver = (x, z, m = 0) => Math.abs(z) < 20.5 && Math.abs(x - riverX(z)) < RIVER_HW + m;
let WATER = null;
function riverRibbon(hw, y, mat, off = 0) {
  const pos = [], uv = [], idx = [], N = 72, z0 = -19.5, z1 = 19.5;
  for (let i = 0; i <= N; i++) {
    const z = z0 + ((z1 - z0) * i) / N, cx = riverX(z) + off;
    pos.push(cx - hw, y, z, cx + hw, y, z); uv.push(0, z / 5, 1, z / 5);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function buildWorld() {
  OUT = new THREE.Group(); scene.add(OUT);
  const R = Math.random;
  // 하늘: 해 질 녘 보랏빛
  scene.background = canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#35477f"); gr.addColorStop(0.38, "#77659f"); gr.addColorStop(0.72, "#c98aa4"); gr.addColorStop(1, "#f2bb8e");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(lin(FOG_HEX), 40, 95);
  // 떠 있는 섬: 짙은 숲 바닥
  const grass = noiseTex(512, "#3f6e2f", [["rgba(28,62,34,.42)", 520, 3, 9], ["rgba(128,170,70,.22)", 380, 1, 5], ["rgba(70,52,96,.16)", 60, 12, 34], ["rgba(120,95,55,.16)", 40, 8, 24]], 10);
  const top = new THREE.Mesh(new THREE.CircleGeometry(24, 48), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.0; top.receiveShadow = true; OUT.add(top);
  const rockMat = new THREE.MeshStandardMaterial({ color: lin(0x84728a), roughness: 0.95, flatShading: true });
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(24, 15, 10, 28, 3), rockMat);
  const cp = cliff.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < 4.9) { cp.setX(i, cp.getX(i) * (0.92 + R() * 0.16)); cp.setZ(i, cp.getZ(i) * (0.92 + R() * 0.16)); } }
  cliff.geometry.computeVertexNormals(); cliff.position.y = -5.02; OUT.add(cliff);
  // 강물과 강둑
  OUT.add(riverRibbon(RIVER_HW + 0.75, 0.02, new THREE.MeshStandardMaterial({ color: lin(0x8f7a55), roughness: 1 })));
  const waterTex = canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "#8fe0dc"); gr.addColorStop(0.22, "#3b9fcf"); gr.addColorStop(0.5, "#2376b8"); gr.addColorStop(0.78, "#3b9fcf"); gr.addColorStop(1, "#8fe0dc");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const x = 8 + R() * (w - 16), y = R() * h, rx = 1 + R() * 2.2, ry = 8 + R() * 22;
      g.fillStyle = `rgba(235,252,255,${0.1 + R() * 0.2})`;
      for (const dy of [-h, 0, h]) { g.beginPath(); g.ellipse(x, y + dy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
  waterTex.wrapT = THREE.RepeatWrapping;
  const water = riverRibbon(RIVER_HW, 0.06, new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.16, metalness: 0.1, emissive: lin(0x16507a), emissiveIntensity: 0.4 }));
  OUT.add(water); WATER = waterTex;
  // 경기장 바닥: 풀밭 가운데가 닳아서 흙이 드러난 모양
  const arena = canvasTex(1024, 1024, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, "#5f9039"); base.addColorStop(0.5, "#6b9c3f"); base.addColorStop(1, "#4d8235");
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const blob = (x, y, r, rgb, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    for (let i = 0; i < 70; i++) blob(R() * w, R() * h, 50 + R() * 130, R() < 0.5 ? "44,92,40" : "156,196,84", 0.2 + R() * 0.12);
    const cx = w * 0.5, cy = h * 0.47;
    for (let i = 0; i < 80; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()); blob(cx + Math.cos(a) * d * 310, cy + Math.sin(a) * d * 255, 70 + R() * 110, "188,150,98", 0.3); }
    for (let i = 0; i < 34; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()); blob(cx + Math.cos(a) * d * 230, cy + Math.sin(a) * d * 180, 30 + R() * 60, "226,194,138", 0.2); }
    for (let i = 0; i < 12; i++) blob(R() * w, R() * h, 40 + R() * 70, "170,136,90", 0.24);
    for (let i = 0; i < 9000; i++) {
      const x = R() * w, y = R() * h, inDirt = Math.hypot((x - cx) / 300, (y - cy) / 245) < 1;
      if (inDirt && R() > 0.22) continue;
      g.strokeStyle = R() < 0.5 ? "rgba(52,96,34,.5)" : "rgba(176,208,96,.34)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 4, y - 4 - R() * 6); g.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const x = R() * w, y = R() * h, rx = 5 + R() * 10, ry = 4 + R() * 7, rot = R() * 3;
      g.fillStyle = "rgba(96,88,78,.5)"; g.beginPath(); g.ellipse(x, y + 2, rx, ry, rot, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(196,188,170,.6)"; g.beginPath(); g.ellipse(x, y, rx * 0.85, ry * 0.8, rot, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "rgba(255,238,200,.1)"; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, 178, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(60,40,20,.08)"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 190, 0, Math.PI * 2); g.stroke();
    // 가장자리 돌 포장과 이끼
    const pave = (x, y, pw, ph) => {
      g.fillStyle = `rgb(${172 + R() * 26},${162 + R() * 24},${138 + R() * 22})`; g.fillRect(x + 2, y + 2, pw - 4, ph - 4);
      g.fillStyle = "rgba(255,250,235,.2)"; g.fillRect(x + 2, y + 2, pw - 4, 3);
      g.fillStyle = "rgba(60,50,38,.18)"; g.fillRect(x + 2, y + ph - 5, pw - 4, 3);
    };
    g.fillStyle = "#6f6552"; g.fillRect(0, 0, w, 44); g.fillRect(0, h - 44, w, 44); g.fillRect(0, 0, 44, h); g.fillRect(w - 44, 0, 44, h);
    for (let x = 0; x < w; x += 64) { pave(x, 0, 64, 44); pave(x, h - 44, 64, 44); }
    for (let y = 44; y < h - 44; y += 64) { const ph = Math.min(64, h - 44 - y); pave(0, y, 44, ph); pave(w - 44, y, 44, ph); }
    for (let i = 0; i < 70; i++) {
      const k = i % 4, u = R() * w, v = 30 + R() * 30;
      blob(k === 0 ? u : k === 1 ? u : k === 2 ? v : w - v, k === 0 ? v : k === 1 ? h - v : u, 12 + R() * 22, R() < 0.5 ? "70,118,48" : "104,150,62", 0.5);
    }
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, "rgba(22,40,30,.42)"); gr.addColorStop(1, "rgba(22,40,30,0)");
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    edge(0, 0, 120, 0, 0, 0, 120, h); edge(w, 0, w - 120, 0, w - 120, 0, 120, h);
    edge(0, 0, 0, 120, 0, 0, w, 120); edge(0, h, 0, h - 120, 0, h - 120, w, 120);
  });
  const af = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 16.8), new THREE.MeshStandardMaterial({ map: arena, roughness: 0.95 }));
  af.rotation.x = -Math.PI / 2; af.position.set(0, 0.16, 0.9); af.receiveShadow = true; scene.add(af);
  // 돌 재질
  const stoneTex = noiseTex(256, "#d3c7ab", [["rgba(110,98,78,.16)", 90, 4, 14], ["rgba(255,250,236,.22)", 70, 2, 9], ["rgba(70,62,50,.22)", 40, 1, 3]], 1);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 });
  const stoneDark = new THREE.MeshStandardMaterial({ map: stoneTex, color: lin(0xa99c8c), roughness: 0.95 });
  const stoneFlat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, flatShading: true });
  const mauveMat = new THREE.MeshStandardMaterial({ color: lin(0x8f7494), roughness: 0.95, flatShading: true });
  const greyMat = new THREE.MeshStandardMaterial({ color: lin(0xa9a394), roughness: 0.95, flatShading: true });
  // 바닥 받침(흙)
  const dirtTex = noiseTex(256, "#86735a", [["rgba(60,48,36,.25)", 120, 3, 10], ["rgba(190,165,120,.2)", 90, 2, 7]], 6);
  addBox(scene, 18.2, 0.16, 19.6, new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }), 0, 0.07, 0.7, false);
  // 뒤쪽 돌담
  addBox(scene, 17.6, 0.5, 1.0, stoneDark, 0, 0.25, -8.0);
  for (let i = 0; i < 9; i++) {
    const bw = 17.6 / 9, b = addBox(scene, bw - 0.1, 0.2 + R() * 0.06, 1.16, stoneMat, -8.8 + bw * (i + 0.5), 0.6, -8.0);
    b.rotation.y = (R() - 0.5) * 0.03;
  }
  // 양옆 돌담과 둥근 돌 자리
  const seatGeo = new THREE.TorusGeometry(0.55, 0.17, 6, 12, Math.PI);
  for (const s of [-1, 1]) {
    addBox(scene, 0.9, 0.34, 16.9, stoneDark, s * 8.05, 0.17, 0.95);
    for (let i = 0; i < 12; i++) {
      const bl = 16.9 / 12, b = addBox(scene, 0.98, 0.14 + R() * 0.05, bl - 0.09, stoneMat, s * 8.05, 0.4, -7.5 + bl * (i + 0.5));
      b.rotation.y = (R() - 0.5) * 0.03;
    }
    for (const z of [-5.6, -2.7, 0.2, 3.1, 6.0]) {
      const g = new THREE.Group(); g.position.set(s * 7.72, 0.5, z); g.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
      const arc = new THREE.Mesh(seatGeo, stoneFlat); arc.rotation.x = -Math.PI / 2; arc.castShadow = true; arc.receiveShadow = true; g.add(arc);
    }
  }
  // 앞쪽 낮은 돌 턱
  for (let i = 0; i < 11; i++) {
    const bw = 15.6 / 11, b = addBox(scene, bw - 0.08, 0.2 + R() * 0.05, 0.6, stoneMat, -7.8 + bw * (i + 0.5), 0.24, 9.65);
    b.rotation.y = (R() - 0.5) * 0.04;
  }
  // 모서리 기둥과 횃불
  TORCH.length = 0;
  const bowlMat = new THREE.MeshStandardMaterial({ color: lin(0x3a3028), roughness: 0.6, metalness: 0.4 });
  const pillar = (x, z, hgt) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    addBox(g, 1.35, 0.5, 1.35, stoneDark, 0, 0.25, 0);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, hgt, 4), stoneFlat);
    sh.rotation.y = Math.PI / 4; sh.position.y = 0.5 + hgt / 2; sh.castShadow = true; sh.receiveShadow = true; g.add(sh);
    addBox(g, 1.2, 0.2, 1.2, stoneMat, 0, 0.6 + hgt, 0);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.3, 10), bowlMat); bowl.position.y = 0.85 + hgt; bowl.castShadow = true; g.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), new THREE.MeshBasicMaterial({ color: lin(0xffa23a), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.y = 1.4 + hgt; g.add(flame);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8), new THREE.MeshBasicMaterial({ color: lin(0xfff0a0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    inner.position.y = 1.3 + hgt; g.add(inner);
    const light = new THREE.PointLight(0xffa040, 1.4, 9, 2); light.position.y = 1.6 + hgt; g.add(light);
    TORCH.push({ flame, inner, light });
    addTorchFx(g, 1.4 + hgt);
  };
  pillar(-8.4, -8.0, 1.7); pillar(8.4, -8.0, 1.7); pillar(-8.4, 9.6, 0.8); pillar(8.4, 9.6, 0.8);
  // 바위
  const stoneGeo = new THREE.DodecahedronGeometry(0.6, 0);
  const stone = (x, z, s, mat) => {
    const m = new THREE.Mesh(stoneGeo, mat); m.position.set(x, s * 0.16, z);
    m.scale.set(s * (0.8 + R() * 0.5), s * (0.55 + R() * 0.45), s * (0.8 + R() * 0.5));
    m.rotation.set(R(), R() * 3, R()); m.castShadow = true; m.receiveShadow = true; OUT.add(m);
  };
  for (const [x, z, s] of [[12, -11, 2.2], [14.6, -1, 1.8], [12.3, 10, 1.6], [17.5, 6.5, 2.4], [10.4, 2.4, 0.9], [18, -11, 2.6], [10.2, -5.5, 1.1], [15.5, -6.5, 1.3]]) stone(x, z, s, mauveMat);
  for (let z = -18; z <= 18; z += 2.4) {
    const side = R() < 0.5 ? -1 : 1;
    stone(riverX(z) + side * (RIVER_HW + 0.35 + R() * 0.3), z + R(), 0.5 + R() * 0.7, greyMat);
  }
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2, r = 17 + R() * 6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!inRiver(x, z, 1)) stone(x, z, 0.6 + R() * 1.2, x > 0 ? mauveMat : greyMat);
  }
  // 나무: 왼쪽·뒤쪽은 짙은 침엽수 숲, 오른쪽은 분홍 꽃나무
  const leafP1 = new THREE.MeshStandardMaterial({ color: lin(0x2f6140), roughness: 0.9, flatShading: true });
  const leafP2 = new THREE.MeshStandardMaterial({ color: lin(0x3d7446), roughness: 0.9, flatShading: true });
  const leafP3 = new THREE.MeshStandardMaterial({ color: lin(0x558f52), roughness: 0.9, flatShading: true });
  const leafG = new THREE.MeshStandardMaterial({ color: lin(0x5a8f38), roughness: 0.9, flatShading: true });
  const leafA = new THREE.MeshStandardMaterial({ color: lin(0xc07a3a), roughness: 0.9, flatShading: true });
  const leafK1 = new THREE.MeshStandardMaterial({ color: lin(0xdb8fb6), roughness: 0.9, flatShading: true });
  const leafK2 = new THREE.MeshStandardMaterial({ color: lin(0xb86c9e), roughness: 0.9, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: lin(0x4f382a), roughness: 0.9 });
  const pine = (x, z, s, mat) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * 3; OUT.add(g); FXD.sway.push(g);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.2, 7), bark); tr.position.y = 0.6; tr.castShadow = true; g.add(tr);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.35 - i * 0.28, 1.5, 8), i === 3 ? leafP3 : mat); c.rotation.y = i * 0.5; c.position.y = 1.4 + i * 0.78; c.castShadow = true; g.add(c); }
  };
  const round = (x, z, s, mat) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * 3; OUT.add(g); FXD.sway.push(g);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), bark); tr.position.y = 0.7; tr.castShadow = true; g.add(tr);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92 - i * 0.1, 1), mat); b.position.set((i - 1.5) * 0.42, 1.9 + (i % 2) * 0.45, ((i * 7) % 3 - 1) * 0.3); b.castShadow = true; g.add(b); }
  };
  const bush = (x, z, s, mat) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); OUT.add(g);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 - i * 0.08, 1), mat); b.position.set((i - 1) * 0.45, 0.3, (i % 2) * 0.25); b.castShadow = true; g.add(b); }
  };
  const LEFT = [[-15.5, -12], [-16, -7], [-15, -2.5], [-16.5, 2], [-15.2, 6.5], [-16.8, 10.5], [-18.5, -9.5], [-19, -4], [-19.5, 1], [-19, 6], [-18, 13], [-21.5, -1.5], [-15, 14.5], [-9.6, 12.5]];
  const BACK = [[-8.6, -11.4], [-5.6, -11.8], [-2.4, -12.8], [1.2, -11.6], [4.6, -12.9], [8, -11.7], [-7.5, -15.5], [-3, -16.8], [2, -15.8], [6.5, -16.4], [10.8, -15.2], [-1, -20.5], [4, -20], [-6, -20.2], [-12, -17.5]];
  const RIGHT = [[12.6, -7], [11.4, -2.2], [13.6, 1.6], [11.2, 5.6], [13.2, 8.4], [10.9, 12.2], [15.4, -9.5], [16.4, -3.6], [16.6, 2.8], [15.8, 10], [14, 13.6], [19.2, -6], [19.8, 0.4], [19.2, 5.4], [12.6, -14], [16, -13.4]];
  LEFT.forEach(([x, z], i) => { if (inRiver(x, z, 1.2)) return; const s = 1 + R() * 0.7; if (i % 4 === 3) round(x, z, s * 1.1, leafG); else pine(x, z, s * 1.15, i % 2 ? leafP1 : leafP2); });
  BACK.forEach(([x, z], i) => { if (inRiver(x, z, 1.2)) return; const s = 1 + R() * 0.7; if (i % 3 === 1) round(x, z, s * 1.1, i % 2 ? leafG : leafA); else pine(x, z, s * 1.2, i % 2 ? leafP1 : leafP2); });
  RIGHT.forEach(([x, z], i) => { const s = 0.95 + R() * 0.6; if (i % 5 === 4) pine(x, z, s * 1.1, leafP2); else round(x, z, s * 1.1, i % 3 === 2 ? leafG : i % 2 ? leafK1 : leafK2); });
  for (const [x, z, s] of [[-9.25, -9.6, 1], [9.6, -9.2, 1.1], [9.7, 4.2, 0.9], [9.8, -3.4, 1], [-9.3, 10.9, 0.9], [9.5, 10.8, 1], [-3.5, -9.8, 0.9], [4.2, -9.9, 1]]) {
    if (!inRiver(x, z, 0.6)) bush(x, z, s, x > 0 ? (z > 0 ? leafK2 : leafG) : leafP2);
  }
  // 멀리 떠 있는 작은 섬들
  for (const [x, y, z, s] of [[-34, -2, -30, 1.6], [30, 3, -36, 2.2], [-40, 6, 8, 1.3], [38, -4, 2, 1.5]]) {
    const isl = new THREE.Group(); isl.position.set(x, y, z); isl.scale.setScalar(s); OUT.add(isl);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 0.5, 4, 9), rockMat); t.position.y = -2; isl.add(t);
    const gtop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 9), leafG); isl.add(gtop);
    const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), x > 0 ? leafK1 : leafP1); tr.position.y = 1.4; isl.add(tr);
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
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.16 }));
      g.add(fill); g.add(line); scene.add(g);
      tiles[r][c] = { g, fill, line };
    }
  }
  // 대기석: 돌판
  const slabMat = new THREE.MeshStandardMaterial({ color: lin(0xc2b69c), roughness: 0.9 });
  addBox(scene, 13.8, 0.26, 1.5, slabMat, 0, 0.06, BENCH_Z, false).receiveShadow = true;
  const slotGeo = new THREE.PlaneGeometry(SLOT_W - 0.18, 1.2);
  for (let i = 0; i < BENCH; i++) {
    const p = new THREE.Mesh(slotGeo, new THREE.MeshStandardMaterial({ color: lin(0x968a74), roughness: 0.9 })); p.rotation.x = -Math.PI / 2;
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
      c = mix(vec3(l), c, 1.2);
      c = toSRGB(clamp(c, 0.0, 1.0));
      c = (c - 0.5) * 1.06 + 0.5;
      c *= vec3(1.025, 1.0, 0.965);
      float l2 = dot(c, vec3(0.299, 0.587, 0.114));
      c += (1.0 - l2) * (1.0 - l2) * vec3(0.02, 0.0, 0.045);
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
    if (inRiver(x, z, 0.6)) continue;
    const inArena = Math.abs(x) < 7.3 && z > -7.2 && z < 6.4;
    if (Math.abs(x) < 9.3 && z > -9.3 && z < 10.7 && !(inArena && Math.random() < 0.05)) continue;
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
    let x, z; do { const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 14; x = Math.cos(a) * r; z = Math.sin(a) * r; } while ((Math.abs(x) < 9.4 && z > -9.4 && z < 10.8) || inRiver(x, z, 0.6));
    m4.makeTranslation(x, 0.22 + Math.random() * 0.15, z); fl.setMatrixAt(i, m4); fl.setColorAt(i, col.setHex(rnd(FC)).convertSRGBToLinear());
  }
  OUT.add(fl);
  // 구름
  const cloudTex = softTex("rgba(255,255,255,.95)", "rgba(255,255,255,0)");
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: lin(i % 3 ? 0xffe3ea : 0xdcc6f2), transparent: true, opacity: 0.75, depthWrite: false }));
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
  const rimL = new THREE.DirectionalLight(0xe2b0ff, 0.7); rimL.position.set(8, 7, -14); scene.add(rimL);
}
function stepDecor(dt) {
  if (WATER) WATER.offset.y = (WATER.offset.y + dt * 0.14) % 1;
  stepExtras(dt);
  if (!pollen) return;
  const a = pollen.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let y = a.getY(i) + dt * 0.25; if (y > 6) y = 0;
    a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(clock3d * 0.6 + i) * dt * 0.15);
  }
  a.needsUpdate = true;
}
// ----- 분위기 더하기: 불티 · 꽃잎 · 물빛 · 깃발 · 구름 바다 · 빛줄기 -----
const FXD = { sway: [], embers: [], halos: [], flags: [], rays: [], petals: null, sparks: null, foam: null, sea: null, glow: null, t: 0, sparkT: 0 };
function addTorchFx(g, y) {
  if (!FXD.glow) FXD.glow = softTex("rgba(255,196,110,.85)", "rgba(255,140,40,0)");
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: FXD.glow, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = y; halo.scale.set(3, 3, 1); g.add(halo); FXD.halos.push(halo);
  const n = 12, pos = new Float32Array(n * 3), sp = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 1] = y + Math.random() * 2.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4; sp.push(0.6 + Math.random() * 0.9); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.13, map: FXD.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: lin(0xffc070) }));
  pts.frustumCulled = false; g.add(pts); FXD.embers.push({ a: geo.attributes.position, sp, y });
}
function buildExtras() {
  const R = Math.random;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  // 구름 바다: 섬 아래로 깔리는 구름
  const seaTex = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const x = R() * w, y = R() * h, r = 30 + R() * 70, a = 0.12 + R() * 0.22;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, `rgba(255,236,240,${a})`); gr.addColorStop(1, "rgba(255,236,240,0)");
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  });
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(5, 5);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(130, 40), new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, opacity: 0.85, depthWrite: false }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -16; OUT.add(sea); FXD.sea = seaTex;
  // 물가 거품
  const foamTex = canvasTex(32, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = R() * w, y = R() * h, rx = 4 + R() * 8, ry = 3 + R() * 9;
      g.fillStyle = `rgba(255,255,255,${0.45 + R() * 0.45})`;
      for (const dy of [-h, 0, h]) { g.beginPath(); g.ellipse(x, y + dy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
  foamTex.wrapT = THREE.RepeatWrapping; foamTex.repeat.set(1, 3);
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.7, depthWrite: false });
  for (const off of [-(RIVER_HW - 0.12), RIVER_HW - 0.12]) OUT.add(riverRibbon(0.17, 0.075, foamMat, off));
  FXD.foam = foamTex;
  // 물 위 반짝임
  const SN = 60, spos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { const z = (R() - 0.5) * 38; spos[i * 3] = riverX(z) + (R() - 0.5) * RIVER_HW * 1.6; spos[i * 3 + 1] = 0.11; spos[i * 3 + 2] = z; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.24, map: softTex("rgba(255,255,255,1)", "rgba(255,255,255,0)"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; OUT.add(sparks); FXD.sparks = sg.attributes.position;
  // 갈대
  const reedGeo = new THREE.ConeGeometry(0.04, 1, 4); reedGeo.translate(0, 0.5, 0);
  const RN = 140, reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), RN);
  for (let i = 0; i < RN; i++) {
    const z = (R() - 0.5) * 38, side = R() < 0.5 ? -1 : 1;
    e.set((R() - 0.5) * 0.3, R() * 3, (R() - 0.5) * 0.3); q.setFromEuler(e);
    m4.compose(v3.set(riverX(z) + side * (RIVER_HW + 0.15 + R() * 0.5), 0, z), q, sc.set(1, 0.6 + R() * 0.8, 1));
    reeds.setMatrixAt(i, m4); reeds.setColorAt(i, col.setHSL(0.2 + R() * 0.08, 0.45, 0.3 + R() * 0.16).convertSRGBToLinear());
  }
  OUT.add(reeds);
  // 연잎
  const padGeo = new THREE.CircleGeometry(0.24, 10, 0, Math.PI * 1.8); padGeo.rotateX(-Math.PI / 2);
  const PN = 16, pads2 = new THREE.InstancedMesh(padGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), PN);
  for (let i = 0; i < PN; i++) {
    const z = (R() - 0.5) * 30, s = 0.7 + R() * 0.7;
    e.set(0, R() * 6, 0); q.setFromEuler(e);
    m4.compose(v3.set(riverX(z) + (R() - 0.5) * RIVER_HW * 1.3, 0.09, z), q, sc.set(s, 1, s));
    pads2.setMatrixAt(i, m4); pads2.setColorAt(i, col.setHSL(0.3 + R() * 0.06, 0.5, 0.3 + R() * 0.1).convertSRGBToLinear());
  }
  pads2.receiveShadow = true; OUT.add(pads2);
  // 돌담 위 이끼
  const MN = 46, moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), MN);
  for (let i = 0; i < MN; i++) {
    const k = i % 3, s = 0.6 + R() * 0.9;
    if (k === 0) v3.set((R() - 0.5) * 17, 0.72, -8 + (R() - 0.5) * 0.9);
    else v3.set((k === 1 ? -1 : 1) * (8.05 + (R() - 0.5) * 0.7), 0.49, -7 + R() * 16);
    e.set(R(), R() * 3, R()); q.setFromEuler(e);
    m4.compose(v3, q, sc.set(s, s * 0.32, s));
    moss.setMatrixAt(i, m4); moss.setColorAt(i, col.setHSL(0.25 + R() * 0.08, 0.5, 0.24 + R() * 0.12).convertSRGBToLinear());
  }
  moss.receiveShadow = true; scene.add(moss);
  // 깃발
  for (const [x, hex] of [[-9.9, 0x2fa3b0], [9.9, 0xe0b64e]]) {
    const g = new THREE.Group(); g.position.set(x, 0, -8.4); OUT.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.8, 8), new THREE.MeshStandardMaterial({ color: lin(0x5a4030), roughness: 0.8 }));
    pole.position.y = 2.4; pole.castShadow = true; g.add(pole);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: lin(0xe8c25a), roughness: 0.3, metalness: 0.8 }));
    tip.position.y = 4.85; g.add(tip);
    const geo = new THREE.PlaneGeometry(1.9, 1.0, 10, 1); geo.translate(0.95, 0, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - (p.getX(i) / 1.9) * 0.8));
    const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(hex), roughness: 0.75, side: THREE.DoubleSide }));
    flag.position.y = 4.15; if (x < 0) flag.rotation.y = Math.PI; flag.castShadow = true; g.add(flag);
    FXD.flags.push({ p, ph: x });
  }
  // 흩날리는 꽃잎
  const petalTex = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(0.6);
    const gr = g.createRadialGradient(-6, 0, 0, 0, 0, 24); gr.addColorStop(0, "#fff2f7"); gr.addColorStop(1, "#f29cc4");
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 23, 12, 0, 0, Math.PI * 2); g.fill(); g.restore();
  });
  const TN = HQ ? 200 : 90, tpos = new Float32Array(TN * 3), tsp = [];
  for (let i = 0; i < TN; i++) { tpos[i * 3] = -9 + R() * 29; tpos[i * 3 + 1] = R() * 10; tpos[i * 3 + 2] = -15 + R() * 29; tsp.push(0.45 + R() * 0.5); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(tpos, 3));
  const petals = new THREE.Points(tg, new THREE.PointsMaterial({ size: 0.3, map: petalTex, transparent: true, alphaTest: 0.15, depthWrite: false }));
  petals.frustumCulled = false; OUT.add(petals); FXD.petals = { a: tg.attributes.position, sp: tsp };
  // 나무 사이로 비치는 빛줄기
  if (HQ) {
    const rayTex = canvasTex(64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(255,255,255,0)"); gx.addColorStop(0.5, "rgba(255,255,255,1)"); gx.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gx; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "destination-in";
      const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, "rgba(0,0,0,0)"); gy.addColorStop(0.35, "rgba(0,0,0,1)"); gy.addColorStop(0.8, "rgba(0,0,0,.7)"); gy.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gy; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
    });
    const d = new THREE.Vector3(-14, 18, 6).normalize(), cam = new THREE.Vector3(0, 0.69, 0.72);
    const zAxis = cam.clone().addScaledVector(d, -cam.dot(d)).normalize(), xAxis = new THREE.Vector3().crossVectors(d, zAxis);
    const rot = new THREE.Matrix4().makeBasis(xAxis, d, zAxis);
    for (const [x, z, wd, op] of [[-4.5, -3.5, 4.5, 0.06], [1.5, 0.5, 3.2, 0.045], [-8, 3, 5.5, 0.05]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, 28), new THREE.MeshBasicMaterial({ map: rayTex, color: lin(0xffe0b0), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.quaternion.setFromRotationMatrix(rot); m.position.set(x, 0, z).addScaledVector(d, 12); OUT.add(m); FXD.rays.push({ m, op });
    }
  }
}
function stepExtras(dt) {
  const t = (FXD.t += dt);
  if (FXD.sea) FXD.sea.offset.x = (FXD.sea.offset.x + dt * 0.003) % 1;
  if (FXD.foam) FXD.foam.offset.y = (FXD.foam.offset.y + dt * 0.42) % 1;
  FXD.sway.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.022; g.rotation.x = Math.sin(t * 0.7 + i) * 0.016; });
  FXD.halos.forEach((h, i) => { const s = 3 + Math.sin(t * 11 + i * 2) * 0.25 + Math.sin(t * 23 + i) * 0.15; h.scale.set(s, s, 1); });
  for (const em of FXD.embers) {
    const a = em.a;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * em.sp[i];
      if (y > em.y + 2.4) { y = em.y; a.setX(i, (Math.random() - 0.5) * 0.4); a.setZ(i, (Math.random() - 0.5) * 0.4); }
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 3 + i) * dt * 0.12);
    }
    a.needsUpdate = true;
  }
  for (const f of FXD.flags) {
    const p = f.p;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i); p.setZ(i, Math.sin(px * 3.2 - t * 5 + f.ph) * 0.14 * (px / 1.9)); }
    p.needsUpdate = true;
  }
  if (FXD.petals) {
    const a = FXD.petals.a, sp = FXD.petals.sp;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * sp[i], x = a.getX(i) - dt * (0.45 + Math.sin(t * 0.8 + i) * 0.35);
      if (y < 0.15 || x < -11) { y = 9 + Math.random() * 2; x = -6 + Math.random() * 26; a.setZ(i, -15 + Math.random() * 29); }
      a.setY(i, y); a.setX(i, x);
    }
    a.needsUpdate = true;
  }
  if (FXD.sparks && (FXD.sparkT -= dt) <= 0) {
    FXD.sparkT = 0.09; const a = FXD.sparks;
    for (let k = 0; k < 6; k++) { const i = Math.floor(Math.random() * a.count), z = (Math.random() - 0.5) * 38; a.setX(i, riverX(z) + (Math.random() - 0.5) * RIVER_HW * 1.6); a.setZ(i, z); }
    a.needsUpdate = true;
  }
  FXD.rays.forEach((r, i) => { r.m.material.opacity = r.op * (0.8 + Math.sin(t * 0.5 + i * 2) * 0.2); });
}
function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.76;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  if (THREE.RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  }
  scene.add(new THREE.HemisphereLight(0xc4c8ff, 0x58506e, scene.environment ? 0.38 : 0.8));
  const sun = new THREE.DirectionalLight(0xffdcae, 1.5);
  sun.position.set(-14, 18, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd0ff, 0.3); fill.position.set(10, 10, 16); scene.add(fill);
  buildWorld(); buildArena(); buildDecor();
  try { buildExtras(); } catch (e) { if (window.console) console.warn("extras", e); }
  setupPost();
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
      const xl = W / H > 1.2 ? 0.62 : 0.95; if (b.x0 >= -xl && b.x1 <= xl && b.y0 >= -0.58 && b.y1 <= 0.86) hi = mid; else lo = mid;
    }
    place(hi); const b = bounds();
    target.z -= ((b.y0 + b.y1) / 2 - 0.14) * 3;
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
// 정주환 "반장의 명령" 3D 연출: 금빛 기둥 · 퍼지는 충격파 · 왕관 고리 · 하늘에서 떨어지는 빛기둥
let OGEO = null;
function drawOrder(z, dt) {
  if (!OGEO) OGEO = { pil: new THREE.CylinderGeometry(1, 1, 12, 32, 1, true), beam: new THREE.CylinderGeometry(1, 1, 14, 16, 1, true), star: new THREE.OctahedronGeometry(0.28, 0) };
  const t = z.t, x = worldX(z.X), y = worldZ(z.Y);
  const g = useMesh(z, () => {
    const grp = new THREE.Group(), ud = grp.userData;
    ud.pil = new THREE.Mesh(OGEO.pil, additive("#ffd36b")); ud.pil.position.y = 6; grp.add(ud.pil);
    ud.waves = ["#ffe9a0", "#ffffff", "#ffb43a"].map((col) => { const m = new THREE.Mesh(GEO.ringFx, additive(col)); m.rotation.x = -Math.PI / 2; m.position.y = 0.3; grp.add(m); return m; });
    ud.crown = new THREE.Group(); ud.crown.position.y = 2.5; grp.add(ud.crown);
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(GEO.ringFx, additive(i ? "#fff6d0" : "#ffc94a")); r.rotation.x = -Math.PI / 2 + (i ? 0.25 : -0.25); r.scale.setScalar(0.55 + i * 0.15); ud.crown.add(r); }
    ud.stars = [];
    for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(OGEO.star, additive("#fff1b0")); ud.crown.add(st); ud.stars.push(st); }
    return grp;
  });
  const ud = g.userData, end = Math.max(0, Math.min(1, (z.dur - t) / 0.4));
  g.position.set(x, 0, y);
  const pk = Math.min(1, t / 0.12), pf = Math.max(0, 1 - t / 0.9);
  ud.pil.scale.set(0.2 + 0.55 * pk + Math.sin(t * 40) * 0.04, 1, 0.2 + 0.55 * pk);
  ud.pil.material.opacity = 0.65 * pk * pf;
  ud.waves.forEach((w, i) => {
    const rr = t * ORDER_WAVE * SQ3 * (1 - i * 0.12);
    w.scale.setScalar(Math.max(0.05, rr)); w.material.opacity = Math.max(0, 1 - t / 1.1) * (i === 1 ? 0.9 : 0.6);
  });
  ud.crown.rotation.y += dt * 3; ud.crown.position.y = 2.4 + Math.sin(t * 6) * 0.08;
  ud.crown.children.forEach((c) => c.material && (c.material.opacity = Math.min(1, t / 0.2) * end));
  ud.stars.forEach((st, i) => { const a = (i / 5) * Math.PI * 2; st.position.set(Math.cos(a) * 0.75, Math.sin(t * 8 + i) * 0.1, Math.sin(a) * 0.75); st.rotation.y += dt * 8; });
  for (const s of z.strikes || []) {
    const k = t - s.at; if (k < -0.22 || k > 0.45) continue;
    const m = useMesh(s, () => {
      const grp = new THREE.Group();
      const core = new THREE.Mesh(OGEO.beam, additive("#ffffff")); core.position.y = 7; grp.add(core);
      const glow = new THREE.Mesh(OGEO.beam, additive("#ffc94a")); glow.position.y = 7; grp.add(glow);
      const ring = new THREE.Mesh(GEO.ringFx, additive("#ffd36b")); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.26; grp.add(ring);
      grp.userData.p = [core, glow, ring]; return grp;
    });
    const [core, glow, ring] = m.userData.p, sx = s.hit ? s.X : s.o.X, sy = s.hit ? s.Y : s.o.Y;
    m.position.set(worldX(sx), 0, worldZ(sy));
    if (k < 0) { // 떨어지기 직전: 가는 조준선 + 바닥에 모이는 고리
      const q = 1 + k / 0.22;
      core.scale.set(0.03, 1, 0.03); core.material.opacity = 0.5 * q; glow.material.opacity = 0;
      ring.scale.setScalar(1.4 - q * 0.9); ring.material.opacity = 0.8 * q;
    } else { // 쾅! 굵은 빛기둥이 꽂혔다가 가늘어져요
      const q = Math.max(0, 1 - k / 0.45), w = 0.12 + 0.35 * Math.min(1, k / 0.05) * q;
      core.scale.set(w * 0.5, 1, w * 0.5); core.material.opacity = q;
      glow.scale.set(w * 1.4, 1, w * 1.4); glow.material.opacity = 0.55 * q;
      ring.scale.setScalar(0.6 + k * 4); ring.material.opacity = q;
    }
  }
}
function render3D(dt) {
  frameId++; clock3d += dt;
  const P = human();
  const holding = S.phase === "plan" && ((S.sel && S.sel.w !== "i" && getAt(P, S.sel)) || (drag && drag.moved && drag.obj && drag.loc.w !== "i"));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const sel = S.phase === "plan" && S.sel && S.sel.w === "b" && S.sel.r + 4 === r && S.sel.c === c;
    const t = tiles[r][c], on = sel || (holding && r >= 4);
    t.fill.material.opacity = sel ? 0.35 : on ? 0.12 : 0.04; t.fill.material.color.setHex(sel ? 0xffd75a : 0xffffff);
    t.line.material.opacity = on ? 0.65 : S.phase === "carousel" ? 0 : 0.16;
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
    for (const z of B.zones) {
      if (z.kind === "order") { drawOrder(z, dt); continue; }
      const g = useMesh(z, () => {
        const grp = new THREE.Group();
        const core = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: 0x000000 })); core.scale.setScalar(4.5); grp.add(core);
        const d1 = new THREE.Mesh(GEO.ringFx, additive("#b06bff")); d1.rotation.x = -Math.PI / 2; d1.scale.setScalar(1.7); grp.add(d1);
        const d2 = new THREE.Mesh(GEO.ringFx, additive("#ff9a5a")); d2.rotation.x = -Math.PI / 2 + 0.35; d2.scale.setScalar(1.15); grp.add(d2);
        const d3 = new THREE.Mesh(GEO.ringFx, additive("#7fc4ff")); d3.rotation.x = -Math.PI / 2 - 0.3; d3.scale.setScalar(2.4); grp.add(d3);
        grp.userData.d = [d1, d2, d3]; return grp;
      });
      const k = z.t / z.dur, grow = Math.min(1, z.t / 0.3) * (k > 0.85 ? Math.max(0.05, (1 - k) / 0.15) : 1);
      g.position.set(worldX(z.X), 1.0, worldZ(z.Y)); g.scale.setScalar(Math.max(0.01, grow) * (1 + Math.sin(clock3d * 12) * 0.04));
      g.userData.d[0].rotation.z += dt * 6; g.userData.d[1].rotation.z -= dt * 9; g.userData.d[2].rotation.z += dt * 3;
      g.userData.d[2].material.opacity = 0.5;
    }

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
  // 배치 인원 표시: 자리가 남았으면 경기장 위에 크게 보여줘요
  if (S.phase === "plan") {
    const P0 = human(), n0 = boardCount(P0);
    if (n0 !== P0.level) {
      const [wx, wy] = proj(0, 0.2, -2.6);
      ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = n0 > P0.level ? "#ff5a4a" : "#f6f2e4";
      ctx.font = font(u0 * 5.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n0 + " / " + P0.level, wx, wy); ctx.restore();
    }
  }
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
      // 체력바: 왼쪽에 별 등급 칸, 초록 체력(칸 나눔), 아래 파란 마나
      const f = it.f, bh = Math.max(5, u0 * 0.5), bw = u0 * 3.3, bx = sx - bw / 2 + bh * 0.7, by = sy + 3;
      const hasMana = f.mm !== Infinity, mh = hasMana ? Math.max(2, bh * 0.5) + 1 : 0;
      ctx.fillStyle = "rgba(6,12,16,.9)"; roundRect(bx - bh * 1.6, by - 2, bw + bh * 1.6 + 2, bh + mh + 4, 3); ctx.fill();
      const hg = ctx.createLinearGradient(0, by, 0, by + bh);
      if (it.enemy) { hg.addColorStop(0, "#ff9a88"); hg.addColorStop(1, "#d2382c"); } else { hg.addColorStop(0, "#86ff8e"); hg.addColorStop(1, "#1fb84a"); }
      ctx.fillStyle = hg; ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, f.hp / f.maxHp)), bh);
      ctx.fillStyle = "rgba(6,12,16,.7)"; for (let v = 300; v < f.maxHp; v += 300) ctx.fillRect(bx + (bw * v) / f.maxHp, by, 1, v % 1500 === 0 ? bh : bh * 0.6);
      if (f.shield > 0) { ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillRect(bx, by, Math.min(bw, bw * (f.shield / f.maxHp)), Math.max(2, bh * 0.35)); }
      if (hasMana) { ctx.fillStyle = "#4fb4ff"; ctx.fillRect(bx, by + bh + 1, bw * Math.min(1, f.mana / f.mm), mh - 1); }
      ctx.fillStyle = sp.mon ? "#ff9a88" : sp.star === 3 ? TOK["--c5"] : sp.star === 2 ? "#e4ebee" : "#d19a62";
      ctx.font = font(bh * 1.7); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(sp.mon ? "◆" : String(sp.star || 1), bx - bh * 0.85, by + (bh + mh) / 2 + 1);
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
  // 정주환 "반장의 명령": 금빛 테두리 · 차렷!/경례! 큰 글자 · 섬광
  const oz = S.battle && S.battle.zones.find((z) => z.kind === "order");
  if (oz) {
    const t = oz.t, [ox, oy] = proj(worldX(oz.X), 3.4, worldZ(oz.Y)), fade = Math.max(0, Math.min(1, (oz.dur - t) / 0.4));
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(255,200,80,0)"); vg.addColorStop(1, `rgba(255,190,60,${0.45 * fade})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const bar = u0 * 2.4 * Math.min(1, t / 0.2) * fade;
    ctx.fillStyle = "rgba(10,8,0,.55)"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    ctx.fillStyle = "#ffd36b"; ctx.fillRect(0, bar - 2, W, 2); ctx.fillRect(0, H - bar, W, 2);
    const big = (text, x, y, q, size, glow) => {
      const sc = 1 + (1 - q) * 1.2; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha = q * fade;
      ctx.font = font(u0 * size); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = glow; ctx.shadowBlur = 26; ctx.lineWidth = 8; ctx.strokeStyle = "#3a2600"; ctx.strokeText(text, 0, 0);
      const gr = ctx.createLinearGradient(0, -u0 * size / 2, 0, u0 * size / 2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, "#ffd36b"); gr.addColorStop(1, "#ff9a2a");
      ctx.fillStyle = gr; ctx.fillText(text, 0, 0); ctx.restore();
    };
    if (t < 0.95) big("차렷!", ox, oy, Math.min(1, t / 0.15) * Math.min(1, (0.95 - t) / 0.2), 3.6, "#ffb43a");
    else big("경례!", W / 2, H3 * 0.38, Math.min(1, (t - 0.95) / 0.15), 4.4, "#fff1b0");
    if (t > 0.95 && t < 1.35) { ctx.fillStyle = `rgba(255,248,220,${(1 - (t - 0.95) / 0.4) * 0.7})`; ctx.fillRect(0, 0, W, H); }
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
