// ============================================================
//  robot.js — 4인 합체로봇 (조하윤 · 박희찬 · 윤동욱 · 이보경)
//  ROBOT_MEMBERS: 합체에 필요한 친구들 / combineRobot: 합체 능력치 / stepCombo: 합체 연출 /
//  buildRobot: 로봇 3D 모양
// ============================================================
"use strict";
// 조하윤 + 박희찬 → 합체로봇
const ROBOT_NAME = "4인 합체로봇 (하윤·희찬·동욱·보경)";
const ROBOT_MEMBERS = ["조하윤", "박희찬", "윤동욱", "이보경"];
const ROBOT_COLS = ["#3fd8ff", "#ff8a2a", "#f0ece0", "#5ae08a"]; // 합체 연출에 쓰는 네 친구 색 (하윤·희찬·동욱·보경)
function combineRobot(f, team, visual) {
  const ms = ROBOT_MEMBERS.map((n) => f.find((x) => x.team === team && x.d >= 0 && DEFS[x.d].n === n));
  if (ms.some((m) => !m)) return;
  const b = ms[1], sum = (k) => ms.reduce((s2, m) => s2 + m[k], 0);
  const robot = Object.assign({}, b, {
    robot: 1, star: Math.max(...ms.map((m) => m.star)), items: [],
    maxHp: sum("maxHp") * 0.9, ad: sum("ad") * 0.55, as0: sum("as0") / 4,
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
  if (k.t < 1.25 && Math.floor(k.t / 0.22) !== k.ring) { k.ring = Math.floor(k.t / 0.22); addFx(B, u.X, u.Y, 1.2 + k.ring * 0.15, ROBOT_COLS[k.ring % 4], 0.5); }
  if (cross(1.25)) { S.shake = 0.5; sfx("boom"); }
  if (cross(2.0)) {
    S.shake = 0.6; sfx("merge");
    [2.2, 3.0, 3.8, 4.6, 5.4].forEach((r, i) => addFx(B, u.X, u.Y, r, i ? ROBOT_COLS[i - 1] : "#ffffff", 0.6 + i * 0.12));
    B.fx.push({ kind: "spark", X: u.X, Y: u.Y, col: "#ffe9a0", t: 0.6, t0: 0.6 }, { kind: "spark", X: u.X, Y: u.Y, col: "#7ff0ff", t: 0.7, t0: 0.7 });
  }
}

// 네 친구 영웅 색을 합친 메카: 머리·가슴 = 박희찬(파랑·주황), 어깨·방패 = 이보경(초록·금), 다리 = 윤동욱(흰·검정), 팔 대포·추진기 = 조하윤(검정·청록)
function buildRobot(enemy) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const ud = g.userData; ud.mats = []; ud.walk = 0; ud.move = 0; ud.restZ = [-0.2, 0.2];
  const T = (hex) => { const m = toonMat(hex); ud.mats.push(m); return m; };
  const glowM = (hex, k = 1.6) => { const m = toonMat(hex, { emissive: lin(hex), emissiveIntensity: k }); ud.mats.push(m); return m; };
  const add = (geo, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent = g, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, rx, ry, rz);
  const cyl = (r1, r2, h, mat, x, y, z, parent = g, rx, ry, rz, sg = 16) => add(new THREE.CylinderGeometry(r1, r2, h, sg), mat, x, y, z, parent, rx, ry, rz);
  // 위가 넓고 아래가 좁은 판 (가슴·어깨·치마 갑옷)
  const wedge = (wt, wb, h, d, mat, x, y, z, parent, rx, ry, rz) => { const gm = new THREE.CylinderGeometry(wt / Math.SQRT2, wb / Math.SQRT2, h, 4, 1); gm.rotateY(Math.PI / 4); gm.scale(1, 1, d / Math.max(wt, wb)); return add(gm, mat, x, y, z, parent, rx, ry, rz); };
  const blue = T(0x2a4ab0), blueD = T(0x1c2f78), orange = T(0xff8a2a), white = T(0xf0ece0), whiteD = T(0xb9b4a8), black = T(0x1e1f26);
  const green = T(0x2a7a4a), gold = T(0xe8c25a), dark = T(0x16161e), steel = T(0x5a6270);
  const cyan = glowM(0x3fd8ff, 1.8), eye = glowM(enemy ? 0xff5a4a : 0x7ff0ff, 2.2);
  const rm = new THREE.MeshBasicMaterial({ color: lin(enemy ? 0xff5a4a : 0x5ae0a0), transparent: true, opacity: 0.9 }); ud.mats.push(rm);
  const ring = new THREE.Mesh(GEO.teamRing, rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.21; ring.scale.setScalar(1.15); g.add(ring);
  // ----- 다리 (윤동욱: 흰 장갑 + 검은 관절) -----
  ud.legs = []; ud.knees = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.15, 0.84, 0); g.add(hip);
    cyl(0.075, 0.075, 0.14, black, 0, 0, 0, hip, 0, 0, Math.PI / 2);
    wedge(0.2, 0.15, 0.3, 0.2, white, 0, -0.16, 0, hip);
    box(0.06, 0.2, 0.02, black, sx * 0.02, -0.16, 0.105, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.32, 0); hip.add(knee);
    add(new THREE.SphereGeometry(0.07, 12, 8), black, 0, 0, 0, knee);
    box(0.13, 0.12, 0.08, blue, 0, 0.01, 0.08, knee, -0.2);
    wedge(0.16, 0.21, 0.27, 0.22, white, 0, -0.16, 0, knee);
    box(0.17, 0.05, 0.23, whiteD, 0, -0.06, 0, knee);
    box(0.22, 0.08, 0.34, black, 0, -0.32, 0.04, knee);
    box(0.2, 0.05, 0.12, steel, 0, -0.3, 0.2, knee);
    ud.legs.push(hip); ud.knees.push(knee);
  }
  // ----- 몸통 (박희찬: 파란 가슴 + 주황 V 줄무늬, 가운데 축구공 코어) -----
  const torso = new THREE.Group(); torso.position.y = 0.84; g.add(torso); ud.torso = torso;
  box(0.36, 0.12, 0.26, black, 0, 0.02, 0, torso);
  for (const sx of [-1, 0, 1]) wedge(0.15, 0.11, 0.18, 0.05, sx ? green : gold, sx * 0.15, -0.08, 0.13, torso, -0.12, 0, sx * 0.12);
  for (const sx of [-1, 1]) wedge(0.12, 0.09, 0.2, 0.18, green, sx * 0.23, -0.06, 0, torso, 0, 0, sx * 0.25);
  box(0.3, 0.14, 0.22, dark, 0, 0.14, 0, torso);
  for (let i = 0; i < 3; i++) box(0.24, 0.025, 0.02, steel, 0, 0.09 + i * 0.045, 0.115, torso);
  wedge(0.72, 0.42, 0.36, 0.36, blue, 0, 0.39, 0, torso);
  wedge(0.5, 0.3, 0.3, 0.04, blueD, 0, 0.38, 0.17, torso, -0.08);
  for (const sx of [-1, 1]) box(0.05, 0.26, 0.02, orange, sx * 0.2, 0.42, 0.19, torso, -0.08, 0, sx * 0.4);
  box(0.62, 0.05, 0.3, white, 0, 0.58, 0, torso);
  const core = new THREE.Group(); core.position.set(0, 0.42, 0.19); torso.add(core); ud.core = core;
  add(new THREE.TorusGeometry(0.1, 0.022, 8, 24), gold, 0, 0, 0, core);
  add(new THREE.TorusGeometry(0.125, 0.012, 6, 24), cyan, 0, 0, -0.01, core);
  const ball = new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ map: ballTex(), roughness: 0.4, emissive: lin(0x3fd8ff), emissiveIntensity: 0.25 })); ud.mats.push(ball.material);
  ball.scale.setScalar(0.62); core.add(ball); ud.ball = ball;
  // ----- 등 (조하윤: 검은 추진기 + 청록 불꽃, 박희찬 주황 날개) -----
  box(0.4, 0.34, 0.16, dark, 0, 0.4, -0.24, torso);
  ud.flames = [];
  for (const sx of [-1, 1]) {
    cyl(0.07, 0.09, 0.26, steel, sx * 0.13, 0.26, -0.32, torso);
    cyl(0.05, 0.05, 0.02, cyan, sx * 0.13, 0.12, -0.32, torso);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 10), additive("#7ff0ff")); ud.mats.push(fl.material); fl.rotation.x = Math.PI; fl.position.set(sx * 0.13, -0.04, -0.32); torso.add(fl); ud.flames.push(fl);
    const wing = new THREE.Group(); wing.position.set(sx * 0.18, 0.55, -0.3); wing.rotation.set(-0.3, sx * 0.5, sx * -0.9); torso.add(wing);
    wedge(0.12, 0.04, 0.5, 0.03, orange, 0, 0.24, 0, wing);
    box(0.02, 0.4, 0.035, white, sx * -0.035, 0.24, 0.01, wing);
    box(0.03, 0.14, 0.04, cyan, 0, 0.44, 0.012, wing);
  }
  // ----- 머리 (박희찬 투구 + 이보경 금빛 뿔 + 조하윤 청록 눈) -----
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); ud.head = head;
  box(0.12, 0.08, 0.12, black, 0, -0.08, 0, head);
  box(0.26, 0.22, 0.26, white, 0, 0.06, 0, head);
  box(0.28, 0.08, 0.28, blue, 0, 0.17, -0.01, head);
  box(0.24, 0.07, 0.03, dark, 0, 0.075, 0.13, head);
  box(0.2, 0.04, 0.03, eye, 0, 0.075, 0.14, head);
  wedge(0.16, 0.09, 0.09, 0.035, steel, 0, -0.005, 0.135, head);
  for (const sx of [-1, 1]) box(0.012, 0.06, 0.01, black, sx * 0.03, -0.005, 0.155, head);
  box(0.05, 0.1, 0.05, orange, 0, 0.17, 0.13, head);
  for (const sx of [-1, 1]) {
    box(0.04, 0.24, 0.035, gold, sx * 0.1, 0.27, 0.12, head, 0, 0, sx * -0.85);
    box(0.06, 0.14, 0.12, blueD, sx * 0.15, 0.05, 0, head);
    cyl(0.012, 0.012, 0.16, steel, sx * 0.17, 0.2, -0.05, head, 0, 0, sx * -0.3, 6);
  }
  box(0.05, 0.05, 0.05, cyan, 0, 0.17, 0.155, head);
  // ----- 팔: 왼팔 = 이보경 방패, 오른팔 = 조하윤 대포 -----
  ud.arms = []; ud.elbows = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.42, 0.5, 0); torso.add(sh);
    add(new THREE.SphereGeometry(0.1, 14, 10), black, 0, 0, 0, sh);
    const pad = wedge(0.32, 0.22, 0.2, 0.3, green, sx * 0.04, 0.06, 0, sh, 0, 0, sx * -0.35);
    box(0.3, 0.035, 0.32, gold, sx * 0.07, 0.15, 0, sh, 0, 0, sx * -0.35);
    box(0.06, 0.06, 0.06, cyan, sx * 0.15, 0.06, 0.14, sh);
    box(0.13, 0.26, 0.14, dark, 0, -0.16, 0, sh);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    add(new THREE.SphereGeometry(0.075, 12, 8), black, 0, 0, 0, el);
    wedge(0.2, 0.16, 0.26, 0.2, sx < 0 ? green : dark, 0, -0.14, 0, el);
    box(0.16, 0.04, 0.2, sx < 0 ? gold : cyan, 0, -0.04, 0, el);
    box(0.13, 0.1, 0.13, black, 0, -0.31, 0, el);
    if (sx < 0) { // 큰 방패: 초록 판 + 금 테두리 + 가운데 보석
      const sg = new THREE.Group(); sg.position.set(-0.1, -0.2, 0.06); sg.rotation.set(0, -0.25, 0); el.add(sg);
      wedge(0.36, 0.22, 0.6, 0.05, green, 0, 0, 0, sg, 0, Math.PI / 2, 0);
      wedge(0.42, 0.26, 0.66, 0.035, gold, -0.012, 0, 0, sg, 0, Math.PI / 2, 0);
      add(new THREE.SphereGeometry(0.05, 12, 8), cyan, -0.04, 0.05, 0, sg);
      box(0.03, 0.4, 0.03, gold, -0.035, -0.02, 0, sg);
    } else { // 팔 대포: 검은 포신 두 개 + 청록 포구
      const cg = new THREE.Group(); cg.position.set(0, -0.32, 0.02); el.add(cg); ud.cannon = cg;
      box(0.18, 0.18, 0.18, steel, 0, 0, 0, cg);
      for (const ox of [-0.045, 0.045]) { cyl(0.035, 0.04, 0.3, dark, ox, -0.2, 0, cg); cyl(0.042, 0.042, 0.03, cyan, ox, -0.36, 0, cg); }
      box(0.04, 0.2, 0.06, cyan, 0.1, -0.08, 0, cg);
    }
    ud.arms.push(sh); ud.elbows.push(el);
  }
  bakeFigure(g, ud); // 친구들처럼 만화 음영 + 외곽선
  return g;
}
