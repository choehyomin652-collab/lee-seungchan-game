// ============================================================
//  weapons.js — 친구별 무기 (손에 드는 3D 모양 · 날아가는 공격 모양)
//  WEAPONS["이름"] = { n: 무기 이름, pr: { col, shape } (원거리 공격 모양), build(e) { ... 3D 모양 ... } }
//   · shape: "orb"(빛덩이) "dart"(다트) "ball"(축구공) "plane"(종이비행기) "chalk"(분필)
//   · build 안에서 e.put(모양, 재질, x, y, z, e.R) 로 오른손(e.R) 또는 왼손(e.L)에 붙여요
// ============================================================
"use strict";
// =============== 친구별 무기 ===============
const WG = {};
const wg = (k, f) => WG[k] || (WG[k] = f());
const cylG = (r1, r2, h, sg = 10) => new THREE.CylinderGeometry(r1, r2, h, sg);
const sphG = (r) => new THREE.SphereGeometry(r, 14, 10);
function ballTex() {
  return textTex("ball", 256, 128, (gg, w, hh) => { gg.fillStyle = "#fafafa"; gg.fillRect(0, 0, w, hh); gg.fillStyle = "#1a1a1a"; for (let i = 0; i < 10; i++) { gg.beginPath(); const x = (i % 5) * 52 + (i < 5 ? 10 : 36), y = i < 5 ? 34 : 94; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; gg.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } gg.fill(); } });
}
function bballTex() {
  return textTex("bball", 256, 128, (g, w, h) => { g.fillStyle = "#e0702a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#2a160a"; g.lineWidth = 5; for (const x of [0, w / 2, w]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); for (const cx of [w * 0.25, w * 0.75]) { g.beginPath(); g.arc(cx, h / 2, h * 0.42, 0, Math.PI * 2); g.stroke(); } });
}
// 막대: 아래쪽 끝이 손, th만큼 앞으로 기울어요. 윗끝 좌표를 돌려줘요
function wStick(env, mat, len, r, x, y, z, th, parent) {
  const m = env.put(wg("cyl" + len + "_" + r, () => cylG(r, r, len)), mat, x, y, z, parent || env.R); m.rotation.x = th;
  return [x, y + Math.cos(th) * len / 2, z + Math.sin(th) * len / 2];
}
const WEAPONS = {
  "이승찬": { n: "하트 지팡이", pr: { col: "#ff7aa8", shape: "orb" }, build(e) {
    const pink = e.mk(0xff6f9f, 0.4, { emissive: lin(0x5a1a30) });
    const [tx, ty, tz] = wStick(e, e.mk(0xf2e6d0, 0.6), 0.62, 0.022, 0, -0.42, 0.1, 0.5);
    for (const sx of [-1, 1]) e.put(wg("hs", () => sphG(0.08)), pink, tx + sx * 0.055, ty + 0.06, tz, e.R);
    const c = e.put(wg("hc", () => new THREE.ConeGeometry(0.13, 0.18, 12)), pink, tx, ty - 0.01, tz, e.R); c.rotation.x = Math.PI;
  } },
  "이현": { n: "이어달리기 바통", build(e) {
    const b = e.put(wg("baton", () => cylG(0.04, 0.04, 0.46)), e.mk(0xffd23a, 0.4), 0, -0.43, 0.12, e.R); b.rotation.x = Math.PI / 2;
    const red = e.mk(0xd0302a, 0.5);
    for (const y of [-0.16, 0.16]) e.put(wg("ring", () => cylG(0.046, 0.046, 0.07)), red, 0, y, 0, b);
  } },
  "최효민": { n: "배드민턴 라켓", pr: { col: "#ffffff", shape: "orb" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x2b2b2b, 0.5), 0.34, 0.016, 0, -0.43, 0.1, 0.55);
    const hy = ty + Math.cos(0.55) * 0.1, hz = tz + Math.sin(0.55) * 0.1;
    const t = e.put(wg("rt", () => new THREE.TorusGeometry(0.075, 0.013, 8, 22)), e.mk(0xe04040, 0.4), tx, hy, hz, e.R); t.rotation.x = 0.55; t.scale.y = 1.35;
    const d = e.put(wg("rd", () => new THREE.CircleGeometry(0.072, 18)), e.mk(0xf2f2f2, 0.6, { side: THREE.DoubleSide }), tx, hy, hz, e.R); d.rotation.x = 0.55; d.scale.y = 1.35;
  } },
  "전하율": { n: "다트", pr: { col: "#e8402e", shape: "dart" }, build(e) {
    const b = e.put(wg("dartb", () => cylG(0.032, 0.032, 0.36)), e.mk(0x2b2b2b, 0.4), 0, -0.43, 0.14, e.R); b.rotation.x = Math.PI / 2;
    e.put(wg("dartt", () => new THREE.ConeGeometry(0.032, 0.16, 8)), e.mk(0xc9d1cc, 0.3, { metalness: 0.6 }), 0, 0.26, 0, b);
    const red = e.mk(0xe8402e, 0.5);
    e.put(wg("fl1", () => new THREE.BoxGeometry(0.18, 0.1, 0.014)), red, 0, -0.16, 0, b); e.put(wg("fl2", () => new THREE.BoxGeometry(0.014, 0.1, 0.18)), red, 0, -0.16, 0, b);
  } },
  "이준희": { n: "농구공", build(e) {
    const m = new THREE.MeshStandardMaterial({ map: bballTex(), roughness: 0.7 }); e.ud.mats.push(m);
    e.put(GEO.ball, m, 0, -0.5, 0.1, e.R).scale.setScalar(1.2);
  } },
  "김현우": { n: "삼각자", pr: { col: "#7fc4ff", shape: "orb" }, build(e) {
    const geo = wg("tri", () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.42, 0); sh.lineTo(0, 0.42); sh.lineTo(0, 0); const h = new THREE.Path(); h.moveTo(0.07, 0.07); h.lineTo(0.22, 0.07); h.lineTo(0.07, 0.22); h.lineTo(0.07, 0.07); sh.holes.push(h); const g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false }); g2.translate(-0.14, -0.14, -0.008); return g2; });
    const m = e.put(geo, e.mk(0x7fc4ff, 0.3), 0, -0.45, 0.1, e.L); m.rotation.set(0.2, 1.0, 0.3);
  } },
  "이보경": { n: "방패", build(e) {
    const sd = e.put(GEO.shield, e.mk(0xb8c4bc, 0.35, { metalness: 0.7 }), -0.1, -0.3, 0.06, e.L); sd.rotation.z = Math.PI / 2;
    e.put(GEO.boss, e.mk(COST_HEX[e.def.c], 0.4, { metalness: 0.5 }), -0.14, -0.3, 0.06, e.L);
  } },
  "윤동욱": { n: "부채", build(e) {
    const f = e.put(wg("fan", () => new THREE.CircleGeometry(0.22, 18, 0, Math.PI)), e.mk(0xf3e2b8, 0.7, { side: THREE.DoubleSide }), 0, -0.44, 0.12, e.R); f.rotation.set(0.3, 0.9, 0);
    const r = e.put(wg("fanr", () => new THREE.TorusGeometry(0.22, 0.012, 6, 18, Math.PI)), e.mk(0xc23324, 0.5), 0, -0.44, 0.12, e.R); r.rotation.set(0.3, 0.9, 0);
    e.put(wg("fanh", () => cylG(0.016, 0.016, 0.1)), e.mk(0x6b4a30, 0.6), 0, -0.45, 0.1, e.R);
  } },
  "김민기": { n: "거대 연필", pr: { col: "#f5d76e", shape: "chalk" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0xf5c518, 0.5), 0.62, 0.032, 0, -0.43, 0.1, 0.45);
    const dy = Math.cos(0.45), dz = Math.sin(0.45);
    const c = e.put(wg("pt", () => new THREE.ConeGeometry(0.032, 0.1, 8)), e.mk(0x5a3e2a, 0.7), tx, ty + dy * 0.05, tz + dz * 0.05, e.R); c.rotation.x = 0.45;
    e.put(wg("pe", () => sphG(0.036)), e.mk(0xff8aa8, 0.6), 0, -0.43 - dy * 0.31, 0.1 - dz * 0.31, e.R);
  } },
  "임시온": { n: "골키퍼 장갑", build(e) {
    const gl = e.mk(0x2fc27a, 0.6);
    for (const arm of [e.L, e.R]) { const m = e.put(wg("glove", () => sphG(0.095)), gl, 0, -0.43, 0.02, arm); m.scale.set(1.1, 1, 1.15); }
  } },
  "김예균": { n: "소환 지팡이", build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x2a6a68, 0.5), 0.8, 0.022, 0, -0.43, 0.1, 0.4);
    const dy = Math.cos(0.4), dz = Math.sin(0.4);
    e.put(wg("orb", () => sphG(0.085)), e.mk(0x7ff0e0, 0.2, { emissive: lin(0x2fd0c0), emissiveIntensity: 1.1 }), tx, ty + dy * 0.06, tz + dz * 0.06, e.R);
    const t = e.put(wg("orbr", () => new THREE.TorusGeometry(0.11, 0.012, 6, 20)), e.mk(0xd8b45a, 0.3, { metalness: 0.8 }), tx, ty + dy * 0.06, tz + dz * 0.06, e.R); t.rotation.x = Math.PI / 2 + 0.4;
  } },
  "박현호": { n: "마이크", pr: { col: "#ffd36b", shape: "orb" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x2b2f33, 0.4), 0.3, 0.028, 0, -0.43, 0.1, 0.9);
    e.put(wg("mich", () => sphG(0.075)), e.mk(0xc9d1cc, 0.3, { metalness: 0.6 }), tx, ty + Math.cos(0.9) * 0.06, tz + Math.sin(0.9) * 0.06, e.R);
  } },
  "조하윤": { n: "게임 컨트롤러", build(e) {
    const g = new THREE.Group(); g.position.set(0, -0.46, 0.14); g.rotation.x = 0.5; g.scale.setScalar(1.7); e.R.add(g);
    const dk = e.mk(0x2c3036, 0.5), black = e.mk(0x111111, 0.4);
    e.put(wg("pad", () => new THREE.BoxGeometry(0.26, 0.06, 0.13)), dk, 0, 0, 0, g);
    for (const x of [-0.07, 0.04]) e.put(wg("stk", () => cylG(0.02, 0.02, 0.025)), black, x, 0.04, x < 0 ? 0.015 : -0.02, g);
    [[0.085, 0.0, 0xe8402e], [0.1, 0.03, 0x3ca86a], [0.07, 0.03, 0x3c78d0], [0.085, 0.045, 0xf6c431]].forEach(([x, z, c]) => e.put(wg("btn", () => sphG(0.014)), e.mk(c, 0.4), x, 0.032, z - 0.02, g));
    e.put(wg("led", () => new THREE.BoxGeometry(0.1, 0.01, 0.01)), e.mk(0x7ff0ff, 0.2, { emissive: lin(0x3fd8ff), emissiveIntensity: 1.2 }), 0, 0.032, 0.06, g);
  } },
  "박희찬": { n: "축구공", pr: { shape: "ball" }, build(e) {
    const m = new THREE.MeshStandardMaterial({ map: ballTex(), roughness: 0.5 }); e.ud.mats.push(m);
    e.ud.ball = e.put(GEO.ball, m, 0.02, -0.5, 0.12, e.R); e.ud.ball.scale.setScalar(1.1);
  } },
  "진성욱": { n: "아령", build(e) {
    const dk = e.mk(0x3a3f44, 0.4, { metalness: 0.5 });
    const bar = e.put(wg("db", () => cylG(0.018, 0.018, 0.34)), dk, 0, -0.45, 0.1, e.R); bar.rotation.z = Math.PI / 2;
    for (const y of [-0.15, 0.15]) e.put(wg("dp", () => cylG(0.085, 0.085, 0.045, 16)), dk, 0, y, 0, bar);
  } },
  "박준서": { n: "컴퍼스", pr: { col: "#cfd8dc", shape: "orb" }, build(e) {
    const grp = new THREE.Group(); grp.position.set(0, -0.4, 0.1); grp.rotation.x = 0.3; e.R.add(grp);
    const metal = e.mk(0xc9d1cc, 0.3, { metalness: 0.7 });
    for (const s2 of [-1, 1]) {
      const l = e.put(wg("cl", () => cylG(0.02, 0.02, 0.44)), metal, s2 * 0.045, 0.2, 0, grp); l.rotation.z = s2 * 0.2;
      e.put(wg("ct", () => new THREE.ConeGeometry(0.02, 0.07, 6)), s2 < 0 ? e.mk(0x333333, 0.4) : metal, s2 * 0.09, -0.03, 0, grp).rotation.x = Math.PI;
    }
    e.put(wg("ch", () => sphG(0.045)), e.mk(0xd8b45a, 0.3, { metalness: 0.8 }), 0, 0.43, 0, grp);
  } },
  "손태민": { n: "만점 졸업장", pr: { col: "#ffffff", shape: "plane" }, build(e) {
    const sc = e.put(wg("scr", () => cylG(0.05, 0.05, 0.32, 14)), e.mk(0xf4ecd0, 0.7), 0, -0.46, 0.1, e.R); sc.rotation.z = 1.2;
    const rb = e.put(wg("scrr", () => new THREE.TorusGeometry(0.053, 0.012, 6, 16)), e.mk(0xc8323a, 0.5), 0, 0, 0, sc); rb.rotation.x = Math.PI / 2;
  } },
  "정주환": { n: "교사용 지시봉", pr: { col: "#ff5a4a", shape: "orb" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0xc0c8cc, 0.3, { metalness: 0.7 }), 0.8, 0.02, 0, -0.45, 0.1, 0.6);
    e.put(wg("ptip", () => sphG(0.04)), e.mk(0xd0302a, 0.4), tx, ty, tz, e.R);
    wStick(e, e.mk(0x1c1c1c, 0.5), 0.16, 0.02, 0, -0.45 - Math.cos(0.6) * 0.27, 0.1 - Math.sin(0.6) * 0.27, 0.6);
  } },
};
function projSpecial(p) {
  if (p.ball || p.shape === "ball") return new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ map: ballTex(), color: 0xffffff, roughness: 0.5 }));
  if (p.shape === "orb") { const c = lin(p.col || "#ffffff"), m = new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.4 })); m.scale.setScalar(0.45); return m; }
  if (p.shape === "dart") { const m = new THREE.Mesh(GEO.spike, new THREE.MeshStandardMaterial({ color: lin(0xe8402e), roughness: 0.5 })); m.scale.set(1.2, 1.7, 1.2); return m; }
  return null;
}
