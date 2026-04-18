#!/bin/bash
# SessionStart — inject techdebt summary into context if techdebt/ exists in project
set -eu

TECHDEBT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/techdebt"
[ -d "$TECHDEBT_DIR" ] || exit 0

CRIT=$(find "$TECHDEBT_DIR" -maxdepth 2 -name "1-*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
HIGH=$(find "$TECHDEBT_DIR" -maxdepth 2 -name "2-*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
MED=$( find "$TECHDEBT_DIR" -maxdepth 2 -name "3-*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
LOW=$( find "$TECHDEBT_DIR" -maxdepth 2 -name "4-*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((CRIT + HIGH + MED + LOW))
[ "$TOTAL" -eq 0 ] && exit 0

# Build the context string with literal \n sequences (ready for JSON embedding).
# Any filename character that would break JSON (backslash, quote) is pre-escaped.
escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

CTX='## Tech debt in this repo\n\n| Criticality | Count |\n|---|---|\n'
CTX="${CTX}| Critical (1-*) | ${CRIT} |\n"
CTX="${CTX}| High (2-*) | ${HIGH} |\n"
CTX="${CTX}| Medium (3-*) | ${MED} |\n"
CTX="${CTX}| Low (4-*) | ${LOW} |\n"

TOP_LIST=$(find "$TECHDEBT_DIR" -maxdepth 2 \( -name "1-*.md" -o -name "2-*.md" \) -type f 2>/dev/null \
           | sort | head -n 5 | xargs -I{} basename {} .md 2>/dev/null || true)

if [ -n "$TOP_LIST" ]; then
  CTX="${CTX}\nTop critical + high items:\n"
  while IFS= read -r item; do
    [ -z "$item" ] && continue
    SAFE=$(escape "$item")
    CTX="${CTX}- ${SAFE}\n"
  done <<< "$TOP_LIST"
fi

CTX="${CTX}\nSee \`techdebt/\` directory. Naming: \`{criticality}-{complexity}-{description}.md\` (rule: ~/.claude/rules/tech-debt-tracking.md)."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$CTX"
