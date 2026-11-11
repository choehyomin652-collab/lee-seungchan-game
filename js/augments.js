// ============================================================
//  augments.js — 증강 목록 (2-1 · 3-2 · 4-2 라운드에서 3개 중 1개 선택)
//  새 증강: AUGS 에 { id, n: 이름, d: 설명, f: (P) => 효과 } 를 추가하면 돼요.
// ============================================================
"use strict";
// 증강: 2-1(은), 3-2(금), 4-2(프리즘) 라운드에 3개 중 1개 선택
const AUGS = [
  { id: "money", n: "두둑한 용돈", d: "즉시 15골드", f: (P) => (P.gold += 15) },
  { id: "lunch", n: "점심시간", d: "매 라운드 시작마다 골드 +2", f: (P) => (P.gpr += 2) },
  { id: "study", n: "선행 학습", d: "즉시 경험치 +12", f: (P) => addXp(P, 12) },
  { id: "supplies", n: "준비물 챙기기", d: "아이템 재료 3개", f: (P) => { for (let i = 0; i < 3; i++) giveItem(P, rnd(COMP).id); } },
  { id: "complete", n: "완성품 선물", d: "무작위 완성 아이템 1개", f: (P) => giveItem(P, rnd(Object.keys(COMBOS))) },
  { id: "sports", n: "체육대회", d: "아군 전체 공격 속도 +15%", f: (P) => (P.buff.as += 0.15) },
  { id: "wall", n: "철벽 수비", d: "아군 전체 받는 피해 -10%", f: (P) => (P.buff.ar += 0.1) },
  { id: "meat", n: "급식 고기반찬", d: "아군 전체 공격력 +12%, 체력 +8%", f: (P) => { P.buff.ad += 0.12; P.buff.hp += 0.08; } },
  { id: "nurse", n: "보건실 이용권", d: "내 체력 +20", f: (P) => (P.hp += 20) },
  { id: "pres", n: "신의 강림", d: "정주환 ★1을 대기석으로", f: (P) => { const d = DEFS.findIndex((x) => x.n === "정주환"), i = P.bench.indexOf(null); if (i >= 0 && S.pool[d] > 0) { P.bench[i] = mkUnit(d); S.pool[d]--; } else P.gold += 5; } },
  { id: "honor", n: "우등생", d: "무작위 2코스트 친구 ★2", f: (P) => { // ★2 = 친구 3명이라 풀에서 3명을 꺼내요
    const i = P.bench.indexOf(null), cands = DEFS.map((_, j) => j).filter((j) => DEFS[j].c === 2 && S.pool[j] >= 3);
    if (i >= 0 && cands.length) { const d = rnd(cands); S.pool[d] -= 3; P.bench[i] = mkUnit(d, 2); } else P.gold += 6; } },
  ...["운동광", "지는 거 못 참음", "공부는 잘함", "다 퍼줌", "축구부"].map((t) => ({ id: "emb-" + t, n: `${t} 배지`, d: `${t} 시너지 숫자 +1`, f: (P) => (P.emb[t] = (P.emb[t] || 0) + 1) })),
];
const AUG_ROUNDS = { "2-1": "실버", "3-2": "골드", "4-2": "프리즘" };
