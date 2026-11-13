#!/bin/sh
# ============================================================
#  build-app.sh — 진짜 앱(Capacitor · Cordova 등)에 넣을 www/ 폴더를 만들어요
#  · 게임 파일(index.html · style.css · js · icons)을 복사하고
#  · 인터넷(CDN)에서 받던 라이브러리(three.js · mqtt)를 www/vendor/ 에 넣어서 인터넷 없이도 열리게 해요
#  · 홈 화면 앱(PWA) 설정은 진짜 앱에서는 필요 없어서 빼요
#  사용: sh tools/build-app.sh   (npm 이 필요해요. 결과: 저장소의 www/ 폴더)
# ============================================================
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/www"
TMP=$(mktemp -d)
[ -n "$ROOT" ] && [ -d "$ROOT/js" ] || { echo "저장소 폴더를 못 찾았어요"; exit 1; }

rm -rf "$ROOT/www"
mkdir -p "$OUT/vendor/three/examples/js/environments" "$OUT/vendor/three/examples/js/shaders" "$OUT/vendor/three/examples/js/postprocessing"
cp -R "$ROOT/style.css" "$ROOT/js" "$ROOT/icons" "$OUT/"

# 라이브러리 받기 (index.html 과 같은 버전)
( cd "$TMP" && npm pack -s three@0.128.0 mqtt@5.10.1 >/dev/null && tar xzf three-0.128.0.tgz && mv package three && tar xzf mqtt-5.10.1.tgz && mv package mqtt )
cp "$TMP/three/build/three.min.js" "$OUT/vendor/three/"
for f in environments/RoomEnvironment.js shaders/CopyShader.js shaders/LuminosityHighPassShader.js postprocessing/EffectComposer.js postprocessing/RenderPass.js postprocessing/ShaderPass.js postprocessing/UnrealBloomPass.js; do
  cp "$TMP/three/examples/js/$f" "$OUT/vendor/three/examples/js/$f"
done
cp "$TMP/mqtt/dist/mqtt.min.js" "$OUT/vendor/mqtt.min.js"
rm -rf "$TMP"

# index.html: PWA 부분 빼기 + CDN 주소를 앱 안 파일로
sed -E '/^<!-- PWA -->$/,/^<!-- \/PWA -->$/d' "$ROOT/index.html" \
  | sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#vendor/three/three.min.js#' \
        -e 's#https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/#vendor/three/examples/js/#' > "$OUT/index.html"
# 온라인(친구와 같이 하기)에서 쓰는 mqtt 도 앱 안 파일로
sed -i.bak 's#https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js#vendor/mqtt.min.js#' "$OUT/js/approom.js" && rm -f "$OUT/js/approom.js.bak"

echo "완료: $OUT"
echo "  (글꼴 Jua · Gowun Dodum 은 인터넷이 있을 때만 받아요. 없으면 기기 기본 글꼴로 보여요)"
