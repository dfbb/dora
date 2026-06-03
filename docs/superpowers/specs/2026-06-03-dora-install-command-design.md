# dora-install 命令设计

**日期**: 2026-06-03
**状态**: 已批准,待实现

## 目标

新增命令 `/dora:dora-install <skill> [platform]`,把 dora 内部缓存(`~/.dora/skills/`)里的某个 skill **移动**到当前运行平台的系统 skill 目录,并在移动过程中**修正目录层次**,保证 SKILL.md 落在系统目录约定的顶层位置(`<skills-dir>/<name>/SKILL.md`)。

## 背景

dora 的「内部安装」是把整个 GitHub 仓库 `git clone` 到 `~/.dora/skills/<name>_<owner>/`,SKILL.md 经常深埋在子目录里(例如 `plugins/ltk-product/skills/document-processing/SKILL.md`、`skills/public/chart-visualization/SKILL.md`)。`status.yaml` 用 `primary_skill_path` 记录每个 skill 真正的 SKILL.md 相对路径。

而各 AI CLI 的系统 skill 目录期望的是扁平结构:`<skill-name>/SKILL.md` 直接在顶层。所以「修正目录层次」的本质,是从臃肿的仓库里把 SKILL.md 所在的那一层目录提取出来,放到平台目录下。

经调研(2026),五个平台全部支持同样的 Anthropic 风格 `<name>/SKILL.md` 格式,仅全局目录不同:

| 平台 | 全局 skill 目录 |
|---|---|
| claude-code | `~/.claude/skills/` |
| codex | `~/.codex/skills/` |
| opencode | `~/.config/opencode/skills/` |
| gemini-cli | `~/.gemini/skills/` |
| qwen-code | `~/.qwen/skills/` |

## 决策汇总

- **语义**: move —— 拷到平台目录后,删除 `~/.dora` 缓存目录并从 `status.yaml` 移除条目。
- **目标目录**: 按运行时检测到的平台选对应的全局 skills 目录。
- **平台决定顺序**: 显式参数 > `DORA_PLATFORM` 环境变量 > `detectRuntimePlatform()` 运行时检测。
- **检测为 `unknown`**: 报错,要求用户用平台参数或 `DORA_PLATFORM` 明确指定。
- **拷贝范围**: 只拷 SKILL.md 所在的那一层目录(及其子内容),不拷整个仓库。
- **冲突**: 目标 `<skills-dir>/<name>/` 已存在则跳过,系统目录和缓存都不动。
- **实现**: 新增 MCP 工具 `dora_install`,后端逻辑在 `src/core/install.ts`,SKILL.md 只负责调用工具和展示结果。

## 平台目录映射

集中表 + resolver,放在 `src/platforms`,与现有 `INSTALL_TARGETS` 同风格。映射存「相对 home 的子路径」,由 resolver 拼接 home,**resolver 接受可注入的环境/home,便于测试**:

```
PLATFORM_SKILLS_SUBDIR = {
  "claude-code": ".claude/skills",
  "codex":       ".codex/skills",
  "opencode":    ".config/opencode/skills",
  "gemini-cli":  ".gemini/skills",
  "qwen-code":   ".qwen/skills",
}

// 测试可通过 env 注入临时 home,避免写真实 ~/.claude 等
resolvePlatformSkillsDir(platform, env = process.env) -> string | null
  - home = env.DORA_TEST_HOME ?? homedir()
  - sub = PLATFORM_SKILLS_SUBDIR[platform]
  - 不在映射表 -> 返回 null(调用方转为 platform_unknown)
  - 返回 join(home, sub)
```

注:`DORA_TEST_HOME` 仅用于测试隔离平台目标目录,与现有 `DORA_HOME`(缓存根)分开,避免互相干扰。

## 名称解析

`dora_install({ name, platform? })` 解析 `name` 顺序:

