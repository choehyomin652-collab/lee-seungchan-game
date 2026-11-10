// ============================================================
//  robot.js — 4인 합체로봇 (조하윤 · 박희찬 · 윤동욱 · 이보경)
//  ROBOT_MEMBERS: 합체에 필요한 친구들 / combineRobot: 합체 능력치 / stepCombo: 합체 연출 /
//  buildRobot: 로봇 3D 모양
// ============================================================
"use strict";
// 조하윤 + 박희찬 → 합체로봇
const ROBOT_NAME = "4인 합체로봇 (하윤·희찬·동욱·보경)";
const ROBOT_MEMBERS = ["조하윤", "박희찬", "윤동욱", "이보경"];
function combineRobot(f, team, visual) {
  const ms = ROBOT_MEMBERS.map((n) => f.find((x) => x.team === team && x.d >= 0 && DEFS[x.d].n === n));
  if (ms.some((m) => !m)) return;
  const b = ms[1], sum = (k) => ms.reduce((s2, m) => s2 + m[k], 0);
  const robot = Object.assign({}, b, {
    robot: 1, star: Math.max(...ms.map((m) => m.star)), items: [],
    maxHp: sum("maxHp") * 0.8, ad: sum("ad") * 0.45, as0: sum("as0") / 4,
    rg: 2, ar: Math.min(0.75, Math.max(...ms.map((m) => m.ar)) + 0.1), mm: 90, mana: 10,
    amp: Math.max(...ms.map((m) => m.amp)), crit: Math.max(...ms.map((m) => m.crit)), power: sum("power") * 0.45,
    shield: sum("shield"), tgt: null, dmg: 0, flash: 0, lunge: 0,
  });
  robot.hp = robot.maxHp;
  for (const m of ms) { m.alive = false; m.deadT = 0; m.merged = 1; }
  f.push(robot);
  if (visual) {
    const cx = worldX(robot.X), cz = worldZ(robot.Y);
    robot.combo = { t: 0, dur: 2.4, cx, cz, members: ms.map((m) => { const x = worldX(m.X), z = worldZ(m.Y); return { m, a0: Math.atan2(z - cz, x - cx), r0: Math.max(0.8, Math.hypot(x - cx, z - cz)) }; }), ring: 0 };
  }
}
const ROBOT_SK = { s: "합체 필살기: ¡Gol Final!", d: () => "축구공 5개를 연속으로 차서 대상과 주변 적에게 피해",
  run(B, u, P, t, al, fo) {
    const live = fo.filter((o) => o.alive); if (!live.length) return;
    for (let i = 0; i < 5; i++) {
      const o = i === 0 && t ? t : rnd(live);
      B.projs.push({ X: u.X, Y: u.Y, t: o, sp: 13 + i, col: "#ffffff", sz: 0.22, trail: 1, ball: 1, hit: () => {
        const dmg = u.ad * 0.7 + 80 * P;
        dealDamage(B, u, o, dmg, "skill");
        near(B.f.filter((x) => x.alive && x.team !== u.team), o, 1).forEach((x) => x !== o && dealDamage(B, u, x, dmg * 0.4, "skill"));
        addFx(B, o.X, o.Y, 1.1, "#7ff0ff", 0.4);
      } });
    }
    if (B.visual) { S.shake = 0.25; sfx("boom"); }
  } };
function stepCombo(B, u, dt) {
  const k = u.combo, t0 = k.t; k.t += dt;
  const cross = (x) => t0 < x && k.t >= x;
  if (cross(0.0001)) sfx("cast");
  if (k.t < 1.25 && Math.floor(k.t / 0.22) !== k.ring) { k.ring = Math.floor(k.t / 0.22); addFx(B, u.X, u.Y, 1.2 + k.ring * 0.15, k.ring % 2 ? "#7ff0ff" : "#ff7a5a", 0.5); }
  if (cross(1.25)) { S.shake = 0.5; sfx("boom"); }
  if (cross(2.0)) {
    S.shake = 0.6; sfx("merge");
    [2.2, 3.4, 4.6].forEach((r, i) => addFx(B, u.X, u.Y, r, ["#ffffff", "#7ff0ff", "#ffd36b"][i], 0.6 + i * 0.15));
    B.fx.push({ kind: "spark", X: u.X, Y: u.Y, col: "#ffe9a0", t: 0.6, t0: 0.6 }, { kind: "spark", X: u.X, Y: u.Y, col: "#7ff0ff", t: 0.7, t0: 0.7 });
  }
}

