---
name: dora
description: |
  Query and load a community skill matching the user's task, then execute it.
  Accepts free-form text as $ARGUMENTS.
  Trigger: /dora:dora <task description>
user-invocable: true
---

# dora — load & run community skill

**Execute immediately. Do not ask. Do not show menus.**

## Step 1 — No arguments?

If `$ARGUMENTS` is empty: call MCP tool `dora_list` with `{}`, display the returned table verbatim, then stop.

## Step 1.5 — Translate to English

If `$ARGUMENTS` contains any non-ASCII characters, translate it to English yourself (do not call any API or tool — just translate inline as part of your reasoning). Use the translated English text as `QUERY` for all subsequent steps. Otherwise set `QUERY` = `$ARGUMENTS`.

## Step 1.6 — Check for `local:` prefix

If `QUERY` starts with `local:` (case-insensitive), strip the prefix and set `LOCAL_ONLY` = true. Otherwise set `LOCAL_ONLY` = false.

## Step 2 — Query

Call MCP tool `dora_query` with `{query: "QUERY", local_only: LOCAL_ONLY}`.

- Response has `{error, message}` → relay message to user, then suggest `/dora:dora-doctor`. Stop.
- Response has `{skills: [...]}` → continue.

## Step 3 — Pick candidate

Read `min_security_level` from `~/.dora/config.yaml` (or `./.dora/config.yaml`), default `warn`. Ordering: `safe < warn < danger`. Take the first skill whose `security_level` is **no more dangerous than** the threshold (i.e. skip only `danger` skills unless threshold is `danger`).

If none qualify, render this markdown table and ask the user to pick by name (or abort). **Do not auto-select below threshold.**

| name | description_en | github_stars | security_level |
|---|---|---|---|

Record the chosen skill's `name`, `url`, `security_level`.

## Step 4 — Load

Call MCP tool `dora_load` with `{name, repo_url: url, security_level}`.

- Response has `{error: "validation"|"clone_failed"|"no_skill_md", message}` → relay message, stop.
- Response has `{key, skill_md_path, cache_hit}` → continue.

## Step 5 — Execute

Use the Read tool to load `skill_md_path` into context. Then **follow that SKILL.md as if it were your active instructions** to accomplish $ARGUMENTS. The loaded skill may reference files in the same repo via relative paths — they are accessible at the parent directory of `skill_md_path`.

## Step 6 — Touch

Whether or not step 5 succeeded, call MCP tool `dora_touch` with `{key}`. This updates last_used_at and increments use_count.
