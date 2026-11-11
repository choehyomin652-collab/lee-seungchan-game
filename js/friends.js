// ============================================================
//  friends.js — 친구들 정보 (이름 · 코스트 · 특성)
//  여기만 고치면 되는 것:
//   · 새 친구 추가: DEFS 에 한 줄 추가  { n: "이름", c: 코스트(1~5), k: "역할", t: ["특성", ...] }
//   · 특성(시너지) 효과 설명/숫자: TRAITS (실제 효과 계산은 battle.js 의 makeFighter)
//   · 역할별 기본 체력/공격/사거리: CLASS
//  새 친구를 넣으면 skills.js 에 스킬, weapons.js 에 무기도 같이 넣어 주세요.
// ============================================================
"use strict";
const DEFS = [
  // 1코스트
  { n: "이승찬", c: 1, k: "응원단", t: ["다 퍼줌"] },
  { n: "이현",   c: 1, k: "돌격대", t: ["운동광", "지는 거 못 참음"] },
  { n: "최효민", c: 1, k: "저격수", t: ["운동광", "공부는 잘함", "지는 거 못 참음"] },
  { n: "전하율", c: 1, k: "저격수", t: ["지는 거 못 참음"] },
  // 2코스트
  { n: "이준희", c: 2, k: "돌격대", t: ["운동광"], s: "덩크슛" },
  { n: "김현우", c: 2, k: "천재",   t: ["공부는 잘함", "지는 거 못 참음"] },
  { n: "이보경", c: 2, k: "수호자", t: ["축구부", "합체로봇"], s: "태클 수비" },
  { n: "윤동욱", c: 2, k: "돌격대", t: ["운동광", "지는 거 못 참음", "합체로봇"] },
  // 3코스트
  { n: "김민기", c: 3, k: "천재",   t: ["공부는 잘함", "다 퍼줌"] },
  { n: "임시온", c: 3, k: "수호자", t: ["축구부", "다 퍼줌"], s: "골문 사수" },
  { n: "박현호", c: 3, k: "응원단", t: ["공부는 잘함", "다 퍼줌"] },
  { n: "조하윤", c: 3, k: "저격수", t: ["공부는 잘함", "다 퍼줌", "프로게이머", "합체로봇"] },
  // 4코스트
  { n: "박희찬", c: 4, k: "저격수", t: ["축구부", "공부는 잘함", "합체로봇"], s: "무회전 프리킥" },
  { n: "진성욱", c: 4, k: "돌격대", t: ["운동광", "지는 거 못 참음"] },
  { n: "박준서", c: 4, k: "천재",   t: ["수학왕"], s: "수학 문제 폭격" },
  { n: "손태민", c: 4, k: "천재",   t: ["공부는 잘함", "전교 1등"] },
  // 5코스트
  { n: "정주환", c: 5, k: "신",     t: ["신"] },
  { n: "김예균", c: 5, k: "수호자", t: ["운동광"] },
];
const TRAITS = {
  "운동광":   { t: [2, 4, 6], d: "운동광 체력 +20% / +45% / +80%" },
  "지는 거 못 참음":   { t: [2, 4, 6], d: "지는 거 못 참음 공격력 +20% / +45% / +80%, 치명타 20%" },
  "공부는 잘함":   { t: [2, 4, 6], d: "공부는 잘함 스킬 피해 +30% / +70% / +110%" },
  "다 퍼줌": { t: [2, 4],   d: "아군 전체 보호막 150 / 350" },
  "축구부":   { t: [2, 3],    d: "축구부 공격 속도 +25% / +50%" },
  "수학왕":   { t: [1],       d: "박준서 마나 회복 +60%" },
  "프로게이머": { t: [1],     d: "조하윤 공격 속도 +30%" },
  "전교 1등": { t: [1],      d: "손태민 스킬 피해 +40%" },
  "합체로봇": { t: [4],      d: "조하윤·박희찬·윤동욱·이보경 4명이 모두 보드에 있으면 전투 시작 때 4인 합체로봇으로 합체!" },
  "신":       { t: [1],       d: "신의 가호: 아군 전체 공격력·체력 +12%" },
};
// ---------- 옷 ----------
// type: uniform(교복) cardigan(카디건) vest(조끼+셔츠) track(체육복) hoodie(후드티) padding(패딩)
//       varsity(야구 점퍼) jersey(운동 유니폼·반바지) tank(민소매) tshirt(티셔츠) dobok(도복) robe(로브)
// top: 윗옷 색, bottom: 바지 색, accent: 포인트 색, num: 등번호, print: 가슴 글자, sleeve: "long"|"short"|"none"
const OUTFITS = {
  "이승찬": { type: "hoodie", top: 0xf08a3a, bottom: 0xcbb592, accent: 0xffffff },
  "이현": { type: "track", top: 0xc8323a, accent: 0xffffff },
  "최효민": { type: "jersey", top: 0xf4f4f4, bottom: 0x2f5fa8, accent: 0x2f5fa8, num: "7" },
  "전하율": { type: "padding", top: 0x1e2126, bottom: 0x3c5a86, accent: 0xe8402e },
  "이준희": { type: "tank", top: 0xf08a1a, bottom: 0xf08a1a, accent: 0x5a2a8a, num: "23" },
  "김현우": { type: "cardigan", top: 0x2a3550, bottom: 0x4a4e57, accent: 0xf2f0ea },
  "이보경": { type: "jersey", top: 0x2f9a5a, bottom: 0xf4f4f4, accent: 0xf4f4f4, num: "4", socks: 0x2f9a5a },
  "윤동욱": { type: "dobok", top: 0xf6f4ee, bottom: 0xf6f4ee, accent: 0x111111 },
  "김민기": { type: "tshirt", top: 0xf4f4f4, bottom: 0x3c5a86, accent: 0x7a5cd0, print: "✎" },
  "임시온": { type: "jersey", top: 0xd8e83a, bottom: 0x1e2126, accent: 0x1e2126, num: "1", sleeve: "long", socks: 0xd8e83a },
  "김예균": { type: "hoodie", top: 0x2a7a78, bottom: 0x2b303b, accent: 0x7ff0e0 },
  "박현호": { type: "varsity", top: 0xb8323a, bottom: 0x3c5a86, accent: 0xf2e6c8 },
  "조하윤": { type: "hoodie", top: 0x1a1a22, bottom: 0x1a1a22, accent: 0x3fd8ff },
  "박희찬": { type: "jersey", top: 0x2a5ad0, bottom: 0xf4f4f4, accent: 0xf4f4f4, num: "10", socks: 0x2a5ad0 },
  "진성욱": { type: "tank", top: 0x5a5f66, bottom: 0x1e2126, accent: 0xe8402e, print: "GYM" },
  "박준서": { type: "vest", top: 0x7a2a3a, bottom: 0x4a4e57, accent: 0xf2f0ea },
  "손태민": { type: "uniform", top: 0x1f2a44, bottom: 0x343a44 },
  "정주환": { type: "robe", top: 0xf8f6f0, bottom: 0xf8f6f0, accent: 0xffcf4a },
};
// ---------- 생김새(스킨) ----------
// 친구마다 머리 모양·머리 색·체격·표정·장식을 따로 정해요. 특성에 어울리게 골랐어요.
// hair: bowl(바가지) spiky(뾰족) side(옆으로 넘김) buzz(반삭) pomp(올림머리) curtain(가르마) curly(곱슬) mushroom(버섯)
//       messy(부스스) mohawk(모히칸) slick(올백) flat(각진 스포츠) wavy(웨이브) long(긴 머리)
// hc: 머리 색, tip: 포인트 염색 색, skin: 0~3(피부 톤), tall·wide: 키·체격 배율, head: 머리 크기 배율
// eye: 눈 크기 배율, mouth: smile(미소) grin(활짝) flat(무표정) pout(꾹 다문 입), brow: 눈썹 굵기 배율
// acc: 장식 목록 — [종류, 색 또는 옵션...]
//   headband(머리띠, "tails"=뒤로 날리는 끈) sweatband(땀 밴드) cap(야구 모자, "back"=거꾸로) beanie(비니) beret(베레모)
//   glasses(안경: round·square·rimless·tint·sport) pencil(귀에 꽂은 연필) bandage(반창고: cheek·nose) blush(볼 터치)
//   scarf(목도리) towel(목 수건) whistle(호루라기) armband(완장) wristband(손목 밴드) sleeve(한쪽 팔 토시)
//   backpack(책가방) pendant(빛나는 목걸이) bowtie(나비넥타이) badge(가슴 배지 글자) backprint(등 글자) laurel(월계관) wings(날개)
const LOOKS = {
  "이승찬": { hair: "curly", hc: 0x6b4226, skin: 2, tall: 0.96, wide: 1.04, eye: 1.12, mouth: "grin", acc: [["blush"], ["scarf", 0xfff0c8], ["headband", 0xffd24a], ["backprint", "♥", 0xffffff]] },
  "이현": { hair: "spiky", hc: 0x16110e, tip: 0xc8323a, skin: 1, tall: 1.0, wide: 1.02, mouth: "pout", brow: 1.35, acc: [["headband", 0xe8402e, "tails"], ["bandage", "cheek"], ["wristband", 0xffffff]] },
  "최효민": { hair: "side", hc: 0x2a1d15, skin: 0, tall: 0.97, wide: 0.95, acc: [["cap", 0x2f5fa8, "back"], ["glasses", "sport", 0x2f5fa8], ["wristband", 0x2f5fa8]] },
  "전하율": { hair: "curtain", hc: 0x121212, skin: 2, tall: 1.02, wide: 0.96, mouth: "flat", brow: 1.2, acc: [["beanie", 0xc8323a], ["bandage", "nose"]] },
  "이준희": { hair: "flat", hc: 0x1c1612, skin: 3, tall: 1.09, wide: 1.03, mouth: "grin", acc: [["sweatband", 0x5a2a8a], ["sleeve", 0x1a1a1e], ["wristband", 0x5a2a8a]] },
  "김현우": { hair: "curtain", hc: 0x4a3324, skin: 0, tall: 0.99, wide: 0.93, mouth: "flat", brow: 1.15, acc: [["glasses", "round", 0x1d1d1d], ["pencil"], ["backpack", 0x2a3550]] },
  "이보경": { hair: "buzz", hc: 0x1c1612, skin: 3, tall: 1.02, wide: 1.14, mouth: "pout", acc: [["armband", 0xffd24a], ["sweatband", 0xf4f4f4]] },
  "윤동욱": { hair: "mohawk", hc: 0x141414, skin: 1, tall: 1.0, wide: 1.06, mouth: "pout", brow: 1.3, acc: [["headband", 0xf6f4ee, "tails"], ["bandage", "cheek"]] },
  "김민기": { hair: "mushroom", hc: 0x3a291c, skin: 2, tall: 0.95, wide: 0.97, eye: 1.1, mouth: "smile", acc: [["beret", 0x7a5cd0], ["glasses", "round", 0x7a5cd0], ["pencil"], ["blush"], ["backpack", 0x7a5cd0]] },
  "임시온": { hair: "side", hc: 0x2a1d15, skin: 1, tall: 1.06, wide: 1.12, mouth: "smile", acc: [["cap", 0x2b303b, "", 0xd8e83a], ["blush"]] },
  "김예균": { hair: "messy", hc: 0x1a1a1a, tip: 0x3fd8c8, skin: 0, tall: 1.03, wide: 1.08, mouth: "smile", acc: [["sweatband", 0x7ff0e0], ["pendant", 0x7ff0e0], ["wristband", 0x7ff0e0], ["backprint", "✦", 0x7ff0e0]] },
  "박현호": { hair: "side", hc: 0x3a291c, skin: 2, tall: 0.98, wide: 1.0, eye: 1.08, mouth: "grin", acc: [["glasses", "square", 0x8a2a2a], ["whistle"], ["blush"]] },
  "조하윤": { hair: "bowl", hc: 0x101014, tip: 0x3fd8ff, skin: 0, tall: 0.97, wide: 0.92, mouth: "flat", acc: [["glasses", "tint", 0x3fd8ff], ["backprint", "GG", 0x3fd8ff]] },
  "박희찬": { hair: "wavy", hc: 0x2a1d15, skin: 1, tall: 1.03, wide: 0.99, mouth: "smile", acc: [["headband", 0x101010], ["glasses", "rimless", 0xcfd8e0], ["armband", 0xf4f4f4]] },
  "진성욱": { hair: "buzz", hc: 0x141414, skin: 3, tall: 1.07, wide: 1.24, mouth: "pout", brow: 1.4, acc: [["towel", 0xf4f4f4], ["wristband", 0xe8402e], ["bandage", "nose"]] },
  "박준서": { hair: "bowl", hc: 0x1c1612, skin: 0, tall: 0.94, wide: 0.95, eye: 1.05, mouth: "smile", acc: [["glasses", "square", 0x1d1d1d], ["bowtie", 0xffcf4a], ["badge", "π", "#ffffff", "#7a2a3a"], ["pencil"], ["backpack", 0x7a2a3a]] },
  "손태민": { hair: "slick", hc: 0x16110e, skin: 2, tall: 1.01, wide: 0.96, mouth: "flat", acc: [["glasses", "rimless", 0xd8b45a], ["armband", 0xc8323a], ["backpack", 0x1f2a44]] },
  "정주환": { hair: "long", hc: 0xf2ead8, skin: 0, tall: 1.1, wide: 1.02, head: 1.0, mouth: "smile", acc: [["laurel"], ["wings"]] },
};
// ---------- 밸런스 표 ----------
// 친구마다 체력(hp) · 공격력(ad) · 스킬 세기(sk)에 곱하는 숫자예요. 1 = 그대로, 1.1 = 10% 강하게, 0.9 = 10% 약하게.
// 같은 골드로 짠 무작위 팀끼리 수천 판 싸우게 해서, 승률이 50%에 가깝도록 맞춘 값이에요.
const TUNE = {
  "이승찬": { hp: 1.10, ad: 1.10, sk: 1.10 },
  "이현": { hp: 0.95, ad: 0.95, sk: 0.95 },
  "최효민": { hp: 0.85, ad: 0.85, sk: 0.85 },
  "전하율": { hp: 1.15, ad: 1.15, sk: 1.15 },
  "김현우": { hp: 1.20, ad: 1.20, sk: 1.20 },
  "이보경": { hp: 0.95, ad: 0.95, sk: 0.95 },
  "윤동욱": { hp: 0.90, ad: 0.90, sk: 0.90 },
  "김민기": { hp: 1.20, ad: 1.20, sk: 1.20 },
  "임시온": { hp: 0.87, ad: 0.87, sk: 0.87 },
  "박현호": { hp: 1.25, ad: 1.25, sk: 1.25 },
  "조하윤": { hp: 0.87, ad: 0.87, sk: 0.87 },
  "진성욱": { hp: 0.90, ad: 0.90, sk: 0.90 },
};
const tuneOf = (def) => TUNE[def.n] || { hp: 1, ad: 1, sk: 1 };
const MAIN_TRAITS = ["운동광", "지는 거 못 참음", "공부는 잘함", "다 퍼줌", "축구부"];
// rg = 육각 칸 사거리
const CLASS = {
  "수호자": { hp: 780, ad: 48, as: 0.6,  rg: 1, ar: 0.25, mm: 60, sk: "철벽 수비" },
  "돌격대": { hp: 660, ad: 62, as: 0.7,  rg: 1, ar: 0.1,  mm: 50, sk: "돌진 강타" },
  "저격수": { hp: 480, ad: 58, as: 0.75, rg: 4, ar: 0,    mm: 70, sk: "한 방 저격" },
  "천재":   { hp: 500, ad: 42, as: 0.65, rg: 3, ar: 0,    mm: 60, sk: "아이디어 폭발" },
  "응원단": { hp: 540, ad: 38, as: 0.65, rg: 3, ar: 0.05, mm: 70, sk: "힘내라!" },
  "신":     { hp: 1050,ad: 80, as: 0.8,  rg: 2, ar: 0.2,  mm: 80, sk: "천벌" },
};
