---
name: dora-upgrade
description: |
  Upgrade dora to the latest version.
  Trigger: /dora:dora-upgrade
user-invocable: true
---

# dora upgrade

## Step 1
Call MCP tool `dora_upgrade` with `{}`. Response: `{shell: "<command>"}`.

## Step 2
Run the returned shell command using Bash.

## Step 3
Display results as a markdown checklist:

```
## dora upgrade
- [x] Updated plugin to latest version
- [ ] Restart Claude Code to apply the update
```

Use `[x]` for success, `[ ]` for pending/failure.

## Step 4
Tell the user: **restart Claude Code** (or run `/reload-plugins`) to load the newly installed version.
