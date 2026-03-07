#!/bin/bash
# Send a desktop notification when Claude asks a question (Windows)
# Clicking the notification brings the terminal window to focus
INPUT=$(cat)
QUESTION=$(echo "$INPUT" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input?.question ?? 'Claude has a question'" 2>/dev/null | head -c 200)

powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -File "$HOME/.claude/hooks/notify-question.ps1" \
  -Question "$QUESTION" \
  -BashPid $$ 2>/dev/null