1. 把 `name` 当完整 key(`<skill_name>_<owner>`)在 `status.yaml` 精确匹配。
2. 否则按 `skill_name` 匹配:
   - 唯一命中 → 使用它。
   - 多个同名不同 owner → 返回 `{ error: "ambiguous", candidates: [key...] }`。
   - 无命中 → 返回 `{ error: "not_cached" }`。

空参数(SKILL.md 层处理)→ 调用现有 `dora_list` 展示缓存列表,让用户看有哪些可装。

## 平台解析

`dora_install` 解析目标平台顺序:

1. 显式 `platform` 参数(若传入)。
2. `DORA_PLATFORM` 环境变量。
3. `detectRuntimePlatform(undefined, process.env)` 运行时检测。

若最终为 `unknown` 或不在映射表内 → 返回 `{ error: "platform_unknown" }`。

## 核心搬运逻辑(`src/core/install.ts`)

```
installSkill({ name, platform? }, env = process.env) ->
  1. 解析得到 cache 条目 entry 和 key(见「名称解析」)
  2. 解析 platform -> targetBaseDir = resolvePlatformSkillsDir(platform, env)
     // 为 null(unknown 或不在映射表) -> 返回 { error: "platform_unknown" }
  3. cacheRoot = <DORA_HOME>/skills/<key>
     srcSkillDir = dirname(join(cacheRoot, entry.primary_skill_path))
     // SKILL.md 所在那层目录,这是"修正层次"的关键
     // 安全校验:resolve(srcSkillDir) 必须以 resolve(cacheRoot) + sep 开头(或等于 cacheRoot),
     //          且 join(srcSkillDir, "SKILL.md") 必须是普通文件(statSync().isFile())。
     //          任一不满足 -> 返回 { error: "invalid_skill_path" },不动任何东西。
  4. targetDir = join(targetBaseDir, entry.skill_name)
  5. 若 targetDir 已存在 -> 返回 { skipped: true, reason: "exists" },不动任何东西
  6. mkdirSync(targetBaseDir, { recursive: true })   // 首次安装时平台目录可能不存在
  7. tmpDir = mkdtempSync(join(targetBaseDir, ".dora-install-"))  // 唯一临时目录
     try {
       递归拷贝 srcSkillDir/* -> tmpDir/
       校验 join(tmpDir, "SKILL.md") 存在(拷贝成功的兜底检查)
       renameSync(tmpDir, targetDir)   // 同基目录,原子
     } finally {
       若 tmpDir 仍存在(rename 未发生或抛错) -> rmSync(tmpDir, { recursive, force })
     }
  8. 移除缓存(可恢复顺序):
       a. 先从 status.yaml 删 entry 并 writeStatus()
       b. 再 rmSync(cacheRoot, { recursive: true, force: true })
     // 若 (b) 失败:status 已不指向它,缓存目录沦为 orphan(listSkills 已能识别 orphan),
     //   不会出现"status 指向不存在目录"的不一致。
  9. 返回 { ok: true, skill_name, platform, source_path, target_path, file_count, cache_removed: true }
```

关键点:

- 第 3 步用 `primary_skill_path` 的父目录,天然解决「SKILL.md 埋在深层子目录」的问题,落地后 `<targetBaseDir>/<name>/SKILL.md` 一定在顶层;同时校验该路径不越出缓存仓库(防 `status.yaml` 被污染成 `../../SKILL.md` 导致拷贝缓存外目录)。
- 第 6 步显式建平台基目录:首次安装时 `~/.codex/skills`、`~/.gemini/skills` 等通常不存在。
- 第 7 步用 `mkdtempSync` 生成唯一临时目录(避免同进程多次调用或上次崩溃残留撞名),并在 `finally` 里清理未完成的 temp dir。
- 第 7 步先确认 SKILL.md 拷贝到位、再 `rename`;第 8 步**先写 status 再删缓存**,保证不会出现「缓存已删但 status 仍指向」的不可恢复不一致。
- 临时目录与目标在同一基目录下,保证 `rename` 是同设备原子操作。
- 复用现有 `skillsDir()` / `resolveDoraHome()` 路径函数与 `homedir()`。

