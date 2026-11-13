# Claude 작업 규칙

## 고칠 때마다 아티팩트도 업데이트
게임 코드를 고쳐서 커밋했으면, 매번 "우리반 오토배틀" 아티팩트도 같은 주소로 다시 올려요 (사용자가 요청한 규칙).

- 아티팩트 주소: https://claude.ai/artifact/GvQxrfNwby1qCz7pudz6CE
- 페이지 만들기: `sh tools/make-artifact-page.sh > <스크래치패드>/uri-battle.html`
- 올리기: Artifact publish 에 `url` = 위 주소, `file_path` = 만든 페이지, `files` = `style.css` 와 `js/*.js` 전부 (published 경로와 저장소 경로가 같아요)
- `capabilities` 는 빼고 올려요 (사진 저장 db 규칙 · 온라인 room 설정을 그대로 유지)
- 새 JS 파일을 추가했다면 `index.html` 의 `<script>` 와 `files` 목록에도 넣어요
