# README Multilingual Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite README.md with a user-value-first structure and create 6 translated versions (zh, ja, kr, fr, es, de), keeping all technical details intact.

**Architecture:** Single source of truth is README.md (English). All 6 language files mirror its structure exactly; only explanatory prose is translated, technical terms (commands, config keys, paths) stay in English. Language nav links appear at the top of every file.

**Tech Stack:** Markdown only. No code changes. No tests needed.

---

## File Map

| Action | File |
|---|---|
| Overwrite | `README.md` |
| Create | `README.zh.md` |
| Create | `README.ja.md` |
| Create | `README.kr.md` |
| Create | `README.fr.md` |
| Create | `README.es.md` |
| Create | `README.de.md` |
| Update | `memory/feedback_readme_sync.md` (in project memory dir) |

---

## Shared README Structure (all 7 files follow this skeleton)

```
# dora
<lang-nav-line>
> <tagline>

## <Why dora? / 为什么用 dora？ / etc.>
4 bullet points (🔒⚡📦🌐)

## <How it works / dora 如何工作 / etc.>
5-step numbered list

## Install / 安装 / etc.
Platform details blocks (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, OpenClaw, Qwen Code)

## Usage / 使用 / etc.
Slash command table

## Cross-Platform Adapter / 跨平台适配 / etc.

## Offline Fallback / 离线回退 / etc.

## Configuration / 配置 / etc.
config.yaml block

## Commands / CLI 命令 / etc.
dora subcommand list

## Data / 数据存储路径 / etc.

## License
```

Language nav line format — active language is plain text, others are links:
- In README.md (English is active): `[中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)`
- In README.zh.md (中文 is active): `English ([README.md](README.md)) · 中文 · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)`
- (Same pattern for others — active language unlinked)

---

## Task 1: Rewrite README.md (English)

**Files:**
- Overwrite: `README.md`

- [ ] **Step 1: Write the new README.md**

Full content:

```markdown
# dora

[中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> A community skill marketplace for AI coding agents — safe, zero-install, offline-ready.

## Why dora?

- 🔒 **GitHub-only downloads**: Every skill is publicly auditable. Each has a security level (`safe` / `warn` / `danger`) — set your threshold and dora filters automatically.
- ⚡ **Zero token overhead**: Skills load on demand. They don't occupy your context window until you actually need them.
- 📦 **No manual installs**: One command to search and clone — no pre-installing skills.
- 🌐 **Offline-ready**: A bundled catalog of ~9,500 skills ships with dora. If the remote engine is unreachable, dora falls back automatically.

## How it works

1. **Query** — Describe your task; dora queries [skills.sh](https://skills.sh) for matching community skills
2. **Download** — The matched skill is cloned from its **GitHub repository** into a local cache
3. **Security check** — Each skill has a security level (`safe` / `warn` / `danger`); dora filters by your configured threshold
4. **Execute** — The skill's `SKILL.md` is loaded into the AI's context and the agent follows its instructions
5. **Offline fallback** — If `api.doraskill.org` is unreachable, dora automatically switches to a local BM25 index (~9,500 skills, bundled — no download needed)

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
| `/dora:dora local: <task>` | Same, but search local index only (skip remote engine). |
| `/dora:dora-stats` | Usage stats. |
| `/dora:dora-doctor` | Diagnostics. |
| `/dora:dora-upgrade` | Upgrade dora itself. |
| `/dora:dora-purge` | Delete all cached skills. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Merges MCP server into `~/.codex/config.toml` (TOML deep merge, `.bak` backup), SessionStart hook into `~/.codex/hooks.json`, and appends routing to `~/.codex/AGENTS.md`.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

Writes `.cursor/mcp.json` (deep merged) and `.cursor/rules/dora.mdc`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Writes `opencode.json` (deep merged) and appends routing to `AGENTS.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Merges MCP server into `~/.gemini/settings.json` and appends routing to `GEMINI.md`.

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

Merges MCP config into `openclaw.json`.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Merges MCP server into `settings.json`.

</details>

## Cross-Platform Adapter

dora detects which CLI platform is running and adapts skill loading automatically.

**Detection priority:** `DORA_PLATFORM` env override → MCP clientInfo → environment signals → fallback.

When `dora_load` returns a non-null `execution_context`, the agent outputs it before running the skill — this includes tool name mappings (e.g. `Read` → `read_file` on Gemini CLI) or compatibility warnings for unverified platforms.

Supported platforms: `claude-code`, `codex`, `cursor`, `opencode`, `gemini-cli`, `qwen-code`, `openclaw`.

## Offline Fallback

`dora_query` automatically falls back to a local catalog when the remote engine is unreachable.

- **Triggers:** `engine_unreachable` (network/timeout) or `http_error` with status ≥ 500 or status === 429. Other 4xx errors are returned to the caller as-is so configuration/auth issues are not hidden.
- **Force local:** Pass `local_only: true` to `dora_query` (or use `/dora:dora local: <task>`) to skip the remote engine entirely.
- **Catalog:** ~9,465 skills, bundled into the npm package (no extra download).
- **Result shape:** identical to remote (`{skills: [...]}`) plus a `source: "remote" | "local"` field on the returned JSON.
- **Diagnostics:** `dora_doctor` includes a `local index` check.

Empty results from the remote engine (`empty_candidates`) are NOT a fallback trigger — if the remote service explicitly says no match, dora trusts that answer.

## Configuration

`~/.dora/config.yaml` (or `./.dora/config.yaml` for project-local):

