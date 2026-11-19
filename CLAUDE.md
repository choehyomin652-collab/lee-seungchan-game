# Claude 작업 규칙

## 바꿔 달라는 건 전부 PR → 머지까지 (사용자가 요청한 규칙)
사용자가 바꿔 달라고 한 것은 매번 끝까지 해요:
1. 작업 브랜치에 커밋하고 푸시해요 (작업 브랜치가 이미 머지됐으면 기본 브랜치 `claude/game-development-7um8lj` 최신에서 같은 이름으로 다시 시작해요)
2. 기본 브랜치로 가는 PR 을 만들어요 (이미 열린 PR 이 있으면 거기에 더해요)
3. 바로 머지해요 → GitHub Pages 앱이 자동으로 다시 배포돼요 (`.github/workflows/pages.yml`, 성공했는지 확인)
4. 게임 코드가 바뀌었으면 아래 규칙대로 아티팩트도 다시 올려요

## 고칠 때마다 아티팩트도 업데이트
게임 코드를 고쳐서 커밋했으면, 매번 "영토체스"(예전 이름: 씹토체스 · 우리반 오토배틀) 아티팩트도 같은 주소로 다시 올려요 (사용자가 요청한 규칙).

- 아티팩트 주소: https://claude.ai/artifact/GvQxrfNwby1qCz7pudz6CE
- 페이지 만들기: `sh tools/make-artifact-page.sh > <스크래치패드>/uri-battle.html`
- 올리기: Artifact publish 에 `url` = 위 주소, `file_path` = 만든 페이지, `files` = 이번에 바뀐 `style.css` · `js/*.js` 만 (published 경로와 저장소 경로가 같아요. 빠진 파일은 아티팩트에 있던 그대로 남아요)
- 전부 다시 올리지 않는 이유: 다른 계정이 아티팩트에서 직접 `js/photos.js` 를 고친 적이 있어요. 지금 저장소의 `photos.js` 는 아티팩트 것과 맞춰 뒀지만, 올리기 전에 아티팩트의 `photos.js` 가 또 바뀌었는지 확인하고 바뀌었으면 합친 뒤 올려요
- 미리 넣은 친구 카드 사진은 저장소의 `cards/<id>.jpg` 에 있어요 (홈 화면 앱에서도 보이게 넣었어요, 사용자가 요청). 아티팩트에도 같은 `cards/` 가 있어요. 사진을 새로 넣거나 바꾸면 `cards/` 에 넣고 `js/photos.js` 의 `BUILTIN_CARDS` · `sw.js` 의 카드 목록을 고친 뒤, 아티팩트에 올릴 때 그 사진도 `files` 에 넣어요. 새 사진은 `python3 tools/make-cardpics.py <id>...` 로 `js/cardpics.js` 에도 넣어요 (지금 넣은 id 들 + 새 id 를 모두 적어서 다시 만들어요). claude.ai 아티팩트에서 새로 올린 jpg 가 일부 기기에서 안 받아져서, 사진을 JS 안에 같이 보내요
- 올리다가 "newer version" 으로 거절되면, 다른 곳에서 바뀐 파일이 내가 이번에 올리는 파일과 겹치는지 확인하고, 겹치지 않으면 그대로 다시 올려요
- `capabilities` 는 빼고 올려요 (사진 저장 db 규칙 · 온라인 room 설정을 그대로 유지)
- 새 JS 파일을 추가했다면 `index.html` 의 `<script>` 와 `files` 목록, 그리고 `sw.js` 의 `FILES` 에도 넣어요

## 홈 화면 앱 (PWA)
- iPad · 아이폰용 홈 화면 앱은 GitHub Pages 로 배포해요: https://choehyomin652-collab.github.io/lee-seungchan-game/
- 기본 브랜치에 올라오면 `.github/workflows/pages.yml` 이 자동 배포해요. 처음 한 번 저장소 Settings → Pages → Source 를 "GitHub Actions" 로 바꿔야 해요
- 앱 설정(manifest · 아이콘 · 서비스 워커 등록)은 `index.html` 의 `<!-- PWA -->` 표시 사이에 있어요. 아티팩트 페이지를 만들 때는 이 부분이 빠져요
- 앱에서는 claude.ai 기능(친구와 같이 하기 · 게임에서 올린 공유 사진)이 없어요. 혼자 하기 · 연습장 · 미리 넣은 카드 사진 · 내 기기 사진은 돼요

