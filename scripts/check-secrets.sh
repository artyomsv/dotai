#!/usr/bin/env bash
# Blocks secrets and private infrastructure details from entering this public repository.
#
#   check-secrets.sh --staged   scan the staged content (the pre-commit hook runs this)
#   check-secrets.sh --all      scan every tracked and untracked, non-ignored file (CI runs this)
#
# A line that is not sensitive can opt out with the marker "secret-scan: allow".
set -u

mode="${1:---staged}"
cd "$(git rev-parse --show-toplevel)" || exit 2

private_ip='(^|[^0-9.])(10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})([^0-9]|$)'
private_key='BEGIN [A-Z ]*PRIVATE KEY'
tokens='gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}'
email='[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
private_host='[a-z0-9-]+\.private\.[a-z]'
pattern="$private_ip|$private_key|$tokens|$email|$private_host"

allow='secret-scan: allow|noreply@|@example\.(com|org|net)|git@github\.com|@users\.noreply\.github\.com'

case "$mode" in
  --staged) files=$(git diff --cached --name-only --diff-filter=ACMR) ;;
  --all) files=$(git ls-files --cached --others --exclude-standard) ;;
  *) echo "usage: $0 [--staged|--all]" >&2; exit 2 ;;
esac

found=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if [ "$mode" = --staged ]; then
    hits=$(git show ":$f" | grep -n -I -i -E "$pattern" | grep -v -i -E "$allow")
  else
    [ -f "$f" ] || continue
    hits=$(grep -n -I -i -E "$pattern" -- "$f" | grep -v -i -E "$allow")
  fi
  [ -n "$hits" ] || continue
  found=1
  if [ -n "${CI:-}" ]; then
    # Public CI logs: name the line, never print the value.
    printf '%s\n' "$hits" | cut -d: -f1 | sed "s|^|$f:|"
  else
    printf '%s\n' "$hits" | sed "s|^|$f:|"
  fi
done <<< "$files"

if [ "$found" -ne 0 ]; then
  cat >&2 <<'EOF'

Blocked: the lines above look like a secret, an email or private infrastructure.
Move the value to a local file outside the repository (see claude/commands/fix-kubectl.md),
or, if it is not sensitive, add "secret-scan: allow" to that line.
EOF
  exit 1
fi
echo "check-secrets: clean ($mode)"
