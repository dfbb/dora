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
- **平台决定顺序**: 显式参数 > `DORA_PLATFORM` 环境变量 > `ctx.getDetection()`(由 MCP handler 解析,core 不直接检测)。
- **检测为 `unknown`**: 报错,要求用户用平台参数或 `DORA_PLATFORM` 明确指定。
- **拷贝范围**: 只拷 SKILL.md 所在的那一层目录(及其子内容),不拷整个仓库。
- **冲突**: 目标 `<skills-dir>/<name>/` 已存在则跳过,系统目录和缓存都不动。
- **实现**: 新增 MCP 工具 `dora_install`,后端逻辑在 `src/core/install.ts`,SKILL.md 只负责调用工具和展示结果。

## 平台目录映射

集中表 + resolver,放在 `src/platforms`,与现有 `INSTALL_TARGETS` 同风格。映射存「相对 home 的子路径」,由 resolver 拼接 home。**测试 home 作为 resolver 的显式参数注入,不通过普通环境变量影响生产路径**:

```
PLATFORM_SKILLS_SUBDIR = {
  "claude-code": ".claude/skills",
  "codex":       ".codex/skills",
  "opencode":    ".config/opencode/skills",
  "gemini-cli":  ".gemini/skills",
  "qwen-code":   ".qwen/skills",
}

// home 为显式参数,默认 homedir();测试时由调用方传入临时目录
resolvePlatformSkillsDir(platform, home = homedir()) -> string | null
  - sub = PLATFORM_SKILLS_SUBDIR[platform]
  - 不在映射表 -> 返回 null(调用方转为 platform_unknown)
  - 返回 join(home, sub)
```

注:测试通过给 `installSkill` 传 `home` 参数(进而传给 resolver)隔离平台目标目录,**不引入任何会在生产生效的环境变量**;缓存根仍由现有 `DORA_HOME` / `resolveDoraHome()` 控制,两者分开。

## 名称解析

`dora_install({ name, platform? })` 解析 `name` 顺序:

1. 把 `name` 当完整 key(`<skill_name>_<owner>`)在 `status.yaml` 精确匹配。
2. 否则按 `skill_name` 匹配:
   - 唯一命中 → 使用它。
   - 多个同名不同 owner → 返回 `{ error: "ambiguous", candidates: [key...] }`。
   - 无命中 → 返回 `{ error: "not_cached" }`。

空参数(SKILL.md 层处理)→ 调用现有 `dora_list` 展示缓存列表,让用户看有哪些可装。

## 平台解析

平台解析由 **MCP handler** 负责(复用现有 `createHandlers(ctx)` 的平台上下文,与 `dora_load` 一致),解析后把确定的 `platform` 字符串传给 core。core **不再**自己调 `detectRuntimePlatform`。顺序:

1. 显式 `platform` 参数(若传入)。
2. `DORA_PLATFORM` 环境变量。
3. `ctx.getDetection().platform`(默认即 `detectRuntimePlatform(undefined, process.env)`,但走 ctx 注入点,保留 handler 测试与未来 clientInfo 适配能力)。

handler 把解析结果作为 `platform` 传给 `installSkill`。若解析为 `unknown` 或不在映射表内 → core 经 resolver 得到 null → 返回 `{ error: "platform_unknown" }`。

## 核心搬运逻辑(`src/core/install.ts`)

