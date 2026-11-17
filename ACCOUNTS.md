# 계정 서버 연결 (Firebase)

계정 기능(`js/account.js`)은 서버 없이도 "이 기기 안 계정"으로 돌아가요.
아래를 한 번 해 두면 어느 기기에서나 같은 아이디로 로그인하고, 친구들 순위도 볼 수 있어요. (무료 요금제로 충분해요)

1. https://console.firebase.google.com 에서 **프로젝트 추가** (이름 예: yeongto-chess, 애널리틱스는 꺼도 돼요)
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → 이메일/비밀번호** 사용 설정
   (아이디는 `아이디@yeongto-chess.app` 모양으로 저장돼요. 실제 메일은 안 가요)
3. **빌드 → Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3` 서울, 프로덕션 모드)
   → **규칙** 탭에 저장소의 `firestore.rules` 내용을 붙여 넣고 게시
4. **Authentication → 설정 → 승인된 도메인**에 `choehyomin652-collab.github.io` 추가
5. **프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹(</>)** 으로 앱 등록 → 나오는 `firebaseConfig = { ... }` 를 복사
6. `js/account.js` 맨 위 `const FIREBASE_CONFIG = null;` 의 `null` 자리에 붙여 넣기 (이 값은 비밀이 아니라 공개돼도 괜찮아요. 안전은 3번 규칙이 지켜요)

- 비밀번호를 잊으면 찾을 수 없어요 (메일이 없어서). 필요하면 콘솔 Authentication 에서 그 사용자를 지우고 다시 만들어요
- claude.ai 아티팩트 안에서는 바깥 서버 연결이 막힐 수 있어요. 그러면 홈 화면 앱에서 로그인해 주세요
