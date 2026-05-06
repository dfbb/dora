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

1. **手动覆盖** `DORA_PLATFORM` 环境变量（最高优先级）— 用户显式指定平台
2. **MCP clientInfo.name** — MCP 初始化握手时客户端上报
3. **环境变量** — 各 CLI 运行时自动设置
4. **Fallback** — 返回 `unknown`（不 fallback 到 claude-code）

### 检测信号表

| 平台 | MCP clientInfo.name | 环境变量 |
|------|-------------------|---------|
| Claude Code | `claude-code` | `CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID` |
| Codex | `Codex`, `codex-mcp-client` | `CODEX_THREAD_ID`, `CODEX_CI` |
| OpenClaw | *(待确认 clientInfo)* | *(无已知 env var，仅通过 clientInfo 或 `DORA_PLATFORM` 检测)* |
| OpenCode | *(待确认)* | `OPENCODE`, `OPENCODE_PID` |
| Gemini CLI | `gemini-cli-mcp-client` | `GEMINI_PROJECT_DIR`, `GEMINI_CLI` |
| Qwen Code | `qwen-code`, `qwen-cli-mcp-client-*` | `QWEN_PROJECT_DIR` |

**不使用 filesystem 检测。** 与 context-mode 不同，dora 只支持 6 个平台，不需要 `~/.openclaw/` 等目录存在性作为 fallback。所有检测仅通过 `DORA_PLATFORM`、MCP clientInfo、环境变量三层完成，均不命中则返回 `unknown`。这避免了"安装了某 CLI 但当前并非从该 CLI 调用"的误判。

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
  "claude-code": null,  // 原生平台，无需映射

  // OpenClaw: Claude Code 分支，共享 ClaudeCodeBaseAdapter 线协议，
  // 工具名完全一致（Read/Write/Edit/Bash）。
  // 依据：openclaw adapter 的 parsePreToolUseInput 使用 toolName/tool_name
  // 映射到与 Claude Code 相同的标准化字段。
  "openclaw": null,

  // Qwen Code: 继承 ClaudeCodeBaseAdapter，使用相同 JSON stdin/stdout 协议，
  // 工具名与 Claude Code 一致。
  // 依据：qwen-code adapter 的 constructor 调用 super([".qwen"])，
  // parse/format 方法全部继承自 claude-code-base.ts。
  "qwen-code": null,

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
  "unknown": null,  // 注入通用警告而非映射表（见 unknown 平台处理）
};
```

`null` 顶层值 = 与 Claude Code 工具名兼容（已验证），不注入映射表。
`null` 字段值 = 目标平台不支持该工具。

### 注入时机

`dora_load` 返回值新增 `tool_mapping` 字段：

```typescript
interface DoraLoadResponse {
  key: string;
  skill_md_path: string;
  cache_hit: boolean;
  tool_mapping: string | null;    // 新增：映射表文本或通用警告
  detected_platform: PlatformId;  // 新增：当前检测到的平台，方便调试
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

### 各平台注册模板

每个平台使用其原生配置格式，不共用统一模板：

**Claude Code / Gemini CLI / Qwen Code**（JSON `mcpServers`）：
```json
{
  "mcpServers": {
    "dora": {
      "command": "npx",
      "args": ["-y", "TBD-DORA-MCP-ENTRYPOINT"],
      "type": "stdio"
    }
  }
}
```

**Codex**（TOML `[mcp_servers.dora]`）：
```toml
[mcp_servers.dora]
command = "npx"
args = ["-y", "TBD-DORA-MCP-ENTRYPOINT"]
```

**OpenCode**（JSON，`type: "local"` + command 数组）：
```json
{
  "mcp": {
    "dora": {
      "type": "local",
      "command": ["npx", "-y", "TBD-DORA-MCP-ENTRYPOINT"]
    }
  }
}
```

**OpenClaw**（JSON `plugins.entries`）：
```json
{
  "plugins": {
    "entries": {
      "dora": {
        "command": "npx",
        "args": ["-y", "TBD-DORA-MCP-ENTRYPOINT"]
      }
    }
  }
}
```

**注意：** 模板中的 `TBD-DORA-MCP-ENTRYPOINT` 为占位符，实施阶段根据 dora 的 `package.json` bin 字段确定实际 MCP 启动命令（可能是 `dora mcp` 或 `npx -y dora mcp`）。

安装脚本根据检测到的平台选择对应模板，**merge 写入**（不覆盖已有配置）。

### 安装安全要求

- **备份**：写入前将原配置文件复制为 `.bak`
- **原子写入**：通过 temp-file-and-rename 避免写入中断导致配置损坏
- **幂等**：重复安装时检测 dora MCP 条目是否已存在，已存在则跳过，不重复写入
- **解析容错**：如果现有配置文件格式损坏（JSON 语法错误、TOML 解析失败），不覆盖，报错退出并提示用户手动修复
- **深度合并**：仅在目标 key（如 `mcpServers.dora`）插入/更新，保留配置文件中所有其他字段不变

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

## unknown 平台处理

当 `detectPlatform()` 返回 `unknown` 时：

1. `dora_load` 的 `tool_mapping` 字段返回通用警告文本（非映射表）：

```markdown
## Platform Adaptation Warning

Could not detect your CLI platform. This skill uses Claude Code tool names
(Read, Write, Edit, Bash, Skill, Task, etc.). If your CLI uses different
tool names, you may need to adapt the commands manually.

To specify your platform explicitly, set: DORA_PLATFORM=<platform-id>
Supported: claude-code, codex, openclaw, opencode, gemini-cli, qwen-code
```

2. `detected_platform` 字段返回 `"unknown"`，AI 和用户均可看到
3. Skill 仍然正常加载，不阻断流程

## 边界情况

| 场景 | 处理 |
|------|------|
| 检测不到平台（unknown） | 注入通用警告（见上），不 fallback 到 claude-code |
| 平台支持但映射表为 null | 不注入（openclaw/qwen-code，兼容性已验证） |
| Gemini CLI 上 skill 用了 Task | 映射表标注 `Task → Not supported`，AI 自行降级 |
| 新平台上线 | 加一条 env var 检测 + 映射表条目 |
| Qwen Code clientInfo 模式匹配 | `qwen-cli-mcp-client-*` 前缀匹配 |
| OpenCode 工具名大小写 | 当前基于源码分析为小写，上线前需实机验证 |
| 用户手动覆盖 `DORA_PLATFORM` | 最高优先级，跳过所有自动检测 |

## 待验证项

- OpenCode `tool.id` 的实际值（源码中 `Tool.init()` 的 id 字段，当前推断为小写）
- OpenClaw 的 MCP clientInfo.name（当前无标准值，仅通过 `DORA_PLATFORM` 手动指定）
- dora 的实际 MCP 启动命令（`package.json` bin 字段 → 替换模板中的 `TBD-DORA-MCP-ENTRYPOINT`）
- OpenCode `type: "local"` 注册格式的 command 字段是数组还是字符串
