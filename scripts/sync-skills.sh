#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
PERSONAL_SKILLS_DIR="$REPO_ROOT/skills"

STATE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/agent-skills-sync"
STATE_FILE="$STATE_DIR/state.env"
BACKUP_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/agent-skills-sync/backups"
RUNTIME_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/agent-skills-sync"

CODEx_TARGET_DIR="$HOME/.codex/skills"
AGENTS_TARGET_DIR="$HOME/.agents/skills"
CLAUDE_LINK_PATH="$HOME/.claude/skills"
CLAUDE_RUNTIME_DIR="$RUNTIME_ROOT/claude/skills"
DEFAULT_CLAUDE_BASE_SKILLS_DIR="$HOME/Desktop/bhsn/bhsn-claude-code/skills"

log() {
  printf '[skill-sync] %s\n' "$*"
}

die() {
  printf '[skill-sync] %s\n' "$*" >&2
  exit 1
}

timestamp() {
  date +"%Y%m%d-%H%M%S"
}

list_personal_skill_paths() {
  find "$PERSONAL_SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d | sort
}

write_state() {
  local claude_base="$1"
  mkdir -p "$STATE_DIR"
  printf 'CLAUDE_BASE_SKILLS_DIR=%q\n' "$claude_base" > "$STATE_FILE"
}

resolve_saved_claude_base() {
  if [[ -f "$STATE_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$STATE_FILE"
    if [[ -n "${CLAUDE_BASE_SKILLS_DIR:-}" ]]; then
      printf '%s\n' "$CLAUDE_BASE_SKILLS_DIR"
      return 0
    fi
  fi
  return 1
}

resolve_claude_base() {
  if [[ -n "${CLAUDE_BASE_SKILLS_DIR:-}" ]]; then
    printf '%s\n' "$CLAUDE_BASE_SKILLS_DIR"
    return 0
  fi

  if resolve_saved_claude_base >/dev/null; then
    resolve_saved_claude_base
    return 0
  fi

  if [[ -L "$CLAUDE_LINK_PATH" ]]; then
    local current_target
    current_target="$(readlink "$CLAUDE_LINK_PATH")"
    if [[ "$current_target" != "$CLAUDE_RUNTIME_DIR" && -d "$current_target" ]]; then
      printf '%s\n' "$current_target"
      return 0
    fi
  fi

  if [[ -d "$DEFAULT_CLAUDE_BASE_SKILLS_DIR" ]]; then
    printf '%s\n' "$DEFAULT_CLAUDE_BASE_SKILLS_DIR"
    return 0
  fi

  die "Could not determine Claude base skills directory. Set CLAUDE_BASE_SKILLS_DIR and retry."
}

backup_path() {
  local bucket="$1"
  local path="$2"
  local run_ts="$3"
  local backup_dir="$BACKUP_ROOT/$run_ts/$bucket"

  [[ -e "$path" || -L "$path" ]] || return 0

  mkdir -p "$backup_dir"
  mv "$path" "$backup_dir/"
  log "Backed up $path -> $backup_dir/"
}

replace_with_symlink() {
  local source_path="$1"
  local target_path="$2"
  local backup_bucket="$3"
  local run_ts="$4"

  if [[ -L "$target_path" ]]; then
    local current_target
    current_target="$(readlink "$target_path")"
    if [[ "$current_target" == "$source_path" ]]; then
      return 0
    fi
    backup_path "$backup_bucket" "$target_path" "$run_ts"
  elif [[ -e "$target_path" ]]; then
    backup_path "$backup_bucket" "$target_path" "$run_ts"
  fi

  ln -s "$source_path" "$target_path"
  log "Linked $target_path -> $source_path"
}

sync_personal_skills_into_target() {
  local tool_name="$1"
  local target_dir="$2"
  local run_ts="$3"

  mkdir -p "$target_dir"

  while IFS= read -r skill_path; do
    local skill_name
    skill_name="$(basename "$skill_path")"
    replace_with_symlink "$skill_path" "$target_dir/$skill_name" "$tool_name" "$run_ts"
  done < <(list_personal_skill_paths)
}

link_skill_set_into_runtime() {
  local source_dir="$1"
  local runtime_dir="$2"

  [[ -d "$source_dir" ]] || return 0

  find "$source_dir" -mindepth 1 -maxdepth 1 -type d | sort | while IFS= read -r skill_path; do
    local skill_name
    skill_name="$(basename "$skill_path")"
    rm -rf "$runtime_dir/$skill_name"
    ln -s "$skill_path" "$runtime_dir/$skill_name"
  done
}

sync_claude_overlay() {
  local run_ts="$1"
  local claude_base
  claude_base="$(resolve_claude_base)"

  write_state "$claude_base"

  rm -rf "$CLAUDE_RUNTIME_DIR"
  mkdir -p "$CLAUDE_RUNTIME_DIR"

  link_skill_set_into_runtime "$claude_base" "$CLAUDE_RUNTIME_DIR"
  link_skill_set_into_runtime "$PERSONAL_SKILLS_DIR" "$CLAUDE_RUNTIME_DIR"

  replace_with_symlink "$CLAUDE_RUNTIME_DIR" "$CLAUDE_LINK_PATH" "claude-link" "$run_ts"
}

print_status() {
  local claude_base="<unset>"
  if resolve_saved_claude_base >/dev/null; then
    claude_base="$(resolve_saved_claude_base)"
  elif [[ -L "$CLAUDE_LINK_PATH" ]]; then
    claude_base="$(readlink "$CLAUDE_LINK_PATH")"
  fi

  printf 'repo_root=%s\n' "$REPO_ROOT"
  printf 'personal_skills=%s\n' "$(list_personal_skill_paths | wc -l | tr -d ' ')"
  printf 'claude_base=%s\n' "$claude_base"
  printf 'codex_linked=%s\n' "$(find "$CODEx_TARGET_DIR" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l | tr -d ' ')"
  printf 'agents_linked=%s\n' "$(find "$AGENTS_TARGET_DIR" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l | tr -d ' ')"
  if [[ -L "$CLAUDE_LINK_PATH" ]]; then
    printf 'claude_skills_target=%s\n' "$(readlink "$CLAUDE_LINK_PATH")"
  else
    printf 'claude_skills_target=<not-a-symlink>\n'
  fi
}

restore_claude_base() {
  local claude_base
  claude_base="$(resolve_claude_base)"
  local run_ts
  run_ts="$(timestamp)"
  replace_with_symlink "$claude_base" "$CLAUDE_LINK_PATH" "claude-link" "$run_ts"
}

main() {
  local command="${1:-sync}"

  [[ -d "$PERSONAL_SKILLS_DIR" ]] || die "Missing personal skills directory: $PERSONAL_SKILLS_DIR"

  case "$command" in
    sync)
      local run_ts
      run_ts="$(timestamp)"
      sync_personal_skills_into_target "codex" "$CODEx_TARGET_DIR" "$run_ts"
      sync_personal_skills_into_target "agents" "$AGENTS_TARGET_DIR" "$run_ts"
      sync_claude_overlay "$run_ts"
      ;;
    status)
      print_status
      ;;
    restore-claude-base)
      restore_claude_base
      ;;
    *)
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
