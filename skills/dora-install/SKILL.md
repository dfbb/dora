---
name: dora-install
description: |
  Move a cached dora skill into the current platform's system skills directory.
  Accepts `<skill> [platform]` as $ARGUMENTS.
  Trigger: /dora:dora-install <skill> [platform]
user-invocable: true
---

# dora install

把 dora 缓存里的某个 skill 移动到当前平台的系统 skills 目录,并修正目录层次让 SKILL.md 落在顶层。

## Step 1 — No arguments?

If `$ARGUMENTS` is empty: call MCP tool `dora_list` with `{}`, display the returned table verbatim, then stop.

## Step 2 — Parse arguments

Split `$ARGUMENTS` on whitespace. First token = `name`. Optional second token = `platform` (one of: claude-code, codex, opencode, gemini-cli, qwen-code).

## Step 3 — Install

Call MCP tool `dora_install` with `{name, platform}` (omit `platform` if not given).

## Step 4 — Report

Branch on the returned JSON:

- `ok: true`, `cache_removed: true` → 「已把 `<skill_name>` 装到 `<platform>` 的 `<target_path>`,并清理了 dora 缓存。重启会话后可用。」
- `ok: true`, `cache_removed: false` → 「已把 `<skill_name>` 装到 `<platform>` 的 `<target_path>`,但清理缓存失败(`<cache_cleanup_error>`)。skill 已可用;残留缓存可用 `/dora:dora-purge` 清理。」
- `skipped: true` → 「`<target_path>` 已存在,未改动。如需重装请先删除该目录。」
- `error: "ambiguous"` → 列出 `candidates`,提示用完整 key(`<name>_<owner>`)重试。
- `error: "not_cached"` → 提示先用 `/dora:dora <任务>` 加载该 skill。
- `error: "platform_unknown"` → 提示加平台参数(claude-code/codex/opencode/gemini-cli/qwen-code)或设置 `DORA_PLATFORM` 环境变量。
- `error: "invalid_skill_path"` 或 `"invalid_skill_name"` → 提示缓存条目的路径或名称异常(status.yaml 可能损坏),建议 `/dora:dora-purge` 后重新加载。
- 其它(含 `error: "internal"`)→ 安装未完成,把返回的 `message` 原样报告给用户;缓存与 status 未改动,可直接重试。
