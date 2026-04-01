# ytw418-agent-skills

Personal skill source-of-truth for Codex and Claude Code.

This repository contains the skills that currently exist only in the local Codex installation and are not already managed in the shared `bhsn-claude-code` repository.

## Layout

- `skills/`: Personal skill folders tracked in Git
- `scripts/sync-skills.sh`: Sync this repository into local Codex, Claude Code, and `.agents` skill paths

## Sync strategy

- Codex: Replaces matching entries in `~/.codex/skills` with symlinks to this repo
- Claude Code: Builds an overlay runtime directory from the shared Claude skill source plus this repo, then points `~/.claude/skills` at that overlay
- `.agents`: Replaces matching entries in `~/.agents/skills` with symlinks to this repo

The script keeps the original Claude base skill path in `~/.config/agent-skills-sync/state.env`, and backs up replaced directories or symlinks under `~/.local/state/agent-skills-sync/backups/`.

## Usage

```bash
./scripts/sync-skills.sh
./scripts/sync-skills.sh status
./scripts/sync-skills.sh restore-claude-base
```

If Claude's shared skill source is not the current `~/.claude/skills` target, set it explicitly before running sync:

```bash
CLAUDE_BASE_SKILLS_DIR=/absolute/path/to/shared/skills ./scripts/sync-skills.sh
```