### 已知取舍

只拷 SKILL.md 所在那一层目录。如果某个 skill 的 SKILL.md 用 `../` 引用了仓库别处的文件,会断链。绝大多数规范的 Agent Skill 是自包含的,不受影响。此取舍已确认接受。

## 工具注册(`src/mcp/tools.ts`)

- `InstallSchema = z.object({ name: z.string().min(1), platform: z.string().optional() })`
- `dora_install` handler:校验参数后调用 `installSkill({ name, platform })`,JSON 序列化返回;错误走现有 `err()` 包装。
- `toolDefs` 新增一条:
  - name: `dora_install`
  - description: "Move a cached skill into the current platform's system skills directory."
  - inputSchema: `{ name: string (required), platform: string (optional) }`

## SKILL.md(`skills/dora-install/SKILL.md`)

`user-invocable: true`,触发 `/dora:dora-install <skill> [platform]`。步骤:

1. 空参数 → 调 `dora_list` 展示缓存列表,停。
2. 否则解析第一个词为 `name`、可选第二个词为 `platform`,调 `dora_install`。
3. 按返回 JSON 分支展示:
   - `ok` → 「已把 `<name>` 装到 `<platform>` 的 `<target_path>`,并清理了 dora 缓存。重启会话后可用。」
   - `skipped` → 「`<target_path>` 已存在,未改动。如需重装请先删该目录。」
   - `ambiguous` → 列出候选 key,提示用完整 key 重试。
   - `not_cached` → 提示先 `/dora:dora <任务>` 加载该 skill。
   - `platform_unknown` → 提示加平台参数(claude-code/codex/opencode/gemini-cli/qwen-code)或设 `DORA_PLATFORM`。
   - `invalid_skill_path` → 提示缓存条目的 SKILL.md 路径异常(可能 status.yaml 损坏),建议 `/dora:dora-purge` 后重新加载。

文案沿用 `dora-purge` 的简洁风格。

## 测试(`tests/core/install.test.ts`)

覆盖:

- 深层嵌套 SKILL.md(如 `skills/public/foo/SKILL.md`)被提取到目标顶层 `<dir>/foo/SKILL.md`。
- 各平台映射到正确的目标基目录(经 `resolvePlatformSkillsDir`,注入 `DORA_TEST_HOME`)。
- 首次安装时目标基目录不存在 → 自动创建并成功落地。
- 目标已存在 → 跳过,系统目录和缓存均不动。
- 移除缓存采用「先写 status 再删缓存」:status.yaml 条目被移除,缓存目录被删。
- 删缓存失败(模拟 `rmSync` 抛错)时,status 已不含该条目,缓存目录沦为 orphan,无「指向不存在目录」的不一致。
- `primary_skill_path` 越界(如 `../../evil/SKILL.md`)→ 返回 `invalid_skill_path`,不拷贝、不删缓存。
- `not_cached`、`ambiguous`、`platform_unknown` 错误分支。

测试隔离注入点:

- 平台目标目录:通过 `DORA_TEST_HOME` 环境变量注入临时 home,`resolvePlatformSkillsDir` 据此拼接,**绝不写真实 `~/.codex/skills` 等**。
- 缓存根:沿用现有 `DORA_HOME` + 临时目录模式。
- 两者用不同临时目录,确保「源缓存」与「目标平台目录」互不干扰。

## 验证 / 文档 / 发布

- `npm run build`(刷新 cli/start bundle)+ `npm test` + `npm run typecheck`。
- README.md 及 6 个语言版本(zh/ja/kr/fr/es/de)同步加 `/dora:dora-install` 命令说明。
- 版本 0.1.19 → 0.1.20,三处版本号(package.json / `.claude-plugin/plugin.json` / `.claude-plugin/marketplace.json`)同步。
- 按既定约定发布到 npm + GitHub release。