```
installSkill({ name, platform }, home = homedir()) ->
  // platform 已由 handler 解析为确定字符串(见「平台解析」)
  1. 解析得到 cache 条目 entry 和 key(见「名称解析」)
  2. targetBaseDir = resolvePlatformSkillsDir(platform, home)
     // 为 null(unknown 或不在映射表) -> 返回 { error: "platform_unknown" }
  3. cacheRoot 安全校验(key 来自 status.yaml,视为不可信):
     //   - key 必须通过现有 validateName()(`^[a-zA-Z0-9._-]{1,64}$`,天然排除 `/`、`..`、绝对路径)。
     //     不满足 -> 返回 { error: "invalid_skill_path" },不动任何东西。
     cacheRoot = join(skillsDir(), key)
     //   - realCacheRoot = realpathSync(cacheRoot);realSkillsDir = realpathSync(skillsDir())。
     //     realCacheRoot 必须以 realSkillsDir + sep 开头(防 <key> 目录本身是 symlink 逃出 skillsDir)。
     //     解析失败(目录不存在)或越界 -> 返回 { error: "invalid_skill_path" },不动任何东西。
     srcSkillDir = dirname(join(cacheRoot, entry.primary_skill_path))
     // SKILL.md 所在那层目录,这是"修正层次"的关键
     // 源安全校验(用 realpathSync 实际解析,而非仅词法 resolve,以挡住路径组件中的目录 symlink):
     //   - realSrcDir = realpathSync(srcSkillDir);必须以 realCacheRoot + sep 开头(或等于)。
     //     这同时排除 primary_skill_path 中某段是指向缓存外目录的 symlink(如 "link/SKILL.md")。
     //   - skillPath = join(realSrcDir, "SKILL.md");用 lstatSync(skillPath)(不跟随 symlink)
     //     校验 .isFile() —— 即必须是普通文件,而非符号链接。
     //   解析失败或任一不满足 -> 返回 { error: "invalid_skill_path" },不动任何东西。
     //   (后续拷贝以 realSrcDir 为源;拷贝时整棵子树仍拒绝任何 symlink,见第 7 步「拷贝规则」。)
  4. 目标名安全校验:entry.skill_name 必须通过现有 validateName()。
     // 不满足 -> 返回 { error: "invalid_skill_name" },不动任何东西。
     targetDir = join(targetBaseDir, entry.skill_name)
     // 再校验 resolve(targetDir) 以 resolve(targetBaseDir) + sep 开头(纵深防御,防 skill_name 越界)。
     // 不满足 -> 返回 { error: "invalid_skill_name" },不动任何东西。
  5. 若 targetDir 已存在 -> 返回 { skipped: true, reason: "exists", skill_name, platform, target_path }
     // 不动任何东西
  6. mkdirSync(targetBaseDir, { recursive: true })   // 首次安装时平台目录可能不存在
  7. tmpDir = mkdtempSync(join(targetBaseDir, ".dora-install-"))  // 唯一临时目录
     try {
       结构化递归拷贝 realSrcDir -> tmpDir(见下「拷贝规则」),不用 glob、含隐藏文件、拒绝任何 symlink
       校验 join(tmpDir, "SKILL.md") 存在(拷贝成功的兜底检查)
       renameSync(tmpDir, targetDir)   // 同基目录,原子
     } finally {
       若 tmpDir 仍存在(rename 未发生或抛错) -> rmSync(tmpDir, { recursive, force })
     }
     // 此处之前任何抛错都直接冒泡(skill 尚未落地、缓存未动),由 handler 包成 internal。
  8. 移除缓存(可恢复顺序,失败不影响"已安装"事实):
       a. 先从 status.yaml 删 entry 并 writeStatus()。
          // writeStatus 失败 -> 回滚:rmSync(targetDir, { recursive, force }) 删掉刚 rename 的 skill,
          //   再把异常冒泡(handler 包成 internal)。此时 targetDir/status/cache 都回到调用前状态,
          //   用户重试不会卡在"目标已存在 -> skipped"。
       b. writeStatus 成功后:
          try { rmSync(cacheRoot, { recursive: true, force: true }); cacheRemoved = true }
          catch (e) { cacheRemoved = false; cacheCleanupError = e.message }
     // status 已不指向 cacheRoot;若 (b) 失败,缓存目录沦为 orphan(listSkills 已能识别),
     //   不会出现"status 指向不存在目录"的不一致。
  9. 返回 { ok: true, skill_name, platform, source_path, target_path, file_count,
            cache_removed: cacheRemoved, cache_cleanup_error?: cacheCleanupError }
```

关键点:

- 第 3 步把 `key` 与 `primary_skill_path` 都当不可信输入(来自 `status.yaml`):`key` 过 `validateName()`(排除 `/`、`..`、绝对路径),`cacheRoot` 用 `realpathSync` 校验仍在真实 `skillsDir()` 内(防 `<key>` 目录本身是 symlink 逃逸),`srcSkillDir` 同样用 `realpathSync` 实际解析后比较(而非仅词法 `resolve()`,以挡住 `primary_skill_path` 路径组件中指向缓存外的目录 symlink)。后续拷贝以解析后的 `realSrcDir` 为源。第 3 步用 `primary_skill_path` 的父目录,也天然解决「SKILL.md 埋在深层子目录」的问题,落地后 `<targetBaseDir>/<name>/SKILL.md` 一定在顶层。
- 第 4 步同样把来自 `status.yaml` 的 `entry.skill_name` 当不可信输入:先过 `validateName()`,再校验拼出的 `targetDir` 仍在 `targetBaseDir` 内,防止写到平台 skills 目录之外。
- 第 6 步显式建平台基目录:首次安装时 `~/.codex/skills`、`~/.gemini/skills` 等通常不存在。
- 第 7 步用 `mkdtempSync` 生成唯一临时目录(避免同进程多次调用或上次崩溃残留撞名),并在 `finally` 里清理未完成的 temp dir。
- 第 8 步**先写 status 再删缓存**:`writeStatus()` 失败时回滚——删掉第 7 步刚 rename 的 `targetDir`,再冒泡异常,保证 `targetDir`/status/cache 三者一致回到调用前,用户重试不会卡在「目标已存在 → skipped」。`writeStatus()` 成功后再**捕获删缓存异常**:skill 已成功安装(`ok: true`),删缓存失败仅降级为 `cache_removed: false` + `cache_cleanup_error`,语义一致、不会让 handler 误报 internal。
- 临时目录与目标在同一基目录下,保证 `rename` 是同设备原子操作。
- 复用现有 `skillsDir()` / `resolveDoraHome()` 路径函数与 `homedir()`。

