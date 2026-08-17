#!/bin/zsh
# launchd 등록 — 매일 08:00 (맥이 자고 있으면 깨어난 뒤 바로 실행된다. cron 과 다른 점)
#   해제: launchctl bootout gui/$(id -u)/kr.dangmalsa.daily-quiz ; rm ~/Library/LaunchAgents/kr.dangmalsa.daily-quiz.plist
#   바로 한 번 실행: launchctl kickstart -k gui/$(id -u)/kr.dangmalsa.daily-quiz
HOUR=${1:-8}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST=~/Library/LaunchAgents/kr.dangmalsa.daily-quiz.plist
mkdir -p ~/Library/LaunchAgents
cat > "$PLIST" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>kr.dangmalsa.daily-quiz</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$ROOT/scripts/daily-quiz.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>StandardOutPath</key><string>$ROOT/out/video/daily/launchd.out</string>
  <key>StandardErrorPath</key><string>$ROOT/out/video/daily/launchd.err</string>
</dict></plist>
XML
launchctl bootout gui/$(id -u)/kr.dangmalsa.daily-quiz 2>/dev/null
launchctl bootstrap gui/$(id -u) "$PLIST" && echo "등록됨: 매일 ${HOUR}:00 → $ROOT/out/video/daily/" && launchctl list | grep dangmalsa
