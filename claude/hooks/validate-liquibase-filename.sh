#!/bin/bash
# PreToolUse — block Write/Edit of liquibase changelog files whose filename
# doesn't start with a 14-digit YYYYMMDDHHMMSS timestamp. Master/root files
# and non-liquibase files pass through.
set -eu

INPUT=$(cat)
FILE=$(echo "$INPUT" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input?.file_path ?? ''" 2>/dev/null || echo "")

# Not a file operation we care about
[ -z "$FILE" ] && exit 0

# Only apply to liquibase changelog XMLs
case "$FILE" in
  */liquibase/*.xml|*/liquibase/*/*.xml|*/liquibase/*/*/*.xml) ;;
  *) exit 0 ;;
esac

BASENAME=$(basename "$FILE")

# Allow well-known root/master files
case "$BASENAME" in
  master.xml|changelog.xml|db.changelog-master.xml|data.xml|authorities.xml|users.xml) exit 0 ;;
esac

# Check YYYYMMDDHHMMSS_ prefix (14 digits + underscore, followed by .+.xml)
if echo "$BASENAME" | grep -Eq '^[0-9]{14}_.+\.xml$'; then
  exit 0
fi

REASON="Liquibase changelog filename '${BASENAME}' must start with a 14-digit YYYYMMDDHHMMSS timestamp (e.g., 20260417120000_create_invoice.xml). See .claude/rules/liquibase.md for the naming rule."

# Escape for JSON
ESC=$(printf '%s' "$REASON" | sed 's/\\/\\\\/g; s/"/\\"/g')

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$ESC"
