# Dora 跨平台 Adapter 设计

## 背景

Dora 当前仅作为 Claude Code 插件运行。目标：让 dora 通过 MCP 协议兼容 OpenCode、Codex、OpenClaw、Gemini CLI、Qwen Code 等 CLI，无需为每个平台开发原生插件。

核心问题：社区 skill 的 SKILL.md 统一用 Claude Code 工具名编写（`Read`、`Edit`、`Bash` 等），在其他平台上这些名字不存在。

## 设计决策

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 代码来源 | 共享包 / 运行时依赖 context-mode / **独立实现** | 独立实现 | dora 与 context-mode 无关，检测需求轻量（~200 行），分叉维护成本低 |
| 工具名适配方式 | 加载时文本替换 / **注入映射表** | 注入映射表 | 文本替换有误伤正文风险；注入映射表安全，AI 理解能力足够 |
| 部署方式 | 多平台原生插件 / **MCP 兼容** | MCP 兼容 | MCP 协议天然跨平台，所有目标 CLI 都支持 MCP server |
| 缓存目录 | 跟随各平台 config dir / **统一 `~/.dora/`** | 统一 | 多 CLI 共存时缓存共享，避免重复下载 |

## 平台检测

### 支持的平台

```typescript
type PlatformId =
  | "claude-code"
  | "codex"
  | "openclaw"
  | "opencode"
  | "gemini-cli"
  | "qwen-code"
  | "unknown";
```

### 检测优先级

1. **MCP clientInfo.name**（最高优先级）— MCP 初始化握手时客户端上报
2. **环境变量** — 各 CLI 运行时自动设置
3. **Fallback** — 默认 `claude-code`

### 检测信号表

| 平台 | MCP clientInfo.name | 环境变量 |
|------|-------------------|---------|
| Claude Code | `claude-code` | `CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID` |
| Codex | `Codex`, `codex-mcp-client` | `CODEX_THREAD_ID`, `CODEX_CI` |
| OpenClaw | *(无标准 clientInfo)* | *(fallback to ~/.openclaw/ 目录检测)* |
| OpenCode | *(待确认)* | `OPENCODE`, `OPENCODE_PID` |
| Gemini CLI | `gemini-cli-mcp-client` | `GEMINI_PROJECT_DIR`, `GEMINI_CLI` |
| Qwen Code | `qwen-code`, `qwen-cli-mcp-client-*` | `QWEN_PROJECT_DIR` |

### 检测入口

```typescript
function detectPlatform(clientInfo?: { name: string }): PlatformId
```

MCP server 在 `initialize` 握手时拿到 `clientInfo`，传给 `detectPlatform()`，结果在整个会话中复用。

## 工具名映射

### 映射数据结构

```typescript
interface ToolMapping {
  [claudeCodeToolName: string]: string | null;
  // null 表示目标平台不支持该工具
}

const TOOL_MAPPINGS: Record<PlatformId, ToolMapping | null> = {
  "claude-code": null,
  "openclaw":    null,
  "qwen-code":   null,
  "opencode": {
    Read: "read", Write: "write", Edit: "edit",
    Bash: "shell", Skill: "skill", Task: "task",
    WebFetch: "fetch", WebSearch: "search",
    TodoWrite: "todo",
  },
  "gemini-cli": {
    Read: "read_file", Write: "write_file", Edit: "replace",
    Bash: "run_shell_command", Skill: "activate_skill",
    WebSearch: "google_web_search", WebFetch: "web_fetch",
    Task: null,
  },
  "codex": {
    Read: "native file tools", Write: "native file tools",
    Edit: "native file tools", Bash: "native shell tools",
    Skill: "native loading", Task: "spawn_agent",
    TodoWrite: "update_plan",
  },
  "unknown": null,
};
```

`null` 顶层值 = 与 Claude Code 兼容，不注入。
`null` 字段值 = 目标平台不支持该工具。

### 注入时机

`dora_load` 返回值新增 `tool_mapping` 字段：

```typescript
interface DoraLoadResponse {
  key: string;
  skill_md_path: string;
  cache_hit: boolean;
  tool_mapping: string | null;  // 新增
}
```

### 映射文本格式

当 `tool_mapping` 非空时，其内容为 markdown 表格：

```markdown
## Platform Adaptation

This skill uses Claude Code tool names. Your platform equivalents:

| Skill references | Your platform |
|-----------------|---------------|
| `Read` | `read_file` |
| `Write` | `write_file` |
| `Edit` | `replace` |
| `Bash` | `run_shell_command` |
| `Skill` | `activate_skill` |
| `Task` | Not supported |

Use your platform's tool names when executing commands from this skill.
```

### dora SKILL.md 修改

dora 自身的 SKILL.md（调用方指令）Step 5 增加一行：

> 如果 `tool_mapping` 非空，在读取 SKILL.md 内容前先将映射表输出给模型作为上下文。

## 跨平台安装

### 安装入口

```bash
npx skills install dora
```

### 安装流程

1. `detectPlatform()` — 检测当前 CLI
2. `register-mcp.ts` — 写入对应平台的 MCP 配置文件
3. 输出安装结果

### 各平台 MCP 配置位置

| 平台 | 配置文件 | 格式 |
|------|---------|------|
| Claude Code | `~/.claude/settings.json` → `mcpServers` | JSON |
| Codex | `~/.codex/config.toml` → `[mcp]` | TOML |
| OpenCode | `opencode.json` → `mcp` | JSON |
| OpenClaw | `openclaw.json` → `plugins.entries` | JSON |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers` | JSON |
| Qwen Code | `~/.qwen/settings.json` → `mcpServers` | JSON |

### MCP server 注册内容

所有平台注册相同的 stdio MCP server，只是写入路径和格式不同：

```json
{
  "dora": {
    "command": "npx",
    "args": ["-y", "dora-skill-server"],
    "type": "stdio"
  }
}
```

## 文件结构

```
src/
  adapters/
    detect.ts          # detectPlatform() — env vars + clientInfo 检测
    tool-mapping.ts    # TOOL_MAPPINGS 静态映射表 + generateMappingText()
    types.ts           # PlatformId 类型定义
  install/
    register-mcp.ts    # 各平台 MCP 配置写入逻辑
```

预估代码量：200-250 行。

## 不改的部分

- `dora_query` — 纯远程搜索，无平台依赖
- `dora_list` — 纯缓存列表
- `dora_touch` — 纯使用计数
- `dora_purge` — 纯缓存清理
- SKILL.md 内容本身 — 不做文本替换
- `~/.dora/` 缓存结构 — 不变

## 边界情况

| 场景 | 处理 |
|------|------|
| 检测不到平台（unknown） | 不注入映射，行为同 Claude Code |
| 平台支持但映射表为 null | 不注入（openclaw/qwen-code） |
| Gemini CLI 上 skill 用了 Task | 映射表标注 `Task → Not supported`，AI 自行降级 |
| 新平台上线 | 加一条 env var 检测 + 映射表条目 |
| Qwen Code clientInfo 模式匹配 | `qwen-cli-mcp-client-*` 前缀匹配 |
| OpenCode 工具名大小写 | 当前基于源码分析为小写，上线前需实机验证 |

## 待验证项

- OpenCode `tool.id` 的实际值（源码中 `Tool.init()` 的 id 字段，当前推断为小写）
- OpenClaw 的 MCP clientInfo.name（当前无标准值，依赖 config dir 检测）
- Codex `config.toml` 的 MCP 注册格式是否支持 stdio type