### 拷贝规则(第 7 步)

结构化递归拷贝,**不用 glob**(否则会漏掉 `.foo` 这类隐藏文件),自己遍历目录树(`readdirSync(..., { withFileTypes: true })` + 递归)。symlink 策略:**拒绝整棵子树里的任何 symlink**。

- 遍历每个条目用 `lstatSync` / `dirent.isSymbolicLink()` 判定;**遇到任何 symlink(无论指向何处)→ 返回 `invalid_skill_path`,清理 tmpDir,不落地**。
- 理由:只拷 `srcSkillDir` 这一层、随后删除 `cacheRoot`。即便 symlink 指向 `cacheRoot` 内但在 `srcSkillDir` 外,安装后也会变悬空链接或指向目标 skill 目录之外,破坏「只安装这一层、自包含」的语义。全拒绝最简单、可推理。
- 只拷普通文件和目录;隐藏文件(dotfiles)与子目录一并拷贝,保持目录结构原样。
- 不使用 `cpSync` 的 `dereference` 默认行为;若用 `cpSync`,须先自行遍历确认无 symlink 再拷,或在遍历中逐条 `copyFileSync`。

对应测试:含 dotfile 的 skill 目录被完整拷贝;子树中出现任何 symlink(指向缓存外、指向 cacheRoot 内但 srcSkillDir 外、绝对/相对)一律被拒绝,不落地、不删缓存。

### 已知取舍

只拷 SKILL.md 所在那一层目录。如果某个 skill 的 SKILL.md 用 `../` 引用了仓库别处的文件,会断链。绝大多数规范的 Agent Skill 是自包含的,不受影响。此取舍已确认接受。

## 工具注册(`src/mcp/tools.ts`)

- `PlatformContext` 扩展:新增可选 `platformSkillsHome?: string` 作为目标 home 注入点(默认 `undefined` → core 用 `homedir()`)。测试构造 `createHandlers({ getDetection, platformSkillsHome: <临时目录> })`,使 handler 级测试也绝不写真实 `~`。
- `InstallSchema = z.object({ name: z.string().min(1), platform: z.string().optional() })`
- `dora_install` handler:
  - 解析平台:显式 `platform` 参数 > `DORA_PLATFORM` 环境变量 > `ctx.getDetection().platform`(复用现有 `createHandlers(ctx)` 注入点,与 `dora_load` 一致,不在 core 里重复检测逻辑)。
  - 调用 `installSkill({ name, platform: resolved }, ctx.platformSkillsHome ?? homedir())`,JSON 序列化返回;意外抛错走现有 `err()` 包装为 internal。
- `toolDefs` 新增一条:
  - name: `dora_install`
  - description: "Move a cached skill into the current platform's system skills directory."
  - inputSchema: `{ name: string (required), platform: string (optional) }`

## SKILL.md(`skills/dora-install/SKILL.md`)

`user-invocable: true`,触发 `/dora:dora-install <skill> [platform]`。步骤:

1. 空参数 → 调 `dora_list` 展示缓存列表,停。
2. 否则解析第一个词为 `name`、可选第二个词为 `platform`,调 `dora_install`。
3. 按返回 JSON 分支展示:
   - `ok` 且 `cache_removed: true` → 「已把 `<name>` 装到 `<platform>` 的 `<target_path>`,并清理了 dora 缓存。重启会话后可用。」
   - `ok` 且 `cache_removed: false` → 「已把 `<name>` 装到 `<platform>` 的 `<target_path>`,但清理缓存失败(`<cache_cleanup_error>`)。skill 已可用;残留缓存可 `/dora:dora-purge` 清理。」
   - `skipped` → 「`<target_path>` 已存在,未改动。如需重装请先删该目录。」
   - `ambiguous` → 列出候选 key,提示用完整 key 重试。
   - `not_cached` → 提示先 `/dora:dora <任务>` 加载该 skill。
   - `platform_unknown` → 提示加平台参数(claude-code/codex/opencode/gemini-cli/qwen-code)或设 `DORA_PLATFORM`。
   - `invalid_skill_path` / `invalid_skill_name` → 提示缓存条目路径或名称异常(可能 status.yaml 损坏),建议 `/dora:dora-purge` 后重新加载。