```yaml
skill_query_url: http://api.doraskill.org  # query engine URL
min_security_level: warn                  # safe | warn | danger
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
dora install [platform]        Auto-detect or specify target platform
```

## Data

- Cache: `~/.dora/skills/<name>_<owner>/`
- Status: `~/.dora/skills/status.yaml`
- Query log: `~/.dora/query-log.jsonl`
- Config: `~/.dora/config.yaml` (not deleted by purge)

## License

MIT
```

- [ ] **Step 2: Verify file looks correct**

Open `README.md` and confirm:
- Language nav line is present below `# dora`
- "Why dora?" section appears before "How it works"
- All platform `<details>` blocks are present
- Technical sections (Configuration, Commands, Data) are intact at the bottom

---

## Task 2: Create README.zh.md (中文)

**Files:**
- Create: `README.zh.md`

- [ ] **Step 1: Write README.zh.md**

```markdown
# dora

[English](README.md) · 中文 · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> 给 AI coding agent 用的社区技能市场——安全、免安装、离线可用。

## 为什么用 dora？

- 🔒 **只从 GitHub 下载**：每个 skill 来源公开可查，有安全等级标注（`safe` / `warn` / `danger`），你设定阈值，dora 自动过滤。
- ⚡ **不占 token**：skill 按需加载，平时不占 context 窗口，用时才读入。
- 📦 **不用手动安装**：一条命令查询 + 克隆，无需提前安装任何 skill。
- 🌐 **离线可用**：内置约 9,500 个 skill 的本地索引，网络不通时自动切换。

## dora 如何工作

1. **查询** — 描述你的任务，dora 向 [skills.sh](https://skills.sh) 查询匹配的社区 skill
2. **下载** — 找到合适的 skill 后，从对应的 **GitHub 仓库** 克隆到本地缓存
3. **安全检查** — 每个 skill 都有安全等级（`safe` / `warn` / `danger`），dora 根据你配置的阈值决定是否加载
4. **执行** — 将 skill 的 `SKILL.md` 读入 AI 上下文，agent 按指令完成任务
5. **离线保底** — 如果 `api.doraskill.org` 不通，自动切换到本地 BM25 索引（约 9,500 个 skill，随包附带，无需下载）

## 安装

<details open>
<summary><strong>Claude Code</strong> — 插件市场，全自动</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

重启 Claude Code（或运行 `/reload-plugins`）。

| 斜杠命令 | 功能 |
|---|---|
| `/dora:dora <任务>` | 查询、选择、加载并运行一个 skill。无参数 → 列出已缓存。 |
| `/dora:dora local: <任务>` | 同上，但只搜索本地索引（跳过远程引擎）。 |
| `/dora:dora-stats` | 使用统计。 |
| `/dora:dora-doctor` | 诊断工具。 |
| `/dora:dora-upgrade` | 升级 dora 本身。 |
| `/dora:dora-purge` | 删除所有已缓存的 skill。 |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

将 MCP server 合并写入 `~/.codex/config.toml`（TOML 深度合并，自动备份 `.bak`），SessionStart hook 写入 `~/.codex/hooks.json`，并将路由规则追加到 `~/.codex/AGENTS.md`。

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

写入 `.cursor/mcp.json`（深度合并）和 `.cursor/rules/dora.mdc`。

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

写入 `opencode.json`（深度合并）并将路由规则追加到 `AGENTS.md`。

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

将 MCP server 合并写入 `~/.gemini/settings.json`，并将路由规则追加到 `GEMINI.md`。

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

将 MCP 配置合并写入 `openclaw.json`。

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

将 MCP server 合并写入 `settings.json`。

</details>

## 跨平台适配

dora 自动检测当前运行的 CLI 平台并适配 skill 加载方式。

**检测优先级：** `DORA_PLATFORM` 环境变量 → MCP clientInfo → 环境信号 → 兜底。

当 `dora_load` 返回非空的 `execution_context` 时，agent 会在运行 skill 前先输出该内容——包括工具名映射（如 Gemini CLI 上 `Read` → `read_file`）或未验证平台的兼容性警告。

支持平台：`claude-code`、`codex`、`cursor`、`opencode`、`gemini-cli`、`qwen-code`、`openclaw`。

## 离线回退

当远程引擎不可达时，`dora_query` 自动回退到本地 catalog。

- **触发条件：** `engine_unreachable`（网络/超时）或 HTTP 状态 ≥ 500 或 429。其他 4xx 错误直接返回给调用方，不触发回退，避免隐藏配置/认证问题。
- **强制本地：** 向 `dora_query` 传入 `local_only: true`（或使用 `/dora:dora local: <任务>`）可跳过远程引擎。
- **Catalog：** 约 9,465 个 skill，随 npm 包附带（无需额外下载）。
- **结果结构：** 与远程结果一致（`{skills: [...]}`），并附加 `source: "remote" | "local"` 字段。
- **诊断：** `dora_doctor` 包含本地索引检查项。

远程引擎返回空结果（`empty_candidates`）不触发回退——如果远程服务明确表示无匹配，dora 信任该结果。

## 配置

`~/.dora/config.yaml`（或 `./.dora/config.yaml` 用于项目级配置）：

```yaml
skill_query_url: http://api.doraskill.org  # 查询引擎地址
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## CLI 命令

```
dora query <text>              搜索 skill 引擎
dora load <name> <url> <lvl>   克隆并缓存一个 skill
dora touch <key>               标记已使用某个缓存 skill
dora list                      列出已缓存的 skill
dora stats                     使用统计
dora doctor                    诊断
dora upgrade                   升级 dora
dora purge --yes               清空所有已缓存的 skill
dora mcp                       启动 MCP stdio server
dora install [platform]        自动检测或指定目标平台
```

