#!/usr/bin/env bash
# Links dotai content into each AI tool's home folder, as listed in links/*.links (Linux, macOS).
#
#   install.sh [--dry-run] [--uninstall] [--home DIR] [tool...]
#
# Nothing is deleted: a real file or folder in the way is moved to ~/.dotai-backup/<timestamp>/.
# Safe to run again. --uninstall removes only links that point into this repository and restores
# the newest backup. On Windows use scripts/install.ps1: Git Bash "ln -s" silently copies.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
stamp="$(date +%Y%m%d-%H%M%S)"
dry_run=0 uninstall=0 home_dir="$HOME" tools=() failed=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=1 ;;
    --uninstall) uninstall=1 ;;
    --home) home_dir="$2"; shift ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) tools+=("$1") ;;
  esac
  shift
done

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) echo "On Windows run scripts/install.ps1 instead." >&2; exit 2 ;;
esac

# Backups go to their own folder, never next to the target: a tool that loads every subfolder
# (like ~/.codex/skills) would otherwise load the backup as a second copy.
backup_root="$home_dir/.dotai-backup"
backup_path() { # backup_path <target> <run>
  local rel="${1#"$home_dir"/}"
  [ "$rel" = "$1" ] && rel="${1#/}"
  echo "$backup_root/$2/$rel"
}

backup() { mkdir -p "$(dirname "$2")" && mv "$1" "$2"; }

act() { # act <message> <command...>
  local message="$1"; shift
  if [ "$dry_run" -eq 1 ]; then echo "[dry-run] $message"; else "$@"; echo "$message"; fi
}

for manifest in "$repo"/links/*.links; do
  tool="$(basename "$manifest" .links)"
  if [ ${#tools[@]} -gt 0 ] && [[ ! " ${tools[*]} " == *" $tool "* ]]; then continue; fi
  echo "== $tool"
  while read -r src dst _; do
    case "$src" in ''|'#'*) continue ;; esac
    source="$repo/$src"
    target="${dst/#\~/$home_dir}"
    current=""
    [ -L "$target" ] && current="$(readlink -f "$target" || true)"

    if [ "$uninstall" -eq 1 ]; then
      if [ -z "$current" ] || [ "$current" != "$(readlink -f "$source")" ]; then echo "skip     $target (not a dotai link)"; continue; fi
      act "unlinked $target" rm "$target"
      for run in $(ls -1 "$backup_root" 2>/dev/null | sort -r); do
        saved="$(backup_path "$target" "$run")"
        if [ -e "$saved" ] || [ -L "$saved" ]; then act "restored $target from $saved" mv "$saved" "$target"; break; fi
      done
      continue
    fi

    if [ ! -e "$source" ]; then echo "MISSING  $source"; failed=$((failed + 1)); continue; fi
    if [ -n "$current" ] && [ "$current" = "$(readlink -f "$source")" ]; then echo "ok       $target"; continue; fi

    if [ -e "$target" ] || [ -L "$target" ]; then
      saved="$(backup_path "$target" "$stamp")"
      act "backup   $target -> $saved" backup "$target" "$saved"
    fi
    [ -d "$(dirname "$target")" ] || act "mkdir    $(dirname "$target")" mkdir -p "$(dirname "$target")"
    act "linked   $target -> $source" ln -s "$source" "$target"
  done < "$manifest"
done

if [ "$uninstall" -eq 0 ] && [ "$dry_run" -eq 0 ]; then git -C "$repo" config core.hooksPath .githooks; fi
if [ "$failed" -gt 0 ]; then echo "$failed link(s) not created"; exit 1; fi