## 개인 계정 (js/account.js)
- 아이디·비밀번호 로그인, 프로필(닉네임·대표 캐릭터), 레벨·칭호, 전적, 계정별 설정(소리·화질·카드 사진)
- 계정마다 나뉘어야 하는 localStorage 키는 `pkey("uri-...")` 로 감싸요. 서버에 같이 올릴 키는 `SYNC_KEYS` 에 넣어요
- 티어(아이언 ~ 챌린저)·영토 점수·티어 문장 그림은 `js/tiers.js` (`TIERS` · `tierOf` · `placeDelta` · `tierEmblem`). 점수 배율은 `GAIN_K` · `LOSS_K`
- 실시간 랭킹은 `js/ranking.js` (서버가 없을 때): 로그인한 계정이 닉네임 · 티어 점수 · 레벨을 공개 MQTT 서버(approom.js 와 같은 서버)에 retain 메시지로 올리고, 랭킹 창은 모두의 메시지를 받아 점수 순으로 보여 줘요. `pushServer()` 가 불릴 때마다 같이 올라가요
- 계정 서버(Firebase 프로젝트 `yeongto-chess`)가 켜져 있어요 (`FIREBASE_CONFIG`, 규칙은 `firestore.rules`). 서버가 생기기 전 기기 계정은 로그인(또는 카드의 "계정을 서버로 옮기기")할 때 비밀번호가 맞으면 서버로 옮겨져요. 랭킹은 서버가 있으면 Firestore `users` 를 `pts` 순으로 실시간(onSnapshot), 서버가 안 되는 곳(아티팩트 등)에서는 공개 MQTT 로

## 화면 확인 도구 (tools/preview)
진짜 three.js 대신 간이 렌더러(`tools/preview/mini-three.js`, WebGL2)를 끼워 Playwright 로 화면을 찍어요. 외곽선·빛번짐은 안 나와요. 인자의 `.` 은 저장소 루트예요.
- `node tools/preview/combat.js .` — 전투 몇 판 돌리고 오류 확인
- `node tools/preview/view.js . out game` — 게임 화면 캡처 (`out-game.png`)
- `node tools/preview/hero.js . out.png 진성욱,이현` — 영웅 앞·옆·뒤 (끝에 `cull` 을 붙이면 면 방향 검사)
- `node tools/preview/anim.js . out.png "이현,최효민"` — 공격 동작 6장
- `node tools/preview/skillanim.js . out "이현,최효민"` — 스킬 동작 6장 (`weapons.js` 의 `SKILL_POSE`, `out.png` 로 저장)
- `node tools/preview/balance.js . 12000` — 무작위 팀끼리 전투를 많이 돌려 친구별·특성별 승률 (밸런스 조정할 때, `js/friends.js` 의 `TUNE` 을 고치고 다시 재요)
- `node tools/preview/ai.js . 200 old new 1` — 컴퓨터 반 실력 재기: 지금 AI(`game.js` 의 `aiPlan` 등) 1반 + 예전 브론즈 AI(`tools/preview/ai-old.js`) 7반으로 끝까지 돌려 평균 등수 (에메랄드 기준: 평균 2등 안팎 · 1등 60% 이상). AI 를 고치면 다시 재요
- `node tools/preview/aitier.js . 40` — 티어별 컴퓨터 반 실력 재기: 정석 AI 1반 vs 그 티어 컴퓨터 7반 평균 등수 (`game.js` 의 `AI_TIER_SKILL` · `AI_TIER_BONUS` 를 고치면 다시 재요)
- `node tools/preview/prac.js . pr` · `node tools/preview/rend2.js . rr team` — 연습장, 김예균 궁 연출

## 게임 코드 규칙
- 전투 결과는 온라인에서 모두에게 같아야 해요: 전투 계산(`battle.js`, `skills.js` 의 run/step)은 정해진 순서·전투용 난수만 쓰고, 보이는 것만 바꿀 땐 데이터 필드만 추가해요. 그림·이펙트는 `render3d.js` · `hero.js` 에서.
- 디자인은 롤/롤토체스나 다른 작품의 캐릭터·맵을 그대로 베끼지 않고, 느낌만 참고한 새 디자인으로 만들어요.
