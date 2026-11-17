// ============================================================
//  weapons.js — 친구별 무기 (손에 드는 3D 모양 · 날아가는 공격 모양)
//  WEAPONS["이름"] = { n: 무기 이름, pr: { col, shape } (원거리 공격 모양), build(e) { ... 3D 모양 ... } }
//   · shape: "orb"(빛덩이) "dart"(다트) "ball"(축구공) "plane"(종이비행기) "chalk"(분필)
//   · anim: 공격할 때 동작 (아래 ATK_ANIM 표의 이름). 없으면 근접은 "swing", 원거리는 "cast"
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
// ---------- 무기별 공격 동작 ----------
// p: 0(시작)→1(끝), k: 가운데서 가장 큰 값(0→1→0). 돌려주는 값은 팔·몸의 각도예요.
//   la/ra: 왼팔/오른팔 앞뒤 (음수 = 앞·위로), lz/rz: 팔 옆으로 벌리기, lean: 몸 숙이기, twist: 몸 비틀기
//   hop: 폴짝 뛰기, kick: 오른 다리 차기, spin: 몸통 한 바퀴, head: 고개 젖히기
const ATK_T = 0.42; // 보이는 공격 동작 길이(초). 전투 결과에는 영향 없어요
// 뒤로 젖혔다가(a) 앞으로 휘두르는(b) 곡선
const windup = (p, a, b, at = 0.38) => (p < at ? a * (p / at) : a + (b - a) * ((p - at) / (1 - at)));
const ATK_ANIM = {
  swing:    (p, k) => ({ ra: -1.9 * k, lean: 0.32 * k, twist: -0.45 * k }),
  cast:     (p, k) => ({ ra: -1.3 * k, lean: 0.18 * k, twist: -0.3 * k }),
  wave:     (p, k) => ({ ra: -2.4 * k, rz: 0.2 + Math.sin(p * Math.PI * 4) * 0.5 * k, lean: -0.08 * k }),            // 지팡이 흔들기
  thrust:   (p, k) => ({ ra: -1.55 * k, rz: -0.15 * k, la: 0.6 * k, lean: 0.4 * k, twist: -0.55 * k }),              // 바통 찌르기
  smash:    (p, k) => ({ ra: windup(p, -3.0, -0.3), rz: 0.25 * k, lean: 0.3 * p * k * 2, hop: 0.16 * k, twist: -0.3 * k }), // 라켓 스매시
  throw:    (p, k) => ({ ra: windup(p, 0.9, -1.7, 0.42), la: -0.5 * k, lean: 0.25 * k, twist: windup(p, 0.45, -0.45, 0.42) }), // 다트 던지기
  dunk:     (p, k) => ({ la: windup(p, -3.0, -0.6), ra: windup(p, -3.0, -0.6), lz: -0.2, rz: 0.2, hop: 0.5 * k, lean: 0.45 * p }), // 덩크
  slashL:   (p, k) => ({ la: -1.4 * k, lz: -1.2 * k, twist: windup(p, -0.5, 0.7), lean: 0.15 * k }),                  // 삼각자 긋기 (왼손)
  bash:     (p, k) => ({ la: -1.5 * k, lz: 0.35 * k, ra: 0.5 * k, lean: 0.45 * k, twist: 0.55 * k }),                 // 방패 밀치기 (왼손)
  fan:      (p, k) => ({ ra: -1.3 * k, rz: 1.1 * k, la: -0.4 * k, lz: -0.9 * k, spin: p * Math.PI * 2 }),             // 부채 돌려치기
  stab:     (p, k) => ({ ra: -1.6 * k + Math.sin(p * 34) * 0.16 * k, rz: -0.1 * k, lean: 0.2 * k }),                  // 연필 콕콕
  punch:    (p, k) => ({ la: -1.7 * Math.sin(Math.min(1, p * 2) * Math.PI), ra: -1.7 * Math.sin(Math.max(0, p * 2 - 1) * Math.PI), lz: 0.1, rz: -0.1, twist: (p < 0.5 ? 0.4 : -0.4) * k, lean: 0.2 * k }), // 원투 펀치
  staff:    (p, k) => ({ ra: windup(p, -2.9, -0.5), la: windup(p, -2.4, -0.5), lz: 0.3 * k, lean: 0.35 * p * k * 2 }), // 지팡이 내리치기
  shout:    (p, k) => ({ ra: -2.15 * k, rz: -0.55 * k, la: 0.5 * k, lz: -0.5 * k, lean: -0.25 * k, head: -0.3 * k }),  // 마이크 대고 외치기
  mash:     (p, k) => ({ la: -1.15 * k + Math.sin(p * 55) * 0.07, ra: -1.15 * k - Math.sin(p * 55) * 0.07, lz: 0.4 * k, rz: -0.4 * k, lean: 0.12 * k, head: 0.2 * k }), // 버튼 연타
  kick:     (p, k) => ({ kick: windup(p, 0.8, -1.7, 0.35), la: -0.7 * k, ra: 0.7 * k, lz: -0.5 * k, rz: 0.5 * k, lean: -0.22 * k }), // 슛
  uppercut: (p, k) => ({ ra: windup(p, 0.7, -2.8, 0.3), la: 0.4 * k, hop: 0.22 * k, lean: -0.15 * k, twist: -0.45 * k }), // 아령 올려치기
  circle:   (p, k) => ({ ra: -1.5 * k + Math.sin(p * Math.PI * 4) * 0.5 * k, rz: Math.cos(p * Math.PI * 4) * 0.5 * k, lean: 0.1 * k }), // 컴퍼스로 원 그리기
  toss:     (p, k) => ({ ra: windup(p, 0.6, -1.6, 0.4), rz: 0.2 * k, lean: 0.12 * k }),                               // 살짝 던지기
  zeus:     (p, k) => ({ ra: windup(p, -3.0, -1.4, 0.45), la: 0.3 * k, lz: -0.7 * k, hop: 0.12 * k, lean: 0.2 * p, head: -0.2 * k }), // 번개 내리꽂기
};
// ---------- 친구별 스킬 동작 ----------
// 스킬을 쓰면 t초 동안 이 동작을 해요 (battle.js 의 cast 가 skillT 를 켜요. 보이는 것만, 전투 결과엔 영향 없음)
// f(p, s): p = 0→1 진행도, s = 지난 초. 돌려주는 값은 ATK_ANIM 과 같고, 더해서
//   crouch: 무릎 굽혀 낮추기(0~1), le/re: 팔꿈치 굽히기(음수 = 더 굽힘)
const sw2 = (p, a, b) => a + (b - a) * (p * p * (3 - 2 * p)); // 부드럽게 a → b
const pulse = (p, a, b) => Math.max(0, Math.sin(Math.min(1, Math.max(0, (p - a) / (b - a))) * Math.PI)); // a~b 구간에서 0→1→0
const SKILL_POSE = {
  "이승찬": { t: 0.9, f: (p) => ({ la: -2.7 + Math.sin(p * 12) * 0.3, ra: -2.7 - Math.sin(p * 12) * 0.3, lz: -0.5, rz: 0.5, hop: Math.abs(Math.sin(p * Math.PI * 2)) * 0.25, head: -0.25, lean: -0.1 }) }, // 두 팔 흔들며 응원 점프
  "이현": { t: 0.7, f: (p) => ({ la: Math.sin(p * 19) * 1.3, ra: -Math.sin(p * 19) * 1.3, le: -1.2, re: -1.2, lean: 0.6, crouch: 0.25, hop: Math.abs(Math.sin(p * 19)) * 0.08 }) }, // 몸 숙이고 전력 질주 (팔 크게 흔들기)
  "최효민": { t: 0.8, f: (p) => ({ ra: windup(p, -3.0, -0.2, 0.55), rz: 0.3, la: -1.0, lean: sw2(p, -0.2, 0.4), twist: windup(p, 0.5, -0.5, 0.55), hop: pulse(p, 0.2, 0.85) * 0.55 }) }, // 높이 뛰어 스매시
  "전하율": { t: 0.8, f: (p) => ({ ra: p < 0.7 ? -1.55 : windup((p - 0.7) / 0.3, -1.55, -1.9, 0.3), re: 0, la: -1.2, lz: 0.35, le: -0.8, crouch: 0.3, head: 0.12, twist: -0.2 }) }, // 한쪽 무릎 굽혀 겨눴다가 휙
  "이수아": { t: 0.9, f: (p) => p < 0.5 ? ({ la: -2.6, lz: -0.3 + Math.sin(p * 30) * 0.25, le: -0.5, ra: -0.3, head: -0.1, twist: 0.2 }) : ({ la: -2.7, ra: -2.7, lz: 0.2, rz: -0.2, le: -1.5, re: -1.5, head: -0.2, hop: pulse(p, 0.55, 1) * 0.12 }) }, // 손 흔들어 인사 → 머리 위 하트
  "이준희": { t: 0.9, f: (p) => ({ la: windup(p, -3.0, -0.5, 0.5), ra: windup(p, -3.0, -0.5, 0.5), lz: -0.25, rz: 0.25, hop: pulse(p, 0.1, 0.8) * 0.9, lean: sw2(p, -0.2, 0.5), crouch: pulse(p, 0.75, 1) * 0.5 }) }, // 덩크: 높이 뛰어 내리꽂기
  "김현우": { t: 0.8, f: (p) => { const c = p < 0.5 ? 0 : sw2((p - 0.5) / 0.15 > 1 ? 1 : (p - 0.5) / 0.15, 0, 1); return { la: -1.5, ra: -1.5, lz: -1.3 * (1 - c), rz: 1.3 * (1 - c), le: -0.3 - c, re: -0.3 - c, lean: sw2(p, -0.15, 0.55), head: p < 0.5 ? -0.4 : 0.2 }; } }, // 팔 쩍 벌렸다가 꽉 물기
  "이보경": { t: 0.8, f: (p) => ({ crouch: pulse(p, 0, 0.95) * 0.7, kick: -1.3 * pulse(p, 0.1, 0.9), la: 0.7, ra: 0.5, lz: -0.6, lean: -0.35 * pulse(p, 0, 1) }) }, // 슬라이딩 태클
  "윤동욱": { t: 1.0, f: (p) => { const a = p * Math.PI * 2; return { la: -1.3 + Math.sin(a) * 0.6, ra: -1.3 - Math.sin(a) * 0.6, lz: -0.5 + Math.cos(a) * 0.35, rz: 0.5 + Math.cos(a) * 0.35, le: -0.7, re: -0.7, twist: Math.sin(a) * 0.5, crouch: 0.35 }; } }, // 태극권: 천천히 원 그리기
  "은혜린": { t: 0.9, f: (p) => ({ spin: p * Math.PI * 2, la: -2.5 + Math.sin(p * 20) * 0.3, ra: -2.5 - Math.sin(p * 20) * 0.3, lz: -0.6, rz: 0.6, hop: Math.abs(Math.sin(p * Math.PI * 3)) * 0.18 }) }, // 한 바퀴 빙글 춤
  "이다연": { t: 0.8, f: (p) => ({ lean: p < 0.45 ? sw2(p / 0.45, 0, 0.6) : sw2((p - 0.45) / 0.55, 0.6, -0.1), head: p < 0.45 ? 0.3 : 0, la: -1.0, ra: -1.0, le: -1.3, re: -1.3, kick: p > 0.4 ? windup((p - 0.4) / 0.6, 0.8, -1.7, 0.35) : 0 }) }, // 콱 깨물고 → 정강이 차기
  "김민기": { t: 0.9, f: (p) => ({ ra: -1.6 + Math.sin(p * 40) * 0.2, rz: Math.cos(p * 40) * 0.25, re: -0.4, la: -0.9, le: -1.0, lean: 0.3, head: 0.25 }) }, // 거대 연필로 슥슥 필기
  "임시온": { t: 0.8, f: (p) => ({ crouch: 0.45, la: -1.7, ra: -1.7, lz: -1.1, rz: 1.1, le: -0.2, re: -0.2, lean: 0.2, hop: Math.abs(Math.sin(p * Math.PI * 3)) * 0.08 }) }, // 골키퍼 자세로 막기
  "박현호": { t: 0.9, f: (p) => ({ ra: windup((p * 2) % 1, 0.6, -2.2, 0.4), la: windup((p * 2 + 0.5) % 1, 0.6, -2.2, 0.4), rz: 0.2, lz: -0.2, twist: Math.sin(p * Math.PI * 4) * 0.3, hop: Math.abs(Math.sin(p * Math.PI * 2)) * 0.1 }) }, // 피자를 양손으로 번갈아 휙휙
  "조하윤": { t: 0.8, f: (p) => ({ crouch: 0.5, ra: -1.57, re: 0, la: -1.4, le: -0.6, head: 0.15, lean: p > 0.6 ? -0.3 * pulse(p, 0.6, 1) + 0.15 : 0.15, twist: -0.15 }) }, // 무릎 꿇고 조준 → 반동
  "최윤서": { t: 0.8, f: (p) => ({ ra: windup(p, 0.9, -2.4, 0.45), rz: 0.4, la: -0.6, twist: windup(p, 1.0, -0.8, 0.45), lean: sw2(p, -0.15, 0.3), crouch: pulse(p, 0, 0.5) * 0.25 }) }, // 몸을 비틀어 그물 휙 던지기
  "배성쌤": { t: 4.3, f: (p, s) => { const end = s > 4; const b = s * Math.PI * 4; return end ? { la: -2.9, ra: -2.9, lz: -0.5, rz: 0.5, head: -0.35, hop: 0.12 } : { ra: -1.9 + Math.sin(b) * 0.5, rz: 0.35 + Math.cos(b) * 0.3, re: -0.6, la: -1.5 + Math.sin(b + 1) * 0.25, lz: -0.6, le: -0.8, head: -0.15 + Math.sin(b) * 0.05, lean: Math.sin(b) * 0.05 }; } }, // 박자 맞춰 지휘 → 포르테!
  "박희찬": { t: 0.9, f: (p) => ({ crouch: pulse(p, 0, 0.5) * 0.3, kick: p > 0.35 ? windup((p - 0.35) / 0.65, 0.9, -2.0, 0.35) : 0.5 * p / 0.35, la: -0.8, ra: 0.6, lz: -0.9, rz: 0.9, lean: -0.2 }) }, // 프리킥: 자세 잡고 강하게 차기
  "진성욱": { t: 0.95, f: (p) => ({ la: windup(p, -3.0, 0.2, 0.32), ra: windup(p, -3.0, 0.2, 0.32), le: -0.3, re: -0.3, hop: pulse(p, 0, 0.32) * 0.9, crouch: pulse(p, 0.3, 1) * 0.7, lean: sw2(p, -0.2, 0.5) }) }, // 뛰어올라 쾅 내리찍기
  "박준서": { t: 1.0, f: (p) => ({ la: -2.8, ra: -2.8, lz: -0.45 + Math.sin(p * 12) * 0.1, rz: 0.45 - Math.sin(p * 12) * 0.1, head: -0.45, lean: -0.15, hop: Math.sin(p * Math.PI) * 0.15 }) }, // 하늘을 향해 두 팔 → 공식 비 소환
  "손태민": { t: 1.0, f: (p) => ({ la: -1.5, ra: -1.5, lz: sw2(p, 0.3, -1.0), rz: sw2(p, -0.3, 1.0), le: -0.5, re: -0.5, lean: -0.2, head: -0.1, hop: Math.sin(p * Math.PI) * 0.25 }) }, // 두 손 모았다가 쫙 펼쳐 블랙홀
  "이승환": { t: 0.95, f: (p) => (p < 0.42 ? { ra: sw2(p / 0.42, -0.6, 0.9), re: -2.0, la: -1.2, le: -1.6, twist: sw2(p / 0.42, 0, -0.7), lean: sw2(p / 0.42, 0, -0.25), crouch: 0.35 } : { ra: -1.75, re: 0, la: -0.6, le: -1.5, twist: sw2(Math.min(1, (p - 0.42) / 0.12), -0.7, 0.55), lean: sw2(Math.min(1, (p - 0.42) / 0.12), -0.25, 0.45), crouch: 0.2 }) }, // 주먹을 뒤로 꽉 젖혔다가 몸을 비틀며 쭉 뻗어요
  "세세쌤": { t: 0.9, f: (p) => ({ ra: -1.6, re: 0, rz: -0.1, la: -2.3, le: -1.7, lz: -0.2, lean: 0.12, head: -0.1 + Math.sin(p * 18) * 0.08, twist: -0.15 }) }, // 손가락으로 가리키고 한 손은 귀에 (따라 해 봐!)
  "정주환": { t: 1.0, f: (p) => ({ ra: windup(p, -3.0, -1.1, 0.55), rz: 0.2, la: -0.6, lz: -0.5, head: windup(p, -0.45, 0.1, 0.55), hop: Math.sin(p * Math.PI) * 0.35, lean: sw2(p, -0.2, 0.25) }) }, // 하늘에 손 → 번개 내리꽂기
  "김예균": { t: 1.0, f: (p) => ({ la: windup(p, -3.0, -0.3, 0.55), ra: windup(p, -3.0, -0.3, 0.55), lz: -0.2, rz: 0.2, lean: windup(p, -0.35, 0.55, 0.55), twist: windup(p, 0.5, -0.5, 0.55), crouch: pulse(p, 0.55, 1) * 0.55, hop: pulse(p, 0.1, 0.55) * 0.3 }) }, // 두 손으로 크게 내리베기
  "문주호": { t: 1.0, f: (p) => p < 0.55 ? ({ la: -2.6 + Math.sin(p * 30) * 0.15, ra: -2.6 - Math.sin(p * 30) * 0.15, lz: -0.3, rz: 0.3, le: -0.6, re: -0.6, head: -0.35 }) : ({ ra: windup((p - 0.55) / 0.45, 0.7, -1.8, 0.35), la: -0.8, twist: windup((p - 0.55) / 0.45, 0.4, -0.4, 0.35), lean: 0.2 }) }, // 머리 위로 화학식 조립 → 플라스크 던지기
};
const skillPoseT = (n) => (SKILL_POSE[n] ? SKILL_POSE[n].t : 0);
const WEAPONS = {
  "이승찬": { n: "하트 지팡이", anim: "wave", pr: { col: "#ff7aa8", shape: "orb" }, build(e) {
    const pink = e.mk(0xff6f9f, 0.4, { emissive: lin(0x5a1a30) });
    const [tx, ty, tz] = wStick(e, e.mk(0xf2e6d0, 0.6), 0.62, 0.022, 0, -0.42, 0.1, 0.5);
    for (const sx of [-1, 1]) e.put(wg("hs", () => sphG(0.08)), pink, tx + sx * 0.055, ty + 0.06, tz, e.R);
    const c = e.put(wg("hc", () => new THREE.ConeGeometry(0.13, 0.18, 12)), pink, tx, ty - 0.01, tz, e.R); c.rotation.x = Math.PI;
  } },
  "이현": { n: "이어달리기 바통", anim: "thrust", build(e) {
    const b = e.put(wg("baton", () => cylG(0.04, 0.04, 0.46)), e.mk(0xffd23a, 0.4), 0, -0.43, 0.12, e.R); b.rotation.x = Math.PI / 2;
    const red = e.mk(0xd0302a, 0.5);
    for (const y of [-0.16, 0.16]) e.put(wg("ring", () => cylG(0.046, 0.046, 0.07)), red, 0, y, 0, b);
  } },
  "최효민": { n: "배드민턴 라켓", anim: "smash", pr: { col: "#ffffff", shape: "orb" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x2b2b2b, 0.5), 0.34, 0.016, 0, -0.43, 0.1, 0.55);
    const hy = ty + Math.cos(0.55) * 0.1, hz = tz + Math.sin(0.55) * 0.1;
    const t = e.put(wg("rt", () => new THREE.TorusGeometry(0.075, 0.013, 8, 22)), e.mk(0xe04040, 0.4), tx, hy, hz, e.R); t.rotation.x = 0.55; t.scale.y = 1.35;
    const d = e.put(wg("rd", () => new THREE.CircleGeometry(0.072, 18)), e.mk(0xf2f2f2, 0.6, { side: THREE.DoubleSide }), tx, hy, hz, e.R); d.rotation.x = 0.55; d.scale.y = 1.35;
  } },
  "전하율": { n: "다트", anim: "throw", pr: { col: "#e8402e", shape: "dart" }, build(e) {
    const b = e.put(wg("dartb", () => cylG(0.032, 0.032, 0.36)), e.mk(0x2b2b2b, 0.4), 0, -0.43, 0.14, e.R); b.rotation.x = Math.PI / 2;
    e.put(wg("dartt", () => new THREE.ConeGeometry(0.032, 0.16, 8)), e.mk(0xc9d1cc, 0.3, { metalness: 0.6 }), 0, 0.26, 0, b);
    const red = e.mk(0xe8402e, 0.5);
    e.put(wg("fl1", () => new THREE.BoxGeometry(0.18, 0.1, 0.014)), red, 0, -0.16, 0, b); e.put(wg("fl2", () => new THREE.BoxGeometry(0.014, 0.1, 0.18)), red, 0, -0.16, 0, b);
  } },
  "이준희": { n: "농구공", anim: "dunk", build(e) {
    const m = new THREE.MeshStandardMaterial({ map: bballTex(), roughness: 0.7 }); e.ud.mats.push(m);
    e.put(GEO.ball, m, 0, -0.5, 0.1, e.R).scale.setScalar(1.2);
  } },
  "김현우": { n: "방패", anim: "bash", build(e) {
    const sd = e.put(GEO.shield, e.mk(0x2a3550, 0.4, { metalness: 0.6 }), -0.1, -0.3, 0.06, e.L); sd.rotation.z = Math.PI / 2;
    e.put(GEO.boss, e.mk(0x7fc4ff, 0.35, { metalness: 0.5 }), -0.14, -0.3, 0.06, e.L);
  } },
  "이보경": { n: "방패", anim: "bash", build(e) {
    const sd = e.put(GEO.shield, e.mk(0xb8c4bc, 0.35, { metalness: 0.7 }), -0.1, -0.3, 0.06, e.L); sd.rotation.z = Math.PI / 2;
    e.put(GEO.boss, e.mk(COST_HEX[e.def.c], 0.4, { metalness: 0.5 }), -0.14, -0.3, 0.06, e.L);
  } },
  "윤동욱": { n: "부채", anim: "fan", build(e) {
    const f = e.put(wg("fan", () => new THREE.CircleGeometry(0.22, 18, 0, Math.PI)), e.mk(0xf3e2b8, 0.7, { side: THREE.DoubleSide }), 0, -0.44, 0.12, e.R); f.rotation.set(0.3, 0.9, 0);
    const r = e.put(wg("fanr", () => new THREE.TorusGeometry(0.22, 0.012, 6, 18, Math.PI)), e.mk(0xc23324, 0.5), 0, -0.44, 0.12, e.R); r.rotation.set(0.3, 0.9, 0);
    e.put(wg("fanh", () => cylG(0.016, 0.016, 0.1)), e.mk(0x6b4a30, 0.6), 0, -0.45, 0.1, e.R);
  } },
  "김민기": { n: "거대 연필", anim: "stab", pr: { col: "#f5d76e", shape: "chalk" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0xf5c518, 0.5), 0.62, 0.032, 0, -0.43, 0.1, 0.45);
    const dy = Math.cos(0.45), dz = Math.sin(0.45);
    const c = e.put(wg("pt", () => new THREE.ConeGeometry(0.032, 0.1, 8)), e.mk(0x5a3e2a, 0.7), tx, ty + dy * 0.05, tz + dz * 0.05, e.R); c.rotation.x = 0.45;
    e.put(wg("pe", () => sphG(0.036)), e.mk(0xff8aa8, 0.6), 0, -0.43 - dy * 0.31, 0.1 - dz * 0.31, e.R);
  } },
  "이승환": { n: "권투 글러브", anim: "punch", build(e) {
    const gl = e.mk(0xd8202a, 0.45);
    for (const arm of [e.L, e.R]) { const m = e.put(wg("glove", () => sphG(0.095)), gl, 0, -0.43, 0.02, arm); m.scale.set(1.15, 1.05, 1.25); }
  } },
  "임시온": { n: "골키퍼 장갑", anim: "punch", build(e) {
    const gl = e.mk(0x2fc27a, 0.6);
    for (const arm of [e.L, e.R]) { const m = e.put(wg("glove", () => sphG(0.095)), gl, 0, -0.43, 0.02, arm); m.scale.set(1.1, 1, 1.15); }
  } },
  "이수아": { n: "손하트", anim: "wave", pr: { col: "#ffb0d0", shape: "orb" }, build(e) { // 손엔 아무것도 없어요
  } },
  "이다연": { n: "실내화 킥", anim: "kick", build(e) { // 손엔 아무것도 없어요 — 정강이를 차요
  } },
  "세세쌤": { n: "영어 단어 카드", anim: "throw", pr: { col: "#ffffff", shape: "plane" }, build(e) {
    const c = e.put(wg("wcard", () => new THREE.BoxGeometry(0.16, 0.11, 0.008)), e.mk(0xf6f4ee, 0.6), 0, -0.45, 0.06, e.R); c.rotation.x = 0.4;
  } },
  "배성쌤": { n: "지휘봉", anim: "wave", pr: { col: "#ffd36b", shape: "orb" }, build(e) {
    wStick(e, e.mk(0xf2ead8, 0.4), 0.42, 0.01, 0, -0.43, 0.1, 0.5);
  } },
  "김예균": { n: "소환 지팡이", anim: "staff", build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x2a6a68, 0.5), 0.8, 0.022, 0, -0.43, 0.1, 0.4);
    const dy = Math.cos(0.4), dz = Math.sin(0.4);
    e.put(wg("orb", () => sphG(0.085)), e.mk(0x7ff0e0, 0.2, { emissive: lin(0x2fd0c0), emissiveIntensity: 1.1 }), tx, ty + dy * 0.06, tz + dz * 0.06, e.R);
    const t = e.put(wg("orbr", () => new THREE.TorusGeometry(0.11, 0.012, 6, 20)), e.mk(0xd8b45a, 0.3, { metalness: 0.8 }), tx, ty + dy * 0.06, tz + dz * 0.06, e.R); t.rotation.x = Math.PI / 2 + 0.4;
  } },
  "최윤서": { n: "투망", anim: "toss", build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0x6a4a2a, 0.6), 0.7, 0.02, 0, -0.43, 0.1, 0.5);
    const h = e.put(wg("nh", () => new THREE.TorusGeometry(0.1, 0.012, 6, 18)), e.mk(0x2fd0a0, 0.4), tx, ty + 0.05, tz, e.R); h.rotation.x = 0.5;
  } },
  "은혜린": { n: "댄스 리본", anim: "wave", pr: { col: "#ff7ab0", shape: "orb" }, build(e) {
    const [tx, ty, tz] = wStick(e, e.mk(0xf2e6d0, 0.5), 0.4, 0.016, 0, -0.43, 0.1, 0.6);
    const r = e.put(wg("rb", () => new THREE.BoxGeometry(0.03, 0.3, 0.004)), e.mk(0xff7ab0, 0.5), tx, ty - 0.12, tz, e.R); r.rotation.x = 0.3;
  } },
  "박현호": { n: "피자 상자", anim: "toss", pr: { col: "#ffb43a", shape: "pizza" }, build(e) {
    const b = e.put(wg("pzb", () => new THREE.BoxGeometry(0.3, 0.05, 0.3)), e.mk(0xd9a86a, 0.8), 0, -0.45, 0.12, e.L); b.rotation.set(0.1, 0.3, 0);
    const l = e.put(wg("pzl", () => new THREE.CylinderGeometry(0.08, 0.08, 0.01, 14)), e.mk(0xc8322a, 0.6), 0, -0.42, 0.12, e.L); l.rotation.set(0.1, 0.3, 0);
  } },
  "조하윤": { n: "게임 컨트롤러", anim: "mash", build(e) {
    const g = new THREE.Group(); g.position.set(0, -0.46, 0.14); g.rotation.x = 0.5; g.scale.setScalar(1.7); e.R.add(g);
    const dk = e.mk(0x2c3036, 0.5), black = e.mk(0x111111, 0.4);
    e.put(wg("pad", () => new THREE.BoxGeometry(0.26, 0.06, 0.13)), dk, 0, 0, 0, g);
    for (const x of [-0.07, 0.04]) e.put(wg("stk", () => cylG(0.02, 0.02, 0.025)), black, x, 0.04, x < 0 ? 0.015 : -0.02, g);
    [[0.085, 0.0, 0xe8402e], [0.1, 0.03, 0x3ca86a], [0.07, 0.03, 0x3c78d0], [0.085, 0.045, 0xf6c431]].forEach(([x, z, c]) => e.put(wg("btn", () => sphG(0.014)), e.mk(c, 0.4), x, 0.032, z - 0.02, g));
    e.put(wg("led", () => new THREE.BoxGeometry(0.1, 0.01, 0.01)), e.mk(0x7ff0ff, 0.2, { emissive: lin(0x3fd8ff), emissiveIntensity: 1.2 }), 0, 0.032, 0.06, g);
  } },
  "박희찬": { n: "축구공", anim: "kick", pr: { shape: "ball" }, build(e) {
    const m = new THREE.MeshStandardMaterial({ map: ballTex(), roughness: 0.5 }); e.ud.mats.push(m);
    e.ud.ball = e.put(GEO.ball, m, 0.02, -0.5, 0.12, e.R); e.ud.ball.scale.setScalar(1.1);
  } },
  "진성욱": { n: "아령", anim: "uppercut", build(e) {
    const dk = e.mk(0x3a3f44, 0.4, { metalness: 0.5 });
    const bar = e.put(wg("db", () => cylG(0.018, 0.018, 0.34)), dk, 0, -0.45, 0.1, e.R); bar.rotation.z = Math.PI / 2;
    for (const y of [-0.15, 0.15]) e.put(wg("dp", () => cylG(0.085, 0.085, 0.045, 16)), dk, 0, y, 0, bar);
  } },
  "박준서": { n: "컴퍼스", anim: "circle", pr: { col: "#cfd8dc", shape: "orb" }, build(e) {
    const grp = new THREE.Group(); grp.position.set(0, -0.4, 0.1); grp.rotation.x = 0.3; e.R.add(grp);
    const metal = e.mk(0xc9d1cc, 0.3, { metalness: 0.7 });
    for (const s2 of [-1, 1]) {
      const l = e.put(wg("cl", () => cylG(0.02, 0.02, 0.44)), metal, s2 * 0.045, 0.2, 0, grp); l.rotation.z = s2 * 0.2;
      e.put(wg("ct", () => new THREE.ConeGeometry(0.02, 0.07, 6)), s2 < 0 ? e.mk(0x333333, 0.4) : metal, s2 * 0.09, -0.03, 0, grp).rotation.x = Math.PI;
    }
    e.put(wg("ch", () => sphG(0.045)), e.mk(0xd8b45a, 0.3, { metalness: 0.8 }), 0, 0.43, 0, grp);
  } },
  "손태민": { n: "만점 졸업장", anim: "toss", pr: { col: "#ffffff", shape: "plane" }, build(e) {
    const sc = e.put(wg("scr", () => cylG(0.05, 0.05, 0.32, 14)), e.mk(0xf4ecd0, 0.7), 0, -0.46, 0.1, e.R); sc.rotation.z = 1.2;
    const rb = e.put(wg("scrr", () => new THREE.TorusGeometry(0.053, 0.012, 6, 16)), e.mk(0xc8323a, 0.5), 0, 0, 0, sc); rb.rotation.x = Math.PI / 2;
  } },
  "문주호": { n: "반응 플라스크", anim: "throw", pr: { col: "#5aff8a", shape: "flask" }, build(e) {
    // 오른손엔 초록 용액이 든 둥근 플라스크, 왼손엔 노란 시험관
    const glass = e.mk(0xdff4ff, 0.15, { transparent: true, opacity: 0.45 }), liq = e.mk(0x5aff8a, 0.3, { emissive: new THREE.Color(0x2adf6a), emissiveIntensity: 1.1 });
    e.put(wg("fkb", () => sphG(0.1)), glass, 0, -0.5, 0.1, e.R);
    e.put(wg("fkl", () => sphG(0.08)), liq, 0, -0.51, 0.1, e.R);
    e.put(wg("fkn", () => cylG(0.03, 0.035, 0.14)), glass, 0, -0.36, 0.1, e.R);
    const tube = e.put(wg("tbe", () => cylG(0.025, 0.025, 0.2)), glass, 0, -0.46, 0.08, e.L); tube.rotation.x = 0.3;
    e.put(wg("tbl", () => cylG(0.02, 0.02, 0.1)), e.mk(0xffe04a, 0.3, { emissive: new THREE.Color(0xffc81a), emissiveIntensity: 1 }), 0, -0.04, 0, tube);
  } },
  "정주환": { n: "신의 번개", anim: "zeus", pr: { col: "#9fdcff", shape: "orb" }, build(e) {
    // 손에 쥔 지그재그 번개
    const m = e.mk(0xffe66b, 0.3, { emissive: new THREE.Color(0xffd23a), emissiveIntensity: 1.4 });
    const seg = wg("bolt", () => new THREE.BoxGeometry(0.05, 0.2, 0.05));
    [[0, -0.40, 0.10, 0.5], [0, -0.48, 0.20, -0.6], [0, -0.40, 0.30, 0.5], [0, -0.48, 0.40, -0.6]].forEach(([x, y, z, r]) => { const b = e.put(seg, m, x, y, z, e.R); b.rotation.x = Math.PI / 2 + r; });
    e.put(wg("btip", () => new THREE.ConeGeometry(0.05, 0.14, 6)), m, 0, -0.44, 0.52, e.R).rotation.x = Math.PI / 2;
  } },
};
function projSpecial(p) {
  if (p.ball || p.shape === "ball") return new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ map: ballTex(), color: 0xffffff, roughness: 0.5 }));
  if (p.shape === "orb") { const c = lin(p.col || "#ffffff"), m = new THREE.Mesh(GEO.ball, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.4 })); m.scale.setScalar(0.45); return m; }
  if (p.shape === "pizza") { // 피자 한 조각: 노릇한 치즈 + 페퍼로니 + 빵 끝
    const g = new THREE.Group(), M2 = (c) => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7 });
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12, 1, false, -0.35, 0.7), M2(0xf0a830)); g.add(sl);
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 12, 1, true, -0.35, 0.7), M2(0xc8843a)); cr.material.side = THREE.DoubleSide; g.add(cr);
    for (const [x, z] of [[0.05, 0.16], [-0.04, 0.24], [0.02, 0.08]]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), M2(0xc8322a)); pp.position.set(x, 0.03, z); g.add(pp); }
    g.children.forEach((c) => (c.position.z -= 0.15)); return g;
  }
  if (p.shape === "flask") { // 문주호: 빙글빙글 돌며 날아가는 플라스크 (빛나는 초록 용액)
    const g = new THREE.Group(), glass = new THREE.MeshStandardMaterial({ color: lin(0xdff4ff), roughness: 0.15, transparent: true, opacity: 0.5 });
    const liq = new THREE.MeshStandardMaterial({ color: lin(0x5aff8a), emissive: lin(0x2adf6a), emissiveIntensity: 1.3, roughness: 0.3 });
    const b = new THREE.Mesh(GEO.ball, glass); b.scale.setScalar(1.6); g.add(b);
    const l = new THREE.Mesh(GEO.ball, liq); l.scale.setScalar(1.3); l.position.y = -0.02; g.add(l);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), glass); n.position.y = 0.24; g.add(n);
    return g;
  }
  if (p.shape === "letter") { // 세세쌤: 날아가는 알파벳 (빛나는 글자)
    const tex = textTex("letter" + p.ch + p.col, 96, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = "900 72px Georgia, 'Times New Roman', serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = "#4fa8ff"; g.shadowBlur = 18; g.lineWidth = 6; g.strokeStyle = "#163a7a"; g.strokeText(p.ch, w / 2, h / 2 + 4); g.fillStyle = p.col; g.fillText(p.ch, w / 2, h / 2 + 4); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.setScalar(0.75); return s;
  }
  if (p.shape === "dart") { const m = new THREE.Mesh(GEO.spike, new THREE.MeshStandardMaterial({ color: lin(0xe8402e), roughness: 0.5 })); m.scale.set(1.2, 1.7, 1.2); return m; }
  return null;
}