文案沿用 `dora-purge` 的简洁风格。

## 测试(`tests/core/install.test.ts`)

覆盖:

- 深层嵌套 SKILL.md(如 `skills/public/foo/SKILL.md`)被提取到目标顶层 `<dir>/foo/SKILL.md`。
- 各平台映射到正确的目标基目录(经 `resolvePlatformSkillsDir`,传入临时 `home`)。
- 首次安装时目标基目录不存在 → 自动创建并成功落地。
- 目标已存在 → 跳过,系统目录和缓存均不动。
- 移除缓存采用「先写 status 再删缓存」:`cache_removed: true`,status.yaml 条目被移除,缓存目录被删。
- 删缓存失败(模拟 `rmSync` 抛错)时,仍返回 `ok: true` + `cache_removed: false` + `cache_cleanup_error`;status 已不含该条目,缓存目录沦为 orphan,无「指向不存在目录」的不一致。
- `writeStatus()` 失败(模拟抛错)时回滚:`targetDir` 被删除、status 与 cache 保持原状,异常冒泡;重试可正常安装(不卡在 skipped)。
- `primary_skill_path` 越界(如 `../../evil/SKILL.md`)→ 返回 `invalid_skill_path`,不拷贝、不删缓存。
- `key` 非法(含 `/`、`..`、或绝对路径,不过 `validateName`)→ 返回 `invalid_skill_path`,不动任何东西。
- `<key>` 目录本身是 symlink 指向 `skillsDir()` 之外 → `realpathSync(cacheRoot)` 越界 → 返回 `invalid_skill_path`,不动任何东西。
- `primary_skill_path` 路径组件含目录 symlink(如 `link/SKILL.md`,`link` 指向缓存外目录)→ `realpathSync(srcSkillDir)` 越界 → 返回 `invalid_skill_path`,不拷贝、不删缓存。
- SKILL.md 本身是 symlink → `lstatSync` 判定非普通文件 → 返回 `invalid_skill_path`,不拷贝、不删缓存。
- 含隐藏文件(dotfile)的 skill 目录 → 被完整拷贝到目标(不被 glob 漏掉)。
- 子树中出现任何 symlink 一律被拒(`invalid_skill_path`),覆盖:
  - 指向缓存外(如 `assets -> /etc/passwd`)。
  - 指向 `cacheRoot` 内但在 `srcSkillDir` 外(如 `srcSkillDir/assets -> ../../shared`)——装完会悬空/越界,必须拒绝。
  - 绝对 symlink 指向 `srcSkillDir` 内(安装后会回指缓存路径,缓存删除后悬空)。
  - 以上均不落地、不删缓存。
- `skill_name` 非法(如 `../../x` 或不过 `validateName`)→ 返回 `invalid_skill_name`,不拷贝、不删缓存。
- `not_cached`、`ambiguous`、`platform_unknown` 错误分支。
- handler 平台解析顺序:显式参数 > `DORA_PLATFORM` > `ctx.getDetection()`(经 `createHandlers` 注入 detection)。

测试隔离注入点:

- core 级:给 `installSkill` 传临时 `home` 参数(进而传给 `resolvePlatformSkillsDir`)。
- handler 级:构造 `createHandlers({ getDetection, platformSkillsHome: <临时目录> })`,handler 透传该 home。
- 两层都**不依赖任何环境变量,绝不写真实 `~/.codex/skills` 等**。
- 缓存根:沿用现有 `DORA_HOME` + 临时目录模式。
- 平台目标目录与缓存根用不同临时目录,确保「源缓存」与「目标平台目录」互不干扰。

## 验证 / 文档 / 发布

- `npm run build`(刷新 cli/start bundle)+ `npm test` + `npm run typecheck`。
- README.md 及 6 个语言版本(zh/ja/kr/fr/es/de)同步加 `/dora:dora-install` 命令说明。
- 版本 0.1.19 → 0.1.20,三处版本号(package.json / `.claude-plugin/plugin.json` / `.claude-plugin/marketplace.json`)同步。
- 按既定约定发布到 npm + GitHub release。
