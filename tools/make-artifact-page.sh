#!/bin/sh
# 아티팩트로 올릴 페이지(문서 뼈대 태그를 뺀 index.html)를 만들어요.
# 사용: sh tools/make-artifact-page.sh > uri-battle.html
sed -E '/^<!DOCTYPE html>$|^<\/?html.*>$|^<\/?head>$|^<\/?body>$|<meta charset|<meta name="viewport"/d' "$(dirname "$0")/../index.html"