function buildRobot(enemy) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const ud = g.userData; ud.mats = []; ud.walk = 0; ud.move = 0; ud.restZ = [-0.15, 0.15];
  const mk = (hex, rough = 0.75, extra) => { const m = M(hex, rough, { metalness: 0, ...extra }); ud.mats.push(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const teal = mk(0x0f8a9c), red = mk(0xc23324), white = mk(0xdfe5e8, 0.4), dark = mk(0x23272b, 0.45), green = mk(0x2f8a5a), navy = mk(0x27324a);
  const glow = mk(0x7ff0ff, 0.2, { emissive: lin(0x3fd8ff), emissiveIntensity: 1.2 });
  const rm = new THREE.MeshBasicMaterial({ color: lin(enemy ? 0xff5a4a : 0x5ae0a0), transparent: true, opacity: 0.9 }); ud.mats.push(rm);
  const ring = new THREE.Mesh(GEO.teamRing, rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.21; ring.scale.setScalar(1.15); g.add(ring);
  ud.legs = [];
  for (const [sx, mat] of [[-1, green], [1, navy]]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.15, 0.62, 0); g.add(hip);
    box(0.18, 0.42, 0.22, mat, 0, -0.2, 0, hip); box(0.24, 0.1, 0.32, dark, 0, -0.44, 0.04, hip);
    ud.legs.push(hip);
  }
  const torso = new THREE.Group(); torso.position.y = 0.62; g.add(torso); ud.torso = torso;
  box(0.3, 0.5, 0.36, teal, -0.15, 0.27, 0, torso); box(0.3, 0.5, 0.36, red, 0.15, 0.27, 0, torso);
  box(0.62, 0.08, 0.4, white, 0, 0.05, 0, torso);
  const ball = new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ map: ballTex(), roughness: 0.4 })); ud.mats.push(ball.material);
  ball.position.set(0, 0.32, 0.17); ball.scale.setScalar(0.9); torso.add(ball);
  box(0.22, 0.14, 0.3, teal, -0.42, 0.48, 0, torso); box(0.22, 0.14, 0.3, red, 0.42, 0.48, 0, torso);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); ud.head = head;
  box(0.34, 0.26, 0.3, white, 0, 0, 0, head); box(0.28, 0.07, 0.02, glow, 0, 0.02, 0.16, head);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), dark); ant.position.set(-0.1, 0.22, 0); head.add(ant);
  const tip = new THREE.Mesh(GEO.pin, glow); tip.position.set(-0.1, 0.34, 0); head.add(tip);
  const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), teal); ear.rotation.z = Math.PI / 2; ear.position.set(-0.2, 0, 0); head.add(ear);
  ud.arms = [];
  for (const [sx, mat] of [[-1, teal], [1, red]]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.42, 0.44, 0); torso.add(sh);
    box(0.14, 0.4, 0.16, mat, 0, -0.2, 0, sh); box(0.16, 0.12, 0.18, dark, 0, -0.44, 0, sh);
    ud.arms.push(sh);
  }
  const shd = new THREE.Mesh(GEO.shield, mk(0xb8c4bc, 0.4)); shd.rotation.z = Math.PI / 2; shd.position.set(-0.12, -0.3, 0.05); shd.scale.setScalar(1.15); shd.castShadow = true; ud.arms[0].add(shd);
  return g;
}
