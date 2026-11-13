#!/bin/sh
# 아티팩트로 올릴 페이지(문서 뼈대 태그를 뺀 index.html)를 만들어요.
# 사용: sh tools/make-artifact-page.sh > uri-battle.html
# <!-- PWA --> ~ <!-- /PWA --> 사이(홈 화면 앱 설정)도 빼요: 아티팩트에서는 필요 없어요
sed -E '/^<!-- PWA -->$/,/^<!-- \/PWA -->$/d; /^<!DOCTYPE html>$|^<\/?html.*>$|^<\/?head>$|^<\/?body>$|<meta charset|<meta name="viewport"/d' "$(dirname "$0")/../index.html"