## 数据存储路径

- 缓存：`~/.dora/skills/<name>_<owner>/`
- 状态：`~/.dora/skills/status.yaml`
- 查询日志：`~/.dora/query-log.jsonl`
- 配置文件：`~/.dora/config.yaml`（purge 不会删除）

## License

MIT
```

---

## Task 3: Create README.ja.md (日本語)

**Files:**
- Create: `README.ja.md`

- [ ] **Step 1: Write README.ja.md**

```markdown
# dora

[English](README.md) · [中文](README.zh.md) · 日本語 · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> AIコーディングエージェント向けのコミュニティスキルマーケットプレイス — 安全・インストール不要・オフライン対応。

## なぜ dora を使うのか？

- 🔒 **GitHubからのみダウンロード**：すべてのスキルは公開リポジトリから取得。セキュリティレベル（`safe` / `warn` / `danger`）が付与されており、閾値を設定すれば dora が自動でフィルタリングします。
- ⚡ **トークンを消費しない**：スキルはオンデマンドで読み込まれ、使用するまでコンテキストウィンドウを占有しません。
- 📦 **手動インストール不要**：コマンド1つで検索・クローンが完了。スキルを事前にインストールする必要はありません。
- 🌐 **オフライン対応**：約9,500件のスキルがバンドルされたローカルインデックスを内蔵。リモートエンジンに接続できない場合は自動的に切り替わります。

## dora の仕組み

