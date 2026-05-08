# dora

[English](README.md) · 中文 · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> 给 AI coding agent 用的社区技能市场——安全、免安装、离线可用。

## 为什么用 dora？

- 🔒 **只从 GitHub 下载**：每个 skill 来源公开可查，有安全等级标注（`safe` / `warn` / `danger`），你设定阈值，dora 自动过滤。
- ⚡ **不占 token**：skill 按需加载，平时不占 context 窗口，用时才读入。
- 📦 **不用手动安装**：一条命令查询 + 克隆，无需提前安装任何 skill。
- 🌐 **离线可用**：内置约 9,500 个 skill 的本地索引，网络不通时自动切换。

## dora 如何工作

1. **查询** — 描述你的任务，dora 向 [api.doraskill.org](https://api.doraskill.org) 查询匹配的社区 skill
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
