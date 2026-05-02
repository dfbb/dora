---
name: dora-purge
description: |
  Permanently delete all cached dora skills. Irreversible.
  Trigger: /dora:dora-purge
user-invocable: true
---

# dora purge

## Step 1 — Warn

This is irreversible. Tell the user the following will be deleted:
- All cached skill repos under `<DORA_HOME>/skills/*_*/`
- `<DORA_HOME>/skills/status.yaml` (reset to empty)
- `<DORA_HOME>/query-log.jsonl`

`<DORA_HOME>/config.yaml` is **not** deleted.

## Step 2 — Confirm and purge

Call MCP tool `dora_purge` with `{confirm: true}`.

## Step 3 — Report

Response: `{deleted_skills: <n>, deleted_query_log: <bool>}`. Show:
> Deleted `<n>` skill repos and reset status.yaml.
