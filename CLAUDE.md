# Claude 작업 규칙

## 고칠 때마다 아티팩트도 업데이트
게임 코드를 고쳐서 커밋했으면, 매번 "우리반 오토배틀" 아티팩트도 같은 주소로 다시 올려요 (사용자가 요청한 규칙).

- 아티팩트 주소: https://claude.ai/artifact/GvQxrfNwby1qCz7pudz6CE
- 페이지 만들기: `sh tools/make-artifact-page.sh > <스크래치패드>/uri-battle.html`
- 올리기: Artifact publish 에 `url` = 위 주소, `file_path` = 만든 페이지, `files` = 이번에 바뀐 `style.css` · `js/*.js` 만 (published 경로와 저장소 경로가 같아요. 빠진 파일은 아티팩트에 있던 그대로 남아요)
- 전부 다시 올리지 않는 이유: 다른 계정이 아티팩트에서 직접 `js/photos.js` 를 고쳐 왔어요 (미리 넣은 카드 사진). 저장소의 `photos.js` 는 그보다 옛날 버전이라, 올리면 그 사진이 사라져요. `photos.js` 를 고쳐야 하면 먼저 아티팩트의 것을 읽어서 합친 뒤 올려요
- 올리다가 "newer version" 으로 거절되면, 다른 곳에서 바뀐 파일이 내가 이번에 올리는 파일과 겹치는지 확인하고, 겹치지 않으면 그대로 다시 올려요
- `capabilities` 는 빼고 올려요 (사진 저장 db 규칙 · 온라인 room 설정을 그대로 유지)
- 새 JS 파일을 추가했다면 `index.html` 의 `<script>` 와 `files` 목록에도 넣어요