1. **クエリ** — タスクを説明すると、dora が [skills.sh](https://skills.sh) に対して一致するコミュニティスキルを検索します
2. **ダウンロード** — 一致したスキルは対応する **GitHubリポジトリ** からローカルキャッシュにクローンされます
3. **セキュリティチェック** — 各スキルにはセキュリティレベル（`safe` / `warn` / `danger`）があり、設定した閾値に基づいてフィルタリングされます
4. **実行** — スキルの `SKILL.md` がAIのコンテキストに読み込まれ、エージェントがその指示に従ってタスクを実行します
5. **オフラインフォールバック** — `api.doraskill.org` に接続できない場合、ローカルのBM25インデックス（約9,500件、バンドル済み）に自動切替します

## インストール

<details open>
<summary><strong>Claude Code</strong> — プラグインマーケットプレイス、完全自動</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Claude Codeを再起動（または `/reload-plugins` を実行）してください。

| スラッシュコマンド | 機能 |
|---|---|
| `/dora:dora <タスク>` | スキルを検索・選択・ロード・実行。引数なしでキャッシュ一覧表示。 |
| `/dora:dora local: <タスク>` | 同上、ローカルインデックスのみ検索（リモートエンジンをスキップ）。 |
| `/dora:dora-stats` | 使用統計。 |
| `/dora:dora-doctor` | 診断ツール。 |
| `/dora:dora-upgrade` | dora 自体をアップグレード。 |
| `/dora:dora-purge` | キャッシュ済みスキルをすべて削除。 |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

MCPサーバーを `~/.codex/config.toml` にマージ（TOMLディープマージ、`.bak` バックアップ）、SessionStartフックを `~/.codex/hooks.json` に追加、ルーティング設定を `~/.codex/AGENTS.md` に追記します。

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

`.cursor/mcp.json`（ディープマージ）と `.cursor/rules/dora.mdc` を書き込みます。

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

`opencode.json`（ディープマージ）を書き込み、ルーティング設定を `AGENTS.md` に追記します。

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

MCPサーバーを `~/.gemini/settings.json` にマージし、ルーティング設定を `GEMINI.md` に追記します。

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

MCP設定を `openclaw.json` にマージします。

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

MCPサーバーを `settings.json` にマージします。

</details>

## クロスプラットフォームアダプター

dora は実行中のCLIプラットフォームを自動検出し、スキルのロード方法を適応させます。

**検出優先順位：** `DORA_PLATFORM` 環境変数 → MCP clientInfo → 環境シグナル → フォールバック。

`dora_load` がnull以外の `execution_context` を返す場合、エージェントはスキル実行前にその内容を出力します（ツール名マッピングや未検証プラットフォームの互換性警告など）。

対応プラットフォーム：`claude-code`、`codex`、`cursor`、`opencode`、`gemini-cli`、`qwen-code`、`openclaw`。

## オフラインフォールバック

リモートエンジンに接続できない場合、`dora_query` は自動的にローカルカタログにフォールバックします。

- **トリガー：** `engine_unreachable`（ネットワーク/タイムアウト）またはHTTPステータス ≥ 500 もしくは 429。その他の4xxエラーはそのまま呼び出し元に返され、設定/認証の問題が隠れないようにします。
- **ローカル強制：** `dora_query` に `local_only: true` を渡す（または `/dora:dora local: <タスク>` を使用）とリモートエンジンをスキップできます。
- **カタログ：** 約9,465件のスキルをnpmパッケージにバンドル（追加ダウンロード不要）。
- **結果の形式：** リモートと同一（`{skills: [...]}`）に `source: "remote" | "local"` フィールドが追加されます。
- **診断：** `dora_doctor` にローカルインデックスの確認項目が含まれます。

リモートエンジンが空の結果（`empty_candidates`）を返した場合はフォールバックしません — リモートサービスが明示的に一致なしと回答した場合、dora はその結果を信頼します。

## 設定

`~/.dora/config.yaml`（またはプロジェクトローカルの `./.dora/config.yaml`）：

```yaml
skill_query_url: http://api.doraskill.org  # クエリエンジンURL
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## コマンド

```
dora query <text>              スキルエンジンを検索
dora load <name> <url> <lvl>   スキルをクローンしてキャッシュ
dora touch <key>               キャッシュ済みスキルの使用を記録
dora list                      キャッシュ済みスキルを一覧表示
dora stats                     使用統計
dora doctor                    診断
dora upgrade                   dora をアップグレード
dora purge --yes               キャッシュ済みスキルをすべて削除
dora mcp                       MCP stdioサーバーを起動
dora install [platform]        プラットフォームを自動検出または指定
```

## データ

- キャッシュ：`~/.dora/skills/<name>_<owner>/`
- ステータス：`~/.dora/skills/status.yaml`
- クエリログ：`~/.dora/query-log.jsonl`
- 設定ファイル：`~/.dora/config.yaml`（purge では削除されません）

## License

MIT
```

---

## Task 4: Create README.kr.md (한국어)

**Files:**
- Create: `README.kr.md`

- [ ] **Step 1: Write README.kr.md**

```markdown
# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · 한국어 · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> AI 코딩 에이전트를 위한 커뮤니티 스킬 마켓플레이스 — 안전하고, 설치 없이, 오프라인에서도 사용 가능.

## 왜 dora인가요?

- 🔒 **GitHub에서만 다운로드**: 모든 스킬은 공개 저장소에서 가져옵니다. 각 스킬에는 보안 등급(`safe` / `warn` / `danger`)이 있으며, 임계값을 설정하면 dora가 자동으로 필터링합니다.
- ⚡ **토큰 소모 없음**: 스킬은 필요할 때만 로드됩니다. 사용하기 전까지 컨텍스트 윈도우를 차지하지 않습니다.
- 📦 **수동 설치 불필요**: 명령어 하나로 검색과 클론이 완료됩니다. 스킬을 미리 설치할 필요가 없습니다.
- 🌐 **오프라인 지원**: 약 9,500개의 스킬로 구성된 로컬 인덱스가 내장되어 있습니다. 원격 엔진에 연결할 수 없으면 자동으로 전환됩니다.

## dora 작동 방식

1. **쿼리** — 작업을 설명하면 dora가 [skills.sh](https://skills.sh)에서 일치하는 커뮤니티 스킬을 검색합니다
2. **다운로드** — 일치하는 스킬은 해당 **GitHub 저장소**에서 로컬 캐시로 클론됩니다
3. **보안 검사** — 각 스킬에는 보안 등급(`safe` / `warn` / `danger`)이 있으며, 설정된 임계값에 따라 필터링됩니다
4. **실행** — 스킬의 `SKILL.md`가 AI 컨텍스트에 로드되고 에이전트가 지시에 따라 작업을 수행합니다
5. **오프라인 폴백** — `api.doraskill.org`에 연결할 수 없으면 로컬 BM25 인덱스(약 9,500개, 번들 포함)로 자동 전환됩니다

## 설치

<details open>
<summary><strong>Claude Code</strong> — 플러그인 마켓플레이스, 완전 자동</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Claude Code를 재시작하거나 `/reload-plugins`를 실행하세요.

| 슬래시 명령어 | 기능 |
|---|---|
| `/dora:dora <작업>` | 스킬 검색, 선택, 로드 및 실행. 인수 없으면 캐시 목록 표시. |
| `/dora:dora local: <작업>` | 동일하지만 로컬 인덱스만 검색(원격 엔진 건너뜀). |
| `/dora:dora-stats` | 사용 통계. |
| `/dora:dora-doctor` | 진단 도구. |
| `/dora:dora-upgrade` | dora 자체 업그레이드. |
| `/dora:dora-purge` | 캐시된 모든 스킬 삭제. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

MCP 서버를 `~/.codex/config.toml`에 병합(TOML 딥 머지, `.bak` 백업), SessionStart 훅을 `~/.codex/hooks.json`에 추가, 라우팅을 `~/.codex/AGENTS.md`에 추가합니다.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

`.cursor/mcp.json`(딥 머지)과 `.cursor/rules/dora.mdc`를 작성합니다.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

`opencode.json`(딥 머지)을 작성하고 `AGENTS.md`에 라우팅을 추가합니다.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

MCP 서버를 `~/.gemini/settings.json`에 병합하고 `GEMINI.md`에 라우팅을 추가합니다.

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

MCP 설정을 `openclaw.json`에 병합합니다.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

MCP 서버를 `settings.json`에 병합합니다.

</details>

## 크로스 플랫폼 어댑터

dora는 실행 중인 CLI 플랫폼을 자동으로 감지하고 스킬 로딩 방식을 조정합니다.

**감지 우선순위:** `DORA_PLATFORM` 환경 변수 → MCP clientInfo → 환경 신호 → 폴백.

`dora_load`가 null이 아닌 `execution_context`를 반환하면 에이전트는 스킬 실행 전에 해당 내용을 출력합니다(툴 이름 매핑 또는 미검증 플랫폼 호환성 경고 포함).

지원 플랫폼: `claude-code`, `codex`, `cursor`, `opencode`, `gemini-cli`, `qwen-code`, `openclaw`.

## 오프라인 폴백

원격 엔진에 연결할 수 없을 때 `dora_query`는 자동으로 로컬 카탈로그로 폴백합니다.

- **트리거:** `engine_unreachable`(네트워크/타임아웃) 또는 HTTP 상태 ≥ 500 또는 429. 다른 4xx 오류는 설정/인증 문제가 숨겨지지 않도록 호출자에게 그대로 반환됩니다.
- **로컬 강제:** `dora_query`에 `local_only: true`를 전달(또는 `/dora:dora local: <작업>` 사용)하면 원격 엔진을 건너뜁니다.
- **카탈로그:** 약 9,465개의 스킬이 npm 패키지에 번들(추가 다운로드 불필요).
- **결과 형태:** 원격과 동일(`{skills: [...]}`)하며 `source: "remote" | "local"` 필드가 추가됩니다.
- **진단:** `dora_doctor`에 로컬 인덱스 확인 항목이 포함됩니다.

원격 엔진이 빈 결과(`empty_candidates`)를 반환하면 폴백하지 않습니다 — 원격 서비스가 명시적으로 일치 없음을 반환하면 dora는 그 결과를 신뢰합니다.

## 설정

`~/.dora/config.yaml`(또는 프로젝트 로컬 `./.dora/config.yaml`):

```yaml
skill_query_url: http://api.doraskill.org  # 쿼리 엔진 URL
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## 명령어

```
dora query <text>              스킬 엔진 검색
dora load <name> <url> <lvl>   스킬 클론 및 캐시
dora touch <key>               캐시된 스킬 사용 기록
dora list                      캐시된 스킬 목록 표시
dora stats                     사용 통계
dora doctor                    진단
dora upgrade                   dora 업그레이드
dora purge --yes               캐시된 모든 스킬 삭제
dora mcp                       MCP stdio 서버 시작
dora install [platform]        플랫폼 자동 감지 또는 지정
```

## 데이터

- 캐시: `~/.dora/skills/<name>_<owner>/`
- 상태: `~/.dora/skills/status.yaml`
- 쿼리 로그: `~/.dora/query-log.jsonl`
- 설정 파일: `~/.dora/config.yaml`(purge로 삭제되지 않음)

## License

MIT
```

---

## Task 5: Create README.fr.md (Français)

**Files:**
- Create: `README.fr.md`

- [ ] **Step 1: Write README.fr.md**

```markdown
# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · Français · [Español](README.es.md) · [Deutsch](README.de.md)

> Un marketplace de compétences communautaires pour les agents IA — sûr, sans installation, disponible hors ligne.

## Pourquoi dora ?

- 🔒 **Téléchargements GitHub uniquement** : Chaque skill est vérifiable publiquement. Chacun possède un niveau de sécurité (`safe` / `warn` / `danger`) — définissez votre seuil et dora filtre automatiquement.
- ⚡ **Zéro overhead de tokens** : Les skills se chargent à la demande. Ils n'occupent pas votre fenêtre de contexte tant que vous n'en avez pas besoin.
- 📦 **Aucune installation manuelle** : Une seule commande pour rechercher et cloner — sans pré-installer les skills.
- 🌐 **Disponible hors ligne** : Un catalogue de ~9 500 skills est intégré à dora. Si le moteur distant est inaccessible, dora bascule automatiquement.

## Comment fonctionne dora

1. **Requête** — Décrivez votre tâche ; dora interroge [skills.sh](https://skills.sh) pour trouver les skills communautaires correspondants
2. **Téléchargement** — Le skill correspondant est cloné depuis son **dépôt GitHub** dans un cache local
3. **Vérification de sécurité** — Chaque skill possède un niveau de sécurité (`safe` / `warn` / `danger`) ; dora filtre selon votre seuil configuré
4. **Exécution** — Le `SKILL.md` du skill est chargé dans le contexte de l'IA et l'agent suit ses instructions
5. **Fallback hors ligne** — Si `api.doraskill.org` est inaccessible, dora bascule automatiquement sur un index BM25 local (~9 500 skills, inclus — aucun téléchargement nécessaire)

## Installation

<details open>
<summary><strong>Claude Code</strong> — marketplace de plugins, entièrement automatique</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Redémarrez Claude Code (ou exécutez `/reload-plugins`).

| Commande slash | Fonction |
|---|---|
| `/dora:dora <tâche>` | Rechercher, choisir, charger et exécuter un skill. Sans arguments → liste le cache. |
| `/dora:dora local: <tâche>` | Identique, mais recherche uniquement dans l'index local (ignore le moteur distant). |
| `/dora:dora-stats` | Statistiques d'utilisation. |
| `/dora:dora-doctor` | Diagnostics. |
| `/dora:dora-upgrade` | Mettre à jour dora. |
| `/dora:dora-purge` | Supprimer tous les skills en cache. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Fusionne le serveur MCP dans `~/.codex/config.toml` (fusion TOML profonde, sauvegarde `.bak`), le hook SessionStart dans `~/.codex/hooks.json`, et ajoute le routage à `~/.codex/AGENTS.md`.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

Écrit `.cursor/mcp.json` (fusion profonde) et `.cursor/rules/dora.mdc`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Écrit `opencode.json` (fusion profonde) et ajoute le routage à `AGENTS.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Fusionne le serveur MCP dans `~/.gemini/settings.json` et ajoute le routage à `GEMINI.md`.

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

Fusionne la configuration MCP dans `openclaw.json`.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Fusionne le serveur MCP dans `settings.json`.

</details>

## Adaptateur multiplateforme

dora détecte automatiquement la plateforme CLI en cours d'exécution et adapte le chargement des skills.

**Priorité de détection :** variable d'environnement `DORA_PLATFORM` → MCP clientInfo → signaux d'environnement → fallback.

Lorsque `dora_load` retourne un `execution_context` non nul, l'agent l'affiche avant d'exécuter le skill — cela inclut les mappages de noms d'outils ou les avertissements de compatibilité pour les plateformes non vérifiées.

Plateformes supportées : `claude-code`, `codex`, `cursor`, `opencode`, `gemini-cli`, `qwen-code`, `openclaw`.

## Fallback hors ligne

`dora_query` bascule automatiquement sur un catalogue local quand le moteur distant est inaccessible.

- **Déclencheurs :** `engine_unreachable` (réseau/timeout) ou `http_error` avec statut ≥ 500 ou 429. Les autres erreurs 4xx sont renvoyées à l'appelant telles quelles.
- **Forcer le local :** Passez `local_only: true` à `dora_query` (ou utilisez `/dora:dora local: <tâche>`) pour ignorer le moteur distant.
- **Catalogue :** ~9 465 skills, inclus dans le package npm (aucun téléchargement supplémentaire).
- **Format des résultats :** identique au distant (`{skills: [...]}`) avec un champ `source: "remote" | "local"` ajouté.
- **Diagnostics :** `dora_doctor` inclut une vérification de l'index local.

Les résultats vides du moteur distant (`empty_candidates`) ne déclenchent pas le fallback.

## Configuration

`~/.dora/config.yaml` (ou `./.dora/config.yaml` pour un projet local) :

```yaml
skill_query_url: http://api.doraskill.org  # URL du moteur de requêtes
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Commandes

```
dora query <text>              Rechercher dans le moteur de skills
dora load <name> <url> <lvl>   Cloner et mettre en cache un skill
dora touch <key>               Marquer un skill en cache comme utilisé
dora list                      Lister les skills en cache
dora stats                     Statistiques d'utilisation
dora doctor                    Diagnostics
dora upgrade                   Mettre à jour dora
dora purge --yes               Supprimer tous les skills en cache
dora mcp                       Démarrer le serveur MCP stdio
dora install [platform]        Détecter automatiquement ou spécifier la plateforme
```

## Données

- Cache : `~/.dora/skills/<name>_<owner>/`
- Statut : `~/.dora/skills/status.yaml`
- Journal des requêtes : `~/.dora/query-log.jsonl`
- Configuration : `~/.dora/config.yaml` (non supprimé par purge)

## License

MIT
```

---

## Task 6: Create README.es.md (Español)

**Files:**
- Create: `README.es.md`

- [ ] **Step 1: Write README.es.md**

```markdown
# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · Español · [Deutsch](README.de.md)

> Un marketplace de habilidades comunitarias para agentes de IA — seguro, sin instalación, disponible sin conexión.

## ¿Por qué dora?

- 🔒 **Solo descargas desde GitHub**: Cada skill es auditable públicamente. Cada uno tiene un nivel de seguridad (`safe` / `warn` / `danger`) — establece tu umbral y dora filtra automáticamente.
- ⚡ **Sin overhead de tokens**: Los skills se cargan bajo demanda. No ocupan tu ventana de contexto hasta que los necesites.
- 📦 **Sin instalaciones manuales**: Un solo comando para buscar y clonar — sin preinstalar skills.
- 🌐 **Disponible sin conexión**: Un catálogo de ~9.500 skills viene incluido con dora. Si el motor remoto no está disponible, dora cambia automáticamente.

## Cómo funciona dora

1. **Consulta** — Describe tu tarea; dora consulta [skills.sh](https://skills.sh) para encontrar skills comunitarios coincidentes
2. **Descarga** — El skill coincidente se clona desde su **repositorio GitHub** a un caché local
3. **Verificación de seguridad** — Cada skill tiene un nivel de seguridad (`safe` / `warn` / `danger`); dora filtra según tu umbral configurado
4. **Ejecución** — El `SKILL.md` del skill se carga en el contexto de la IA y el agente sigue sus instrucciones
5. **Fallback sin conexión** — Si `api.doraskill.org` no está disponible, dora cambia automáticamente a un índice BM25 local (~9.500 skills, incluido — sin descargas necesarias)

## Instalación

<details open>
<summary><strong>Claude Code</strong> — marketplace de plugins, completamente automático</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Reinicia Claude Code (o ejecuta `/reload-plugins`).

| Comando slash | Función |
|---|---|
| `/dora:dora <tarea>` | Buscar, seleccionar, cargar y ejecutar un skill. Sin argumentos → lista el caché. |
| `/dora:dora local: <tarea>` | Igual, pero solo busca en el índice local (omite el motor remoto). |
| `/dora:dora-stats` | Estadísticas de uso. |
| `/dora:dora-doctor` | Diagnósticos. |
| `/dora:dora-upgrade` | Actualizar dora. |
| `/dora:dora-purge` | Eliminar todos los skills en caché. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Fusiona el servidor MCP en `~/.codex/config.toml` (fusión TOML profunda, copia de seguridad `.bak`), el hook SessionStart en `~/.codex/hooks.json`, y agrega el enrutamiento a `~/.codex/AGENTS.md`.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

Escribe `.cursor/mcp.json` (fusión profunda) y `.cursor/rules/dora.mdc`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Escribe `opencode.json` (fusión profunda) y agrega el enrutamiento a `AGENTS.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Fusiona el servidor MCP en `~/.gemini/settings.json` y agrega el enrutamiento a `GEMINI.md`.

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

Fusiona la configuración MCP en `openclaw.json`.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Fusiona el servidor MCP en `settings.json`.

</details>

## Adaptador multiplataforma

dora detecta automáticamente la plataforma CLI en ejecución y adapta la carga de skills.

**Prioridad de detección:** variable de entorno `DORA_PLATFORM` → MCP clientInfo → señales de entorno → fallback.

Cuando `dora_load` devuelve un `execution_context` no nulo, el agente lo muestra antes de ejecutar el skill — incluye mapeos de nombres de herramientas o advertencias de compatibilidad para plataformas no verificadas.

Plataformas soportadas: `claude-code`, `codex`, `cursor`, `opencode`, `gemini-cli`, `qwen-code`, `openclaw`.

## Fallback sin conexión

`dora_query` cambia automáticamente a un catálogo local cuando el motor remoto no está disponible.

- **Disparadores:** `engine_unreachable` (red/timeout) o `http_error` con estado ≥ 500 o 429. Otros errores 4xx se devuelven al llamante tal cual.
- **Forzar local:** Pasa `local_only: true` a `dora_query` (o usa `/dora:dora local: <tarea>`) para omitir el motor remoto.
- **Catálogo:** ~9.465 skills, incluidos en el paquete npm (sin descarga adicional).
- **Formato de resultados:** idéntico al remoto (`{skills: [...]}`) con un campo `source: "remote" | "local"` añadido.
- **Diagnósticos:** `dora_doctor` incluye una verificación del índice local.

Los resultados vacíos del motor remoto (`empty_candidates`) no activan el fallback.

## Configuración

`~/.dora/config.yaml` (o `./.dora/config.yaml` para proyectos locales):

```yaml
skill_query_url: http://api.doraskill.org  # URL del motor de consultas
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Comandos

```
dora query <text>              Buscar en el motor de skills
dora load <name> <url> <lvl>   Clonar y almacenar en caché un skill
dora touch <key>               Marcar un skill en caché como usado
dora list                      Listar skills en caché
dora stats                     Estadísticas de uso
dora doctor                    Diagnósticos
dora upgrade                   Actualizar dora
dora purge --yes               Eliminar todos los skills en caché
dora mcp                       Iniciar el servidor MCP stdio
dora install [platform]        Detectar automáticamente o especificar plataforma
```

## Datos

- Caché: `~/.dora/skills/<name>_<owner>/`
- Estado: `~/.dora/skills/status.yaml`
- Registro de consultas: `~/.dora/query-log.jsonl`
- Configuración: `~/.dora/config.yaml` (no eliminado por purge)

## License

MIT
```

---

## Task 7: Create README.de.md (Deutsch)

**Files:**
- Create: `README.de.md`

- [ ] **Step 1: Write README.de.md**

```markdown
# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · Deutsch

> Ein Community-Skill-Marktplatz für KI-Coding-Agenten — sicher, ohne Installation, offline verfügbar.

## Warum dora?

- 🔒 **Nur Downloads von GitHub**: Jeder Skill ist öffentlich überprüfbar. Jeder hat ein Sicherheitslevel (`safe` / `warn` / `danger`) — legen Sie Ihren Schwellenwert fest und dora filtert automatisch.
- ⚡ **Null Token-Overhead**: Skills werden on demand geladen. Sie belegen Ihr Kontextfenster nicht, bis Sie sie tatsächlich benötigen.
- 📦 **Keine manuellen Installationen**: Ein Befehl zum Suchen und Klonen — keine Vorinstallation von Skills.
- 🌐 **Offline verfügbar**: Ein gebündelter Katalog mit ~9.500 Skills ist in dora enthalten. Wenn der Remote-Engine nicht erreichbar ist, wechselt dora automatisch.

## Wie dora funktioniert

1. **Abfrage** — Beschreiben Sie Ihre Aufgabe; dora fragt [skills.sh](https://skills.sh) nach passenden Community-Skills
2. **Download** — Der passende Skill wird aus seinem **GitHub-Repository** in einen lokalen Cache geklont
3. **Sicherheitsprüfung** — Jeder Skill hat ein Sicherheitslevel (`safe` / `warn` / `danger`); dora filtert nach Ihrem konfigurierten Schwellenwert
4. **Ausführung** — Das `SKILL.md` des Skills wird in den KI-Kontext geladen und der Agent folgt seinen Anweisungen
5. **Offline-Fallback** — Wenn `api.doraskill.org` nicht erreichbar ist, wechselt dora automatisch zu einem lokalen BM25-Index (~9.500 Skills, gebündelt — kein Download nötig)

## Installation

<details open>
<summary><strong>Claude Code</strong> — Plugin-Marktplatz, vollautomatisch</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Starten Sie Claude Code neu (oder führen Sie `/reload-plugins` aus).

| Slash-Befehl | Funktion |
|---|---|
| `/dora:dora <Aufgabe>` | Skill suchen, auswählen, laden und ausführen. Ohne Argumente → Cache auflisten. |
| `/dora:dora local: <Aufgabe>` | Gleich, aber nur lokalen Index durchsuchen (Remote-Engine überspringen). |
| `/dora:dora-stats` | Nutzungsstatistiken. |
| `/dora:dora-doctor` | Diagnose. |
| `/dora:dora-upgrade` | dora aktualisieren. |
| `/dora:dora-purge` | Alle gecachten Skills löschen. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Führt den MCP-Server in `~/.codex/config.toml` zusammen (TOML-Deep-Merge, `.bak`-Backup), SessionStart-Hook in `~/.codex/hooks.json`, und hängt Routing an `~/.codex/AGENTS.md` an.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g @doraskill/dora
dora install cursor
```

Schreibt `.cursor/mcp.json` (Deep-Merge) und `.cursor/rules/dora.mdc`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Schreibt `opencode.json` (Deep-Merge) und hängt Routing an `AGENTS.md` an.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Führt den MCP-Server in `~/.gemini/settings.json` zusammen und hängt Routing an `GEMINI.md` an.

</details>

<details>
<summary><strong>OpenClaw</strong></summary>

```bash
npm install -g @doraskill/dora
dora install openclaw
```

Führt MCP-Konfiguration in `openclaw.json` zusammen.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Führt den MCP-Server in `settings.json` zusammen.

</details>

## Plattformübergreifender Adapter

dora erkennt automatisch die laufende CLI-Plattform und passt das Skill-Laden an.

**Erkennungspriorität:** `DORA_PLATFORM`-Umgebungsvariable → MCP clientInfo → Umgebungssignale → Fallback.

Wenn `dora_load` einen nicht-null `execution_context` zurückgibt, gibt der Agent diesen vor der Skill-Ausführung aus — einschließlich Tool-Name-Mappings oder Kompatibilitätswarnungen für unverified Plattformen.

Unterstützte Plattformen: `claude-code`, `codex`, `cursor`, `opencode`, `gemini-cli`, `qwen-code`, `openclaw`.

## Offline-Fallback

`dora_query` wechselt automatisch zu einem lokalen Katalog, wenn der Remote-Engine nicht erreichbar ist.

- **Auslöser:** `engine_unreachable` (Netzwerk/Timeout) oder `http_error` mit Status ≥ 500 oder 429. Andere 4xx-Fehler werden unverändert an den Aufrufer zurückgegeben.
- **Lokal erzwingen:** Übergeben Sie `local_only: true` an `dora_query` (oder verwenden Sie `/dora:dora local: <Aufgabe>`), um den Remote-Engine zu überspringen.
- **Katalog:** ~9.465 Skills, im npm-Paket gebündelt (kein zusätzlicher Download).
- **Ergebnisformat:** identisch mit Remote (`{skills: [...]}`) plus `source: "remote" | "local"` Feld.
- **Diagnose:** `dora_doctor` enthält eine Prüfung des lokalen Index.

Leere Ergebnisse vom Remote-Engine (`empty_candidates`) lösen keinen Fallback aus.

## Konfiguration

`~/.dora/config.yaml` (oder `./.dora/config.yaml` für projektspezifisch):

```yaml
skill_query_url: http://api.doraskill.org  # Abfrage-Engine-URL
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Befehle

```
dora query <text>              Skill-Engine durchsuchen
dora load <name> <url> <lvl>   Skill klonen und cachen
dora touch <key>               Gecachten Skill als verwendet markieren
dora list                      Gecachte Skills auflisten
dora stats                     Nutzungsstatistiken
dora doctor                    Diagnose
dora upgrade                   dora aktualisieren
dora purge --yes               Alle gecachten Skills löschen
dora mcp                       MCP stdio-Server starten
dora install [platform]        Plattform automatisch erkennen oder angeben
```

## Daten

- Cache: `~/.dora/skills/<name>_<owner>/`
- Status: `~/.dora/skills/status.yaml`
- Abfrageprotokoll: `~/.dora/query-log.jsonl`
- Konfiguration: `~/.dora/config.yaml` (wird nicht durch purge gelöscht)

## License

MIT
```

---

## Task 8: Update memory sync rule

**Files:**
- Update: `/Users/dfbb/.claude/projects/-Users-dfbb-Sites-skm-dora-src/memory/feedback_readme_sync.md`

- [ ] **Step 1: Update the memory file to include all 6 language files**

Open the file and update the rule to explicitly list all 6 language files that must be synced on every README.md change:

```markdown
---
name: README sync + multilingual
description: Every README.md change must be committed alongside all 6 language versions in the same commit
type: feedback
---

Always update all language versions in the same commit as README.md. Never commit a README.md change without updating these files too:
- README.zh.md (中文)
- README.ja.md (日本語)
- README.kr.md (한국어)
- README.fr.md (Français)
- README.es.md (Español)
- README.de.md (Deutsch)

**Why:** User explicitly requested multilingual sync as a permanent rule (2026-05-08).
**How to apply:** When editing README.md for any reason, immediately update all 6 language files before committing. Include all 7 files in the same git commit.
```

---

## Task 9: Commit all files and bump version

**Files:**
- All 7 README files + memory file

- [ ] **Step 1: Stage all files**

```bash
git add README.md README.zh.md README.ja.md README.kr.md README.fr.md README.es.md README.de.md
```

- [ ] **Step 2: Bump version to 0.1.12 in package.json, plugin.json, marketplace.json**

Edit `package.json`: `"version": "0.1.12"`
Edit `.claude-plugin/plugin.json`: `"version": "0.1.12"`
Edit `.claude-plugin/marketplace.json`: `"version": "0.1.12"` (both occurrences)

- [ ] **Step 3: Rebuild bundles**

```bash
npm run build
```

Expected output: `bundles written`

- [ ] **Step 4: Stage version files and commit**

```bash
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json cli.bundle.mjs start.bundle.mjs
git commit -m "docs: rewrite README with user-value-first structure, add 6 language versions (v0.1.12)"
```

- [ ] **Step 5: Tag and push**

```bash
git tag v0.1.12
git push origin main
git push origin v0.1.12
```

- [ ] **Step 6: Create GitHub release**

```bash
gh release create v0.1.12 --title "v0.1.12" --notes "## Documentation

- Rewrote README.md with user-value-first structure (Why dora? + How it works sections)
- Added language navigation links
- Added 6 translated versions: 中文, 日本語, 한국어, Français, Español, Deutsch
- All technical details preserved, moved to lower sections"
```

- [ ] **Step 7: Publish to npm**

```bash
npm publish --access public
```

(Requires OTP. Run as: `! npm publish --access public` in Claude Code terminal)
