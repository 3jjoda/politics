#!/bin/zsh
# 사람 퀴즈 쇼츠 하루 한 편 — launchd 가 매일 아침 부른다 (맥 로컬 전용: 크롬·ffmpeg·edge-tts 가 여기 있다)
#   산출물: out/video/daily/<날짜>-person-<이름>.mp4 + .txt(제목·설명) → 유튜브 스튜디오에 드래그
#   설치: scripts/install-daily-quiz.sh  (launchd plist 등록)   로그: out/video/daily/log.txt
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | sort -V | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
mkdir -p out/video/daily
{
  echo "=== $(date '+%F %T') ==="
  node batch/genQuizVideo.js --ep person --daily out/video/daily
} >> out/video/daily/log.txt 2>&1
