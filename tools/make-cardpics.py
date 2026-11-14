# 카드 사진 몇 장을 JS 파일 안에 글자(data URL)로 넣어요 → js/cardpics.js
# claude.ai 아티팩트에서 새로 올린 cards/*.jpg 가 일부 기기에서 안 받아져서, 그 사진들은 JS 로 같이 보내요
# 사용: python3 tools/make-cardpics.py <id> <id> ...   (id = cards/<id>.jpg)
import sys, base64, os
root = os.path.join(os.path.dirname(__file__), "..")
lines = ["// 자동으로 만든 파일이에요 (tools/make-cardpics.py). 직접 고치지 마세요",
         "// 새로 넣은 카드 사진: cards/<id>.jpg 대신 이 글자 그림을 써요 (photos.js 의 cardUrl)",
         '"use strict";', "const CARD_PICS = {"]
for i in sys.argv[1:]:
    b = base64.b64encode(open(os.path.join(root, "cards", i + ".jpg"), "rb").read()).decode()
    lines.append(f'  "{i}": "data:image/jpeg;base64,{b}",')
lines.append("};")
open(os.path.join(root, "js", "cardpics.js"), "w").write("\n".join(lines) + "\n")
