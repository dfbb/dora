# dora

> Dynamically query and load community skills for AI coding agents.

## What it does

When the user gives you a task you don't already know how to do, dora queries a public skill engine, picks a matching skill, clones it from GitHub, and loads its `SKILL.md` into your context. Cache is on disk; lookups are TTL'd; the agent never holds the full skill catalog in context. When the remote skill engine is unreachable or returns 5xx/429, dora automatically falls back to an in-memory BM25 search over a bundled snapshot of ~9.5k community skills.

## Install

<details open>
<summary><strong>Claude Code</strong> — plugin marketplace, fully automatic</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Restart Claude Code (or run `/reload-plugins`).

| Slash Command | What it does |
|---|---|
| `/dora:dora <task>` | Query, pick, load, run a skill. No args → list cached. |
| `/dora:dora-stats` | Usage stats. |
| `/dora:dora-doctor` | Diagnostics. |
| `/dora:dora-upgrade` | Upgrade dora itself. |
| `/dora:dora-purge` | Delete all cached skills. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g dora
dora install:codex
```

Adds MCP server to `~/.codex/config.toml` and SessionStart hook to `~/.codex/hooks.json`.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g dora
dora install:cursor
```

Writes `.cursor/mcp.json` (merged) and `.cursor/rules/dora.mdc`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g dora
dora install:opencode
```

Writes `opencode.json` (merged) and `AGENTS.md`.

</details>

## Configuration

`~/.dora/config.yaml` (or `./.dora/config.yaml` for project-local):

```yaml
skill_query_url: http://127.0.0.1:8080   # query engine URL
min_security_level: safe                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Commands

```
dora query <text>              Search skill engine
dora load <name> <url> <lvl>   Clone and cache a skill
dora touch <key>               Mark cached skill used
dora list                      List cached skills
dora stats                     Usage stats
dora doctor                    Diagnostics
dora upgrade                   Upgrade dora
dora purge --yes               Wipe all cached skills
dora mcp                       Start MCP stdio server
dora install:<platform>        Write platform config
```

## Data

- Cache: `~/.dora/skills/<name>_<owner>/`
- Status: `~/.dora/skills/status.yaml`
- Query log: `~/.dora/query-log.jsonl`
- Config: `~/.dora/config.yaml` (not deleted by purge)

## Offline Fallback

`dora_query` automatically falls back to a local catalog when the remote engine is unreachable.

- **Triggers:** `engine_unreachable` (network/timeout) or `http_error` with status ≥ 500 or status === 429. Other 4xx errors are returned to the caller as-is so configuration/auth issues are not hidden.
- **Catalog:** ~9,465 skills, bundled into the npm package (no extra download).
- **Result shape:** identical to remote (`{skills: [...]}`) plus a `source: "remote" | "local"` field on the returned JSON.
- **Diagnostics:** `dora_doctor` includes a `local index` check.

Empty results from the remote engine (`empty_candidates`) are NOT a fallback trigger — if the remote service explicitly says no match, dora trusts that answer.

## License

MIT
