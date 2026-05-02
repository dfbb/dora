---
name: dora-doctor
description: |
  Run dora diagnostics. Checks Node version, git, $DORA_HOME writable,
  config.yaml, query engine reachability, status.yaml consistency,
  MCP server registration, SessionStart hook installation.
  Trigger: /dora:dora-doctor
user-invocable: true
---

# dora doctor

Call MCP tool `dora_doctor` with `{}`. Display the returned markdown checklist verbatim. Each line uses `[x]` PASS, `[ ]` FAIL, `[-]` WARN.

If any check is FAIL, briefly suggest the next step (e.g., for engine unreachable: "Set `skill_query_url` in `~/.dora/config.yaml` to your engine URL.").
