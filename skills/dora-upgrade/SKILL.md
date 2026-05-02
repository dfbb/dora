---
name: dora-upgrade
description: |
  Upgrade dora to the latest version, then re-run doctor.
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
- [x] Pulled latest
- [x] Built and installed v<new-version>
- [x] doctor: all checks PASS
```

Use `[x]` for success, `[ ]` for failure.

## Step 4
Tell the user to **restart their session** to pick up the new version.
