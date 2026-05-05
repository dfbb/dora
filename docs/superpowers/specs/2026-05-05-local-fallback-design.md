# Local BM25 Fallback for `dora_query`

**Date:** 2026-05-05
**Status:** Approved (brainstorming complete, ready for implementation plan)

## 概述

当 `dora_query` 调用远程引擎失败(网络不可达或服务返回 5xx/429)时,自动降级到本地 BM25 全文搜索,基于嵌入在 bundle 内的 `asset/skillsh.json.gz`(9,465 条 skill 快照,压缩 1.8MB / 解压 11.9MB)返回候选结果。降级对调用方透明,仅在返回 JSON 中加 `source: "local"` 字段标识。

## 动机

`src/core/query.ts` 当前只有远程路径——远程引擎挂了,`dora_query` 整个失效。本设计在 catch 分支加一条本地兜底,保持 dora 在离线/远程异常时仍可用。

参考 `3rd/skill-manager` 的离线检索思路,但其朴素 `includes()` 加权打分排序质量偏弱;本方案用 BM25(via `minisearch`)显著改善排序,无 SQLite/原生依赖。

## 决策摘要(已和用户确认)

| 决策点 | 选择 |
|---|---|
| 触发条件 | 仅 `ENGINE_UNREACHABLE` 与 `HTTP_ERROR(status≥500 \|\| status===429)`;其它 4xx 直接返回原错;`EMPTY_CANDIDATES` 不降级 |
| 引擎技术 | 纯 JS BM25(`minisearch` 库),不引入 SQLite |
| 数据分发 | 嵌入 bundle(esbuild `loader: { ".gz": "binary" }`) |
| 来源标识 | 返回顶层 `source` 字段 + stderr warn 日志 |
| security_level 推导 | 任一 Fail→danger;全 Pass→safe;其它(含缺失)→warn |
| 配置开关 | 无,自动行为 |

## 架构

### 模块布局

```
src/
├── core/
│   ├── query.ts          [不变]   远程 HTTP 客户端
│   └── local-query.ts    [新增]   本地 BM25 + 数据加载 + 字段映射
├── mcp/
│   └── tools.ts          [改动]   dora_query 编排降级
├── diagnostics/checks/
│   └── local-index.ts    [新增]   doctor 检查嵌入资产可用
└── core/errors.ts        [改动]   +LOCAL_INDEX_BROKEN

esbuild.config.mjs         [改动]   +.gz binary loader
package.json               [改动]   +minisearch, +.npmignore asset/

tests/core/local-query.test.ts  [新增]
tests/mcp/tools.test.ts         [改动]   +降级集成用例
tests/fixtures/skillsh-mini.json.gz  [新增]   ~6 条精选 fixture
```

### 职责分离

- `core/query.ts`:HTTP 客户端,**不变**,保持单一职责
- `core/local-query.ts`:本地数据加载、索引构建(单例)、查询执行
- `mcp/tools.ts#dora_query`:编排层——决定何时降级、合成错误消息

降级判定逻辑放在 `tools.ts`(orchestration 层),而不是 `query.ts`,理由:`query.ts` 只关心"如何调远程",`tools.ts` 本来就是各 core 模块的编排者,降级是编排关切。

## 数据流

### 正常路径(远程通)

```
MCP client → dora_query → loadConfig → queryEngine(POST /retrieve)
                                          ↓ 200, skills.length > 0
                                     appendQueryLog
                                          ↓
                          { skills: [...], source: "remote" }
```

### 降级路径(远程挂)

```
queryEngine throws DoraError
        ↓ tools.ts catch
判 code 与 status:
  ENGINE_UNREACHABLE                        → 降级
  HTTP_ERROR && (status>=500 || status===429) → 降级
  HTTP_ERROR && 4xx (其它)                  → 不降级,返回原错(配置/鉴权问题应暴露)
  EMPTY_CANDIDATES / VALIDATION             → 不降级,返回原错
        ↓
console.error("[dora] remote engine <code>, falling back to local")
        ↓
localQuery(query, topK)
   │
   ├─ 首次:loadSkillsCorpus()
   │     ├─ loadEmbeddedAsset()  ← 默认嵌入,DORA_ASSET_DIR 可覆盖(测试用)
   │     ├─ gunzipSync → JSON.parse
   │     ├─ 校验 schema_version === 1
   │     └─ map skills → SkillCandidate[](含 security_level 推导,组合 _local_id)
   ├─ 首次:buildIndex(corpus)  ~150ms
   └─ 后续:复用闭包中的 index 单例
        ↓
   minisearch.search(query, { combineWith: "AND", prefix: true, fuzzy: 0.2 })
        ↓ 取 topK,join corpus,strip _local_id
appendQueryLog
        ↓
   { skills: [...], source: "local" }
```

## 字段映射

`asset/skillsh.json` 单条 → `SkillCandidate`:

| skillsh 字段 | SkillCandidate 字段 | 备注 |
|---|---|---|
| `name` | `name` | 直接 |
| `github_url` | `url` | **必须用 `github_url`(仓库根),不是 `skill_url`**——`url` 会被 `dora_load` 当 `repo_url` 传给 `validateRepoUrl`,后者只接受 GitHub 仓库根 URL(见 `src/core/validate.ts`)。asset 中 8,883/9,465 条 `skill_url` 是 `/tree/...` 子路径,会校验失败 |
| `skill_url` | `skill_path_url` | 保留供展示/定位子目录,不参与 dora_load |
| `summary` | `description_en` | skillsh 没有 `description`,`summary` 是描述 |
| `github_star` | `github_stars` | 单复数改名 |
| `author` | `author` | 直接 |
| `source_slug` | `source_slug` | 索引字段,也用于组合 ID |
| `skill_id` | `skill_id` | 保留为字段(不唯一,见下) |
| 3 × security_* | `security_level` | 推导(下) |
| 其他 | 丢弃 | `detail_seen_at` / `namespace` / `marketplace` / `detail_status` / `installation` / `installs` / `list_seen_at` / `github_pushed_at` / `github_seen_at` / `github_updated_at` / `github_fork` |

### 唯一主键(组合 ID)

asset 内 `skill_id` 有 831 组重复(如 `skill-creator` 出现 26 次),直接当主键会冲掉 1,244 条记录。改用**组合内部 ID**:

```ts
const localId = `${source_slug}#${skill_id}`;
```

`localId` 仅用于 minisearch `idField` 与 corpus Map 主键,**不暴露**给 `SkillCandidate` 返回结果(避免污染对外 schema)。`skill_id` 字段照常返回,但消费方不应假设其唯一。

### security_level 推导

```ts
function deriveSecurityLevel(s: RawSkill): SecurityLevel {
  const vals = [s.security_snyk, s.security_socket, s.security_trusthub];
  if (vals.some(v => v === "Fail")) return "danger";
  if (vals.every(v => v === "Pass")) return "safe";
  return "warn";  // 缺字段/Warn 都归 warn
}
```

不返回 `unknown`,因为 `unknown` 在系统其它地方语义不明,且把"快照里没填"和"真未知"混在一起没意义。**注意:本地 fallback 不按 `cfg.min_security_level` 过滤**——目前 `dora_query`(包括远程路径)都不做服务端过滤,过滤是 dora_load/调用方的职责。本地保持一致,不引入新行为差异。

## 索引配置

```ts
new MiniSearch({
  fields: ["name", "description_en", "source_slug", "author"],
  storeFields: [
    "name", "url", "skill_path_url", "description_en", "github_stars",
    "security_level", "source_slug", "author", "skill_id",
  ],
  idField: "_local_id",   // 内部组合 ID，不返回
  searchOptions: {
    boost: { name: 3, description_en: 2, source_slug: 1.5, author: 1 },
    combineWith: "AND",
    prefix: true,
    fuzzy: 0.2,
  },
})
```

BM25 参数 k1/b 用 minisearch 默认值。返回 SkillCandidate 时 strip 掉 `_local_id`。

## 索引单例

```ts
let _idx: { mini: MiniSearch; corpus: Map<string, SkillCandidate> } | null = null;

async function getIndex() {
  if (_idx) return _idx;
  const corpus = await loadSkillsCorpus();
  const mini = buildMiniSearch(corpus);
  _idx = { mini, corpus: new Map(corpus.map(s => [s._local_id, s])) };
  return _idx;
}

// 测试边界——只在 NODE_ENV === "test" 或始终导出但用 __ 前缀,以 vitest 通过 import 直接调
export function __resetLocalIndexForTest(): void { _idx = null; }
```

- MCP server 长驻进程:首查 ~150ms,后续 ~10ms(基于 9.5k 条规模)
- CLI 一次性命令:目前无路径触发本地降级,懒加载策略对未来扩展友好

## 资产嵌入与测试可注入边界

### 生产路径(嵌入)

`esbuild.config.mjs`:

```js
{
  loader: { ".gz": "binary" },
}
```

`local-query.ts` 内部分两个函数,**测试边界明确化**:

```ts
import embeddedSkillshGz from "../../asset/skillsh.json.gz";
// 类型: declare module "*.gz" { const x: Uint8Array; export default x; }

// 默认走嵌入资产
async function loadEmbeddedAsset(): Promise<Uint8Array> {
  const dir = process.env.DORA_ASSET_DIR;
  if (dir) {
    // 测试 / 排障专用:从外部目录读 skillsh.json.gz
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(dir, "skillsh.json.gz"));
  }
  return embeddedSkillshGz;
}

async function loadSkillsCorpus(): Promise<SkillCandidate[]> {
  const raw = await loadEmbeddedAsset();
  const json = JSON.parse(gunzipSync(Buffer.from(raw)).toString("utf8"));
  if (json.schema_version !== 1) throw new DoraError(ERR.LOCAL_INDEX_BROKEN, ...);
  return json.skills.map(mapToCandidate);
}
```

测试用 `DORA_ASSET_DIR` 指向 fixture 目录;同时通过 `__resetLocalIndexForTest()` 在 `afterEach` 清单例,避免用例间污染(损坏 gzip / 文件不存在 / 单例复用 三类用例尤需)。

bundle 体积:`cli.bundle.mjs` 与 `start.bundle.mjs` 各 +~1.8MB(总安装占用 ~3-4MB)。`asset/` 通过 `.npmignore` 排除,不再以外部文件发布。

## 错误处理

### 错误码新增

```ts
ERR.LOCAL_INDEX_BROKEN = "local_index_broken"
```

### 错误处理矩阵

| 阶段 | 失败模式 | 处理 |
|---|---|---|
| loadSkillsCorpus | gunzip 失败 / JSON 损坏 / schema_version ≠ 1 | 抛 `LOCAL_INDEX_BROKEN` |
| buildIndex | minisearch 抛 | 抛 `LOCAL_INDEX_BROKEN` |
| localQuery | search 返回空 | 抛 `EMPTY_CANDIDATES`(与远程空结果共用 code) |
| 远程 `HTTP_ERROR` 4xx(非 429) | 配置/鉴权/无效请求 | 不降级,直接返回原错 |
| 远程 code 不在白名单 | `EMPTY_CANDIDATES` / `VALIDATION` 等 | 不降级,直接返回原错 |

### 降级失败时的合成错误

远程失败 + 本地也失败:

```json
{
  "error": "engine_unreachable",
  "message": "remote engine unreachable; local fallback also failed: <reason>",
  "detail": {
    "remote_code": "engine_unreachable",
    "local_code": "local_index_broken"
  }
}
```

沿用原 remote error code,避免新增 `fallback_failed` 噪声。

## 测试策略

### `tests/core/local-query.test.ts`(新增)

用一个 ~6 条的 fixture(`tests/fixtures/skillsh-mini.json.gz`)替代真 1.8MB asset,通过 `DORA_ASSET_DIR` 环境变量切换。每个用例 `beforeEach` 调用 `__resetLocalIndexForTest()` 清单例,避免污染。

| # | 用例 | 验证点 |
|---|---|---|
| 1 | 加载 fixture 成功 | corpus 字段已映射,`url` 用 `github_url`、`skill_path_url` 保留 `skill_url` |
| 2 | security 三档推导 | 全 Pass→safe;任一 Fail→danger;其它→warn |
| 3 | 缺失 security 字段 | 推导为 warn |
| 4 | schema_version ≠ 1 | 抛 `LOCAL_INDEX_BROKEN` |
| 5 | gz 损坏 | 抛 `LOCAL_INDEX_BROKEN`(测试前 reset 单例) |
| 6 | 文件不存在 | 抛 `LOCAL_INDEX_BROKEN`(测试前 reset 单例) |
| 7 | 简单 token 命中 name | 排第一 |
| 8 | name 命中 vs description 命中 | name boost 更高,排前 |
| 9 | prefix 匹配("test"→"testing") | 命中 |
| 10 | fuzzy 容错(1 字符 typo) | 命中 |
| 11 | 多 token AND | 全部命中优先 |
| 12 | 完全没匹配 | 抛 `EMPTY_CANDIDATES` |
| 13 | topK 截断 | 长度 ≤ topK |
| 14 | 索引单例复用 | 同一 `_idx` 引用,第二次调用不重新解压 |
| 15 | 重复 `skill_id` 不冲掉 | fixture 含两条同 `skill_id` 不同 `source_slug`,corpus 长度 = 2 |
| 16 | 返回 source 字段 | `source: "local"`,且不暴露 `_local_id` |

### `tests/mcp/tools.test.ts`(改动)

| # | 用例 | 验证 |
|---|---|---|
| A | remote 200 | `source: "remote"`,本地 spy 未调 |
| B | remote 网络错误 | `source: "local"`,stderr 有 warn |
| C | remote 502 | 降级,`source: "local"`,code 路径 = `http_error` |
| C2 | remote 429 | 降级,`source: "local"` |
| D | remote `EMPTY_CANDIDATES` | 返回原 `empty_candidates`,本地 spy 未调 |
| D2 | remote 401 / 403 / 404 | **不降级**,返回原 `http_error`,本地 spy 未调 |
| E | remote 失败 + 本地损坏 | 合成错误带 `detail.remote_code` + `detail.local_code` |

### Fixture

`tests/fixtures/skillsh-mini.json` → 手写 ~6 条覆盖三档 security、prefix/fuzzy/AND 用例、**至少一对重复 `skill_id` + 不同 `source_slug`** 验证组合 ID → gzip 提交。

### 不测的

- minisearch 自身 BM25 数学
- 标准库 gzip/JSON.parse
- 真 asset 性能(无 SLO)

## 依赖与配置

### `package.json`

```diff
 "dependencies": {
   "@modelcontextprotocol/sdk": "^1.0.0",
+  "minisearch": "^7.0.0",
   "yaml": "^2.5.0",
   "zod": "^3.23.0"
 }
```

minisearch 7.x:零子依赖,~6KB gz,纯 ESM。

### `.npmignore`

```diff
+asset/
```

### 用户 `config.yaml`

不新增字段。降级是自动兜底,不暴露开关(YAGNI)。

## 诊断

`src/diagnostics/checks/local-index.ts` 新增一项:启动一次 `loadSkillsCorpus()` + `buildIndex()`,失败时报 `LOCAL_INDEX_BROKEN`。`dora_doctor` 自动包含。

## 向后兼容

| 接口 | 兼容性 |
|---|---|
| `dora_query` 返回 schema | 仅加 `source` 字段,旧消费方忽略未知字段 |
| `core/query.ts` 公共 API | 不变 |
| `tools.ts` 公共 API | 不变 |
| 错误码 | 仅新增 `LOCAL_INDEX_BROKEN` |
| 用户 `~/.dora/config.yaml` | 不变 |
| `engines` | `node>=18` 不变 |

## 文档

- `README.md` "What it does" 加一句关于本地降级的描述
- `README.md` 新增 "Offline Fallback" 章节:触发条件、`source` 字段、诊断命令
- 本设计文档(`docs/superpowers/specs/2026-05-05-local-fallback-design.md`)随实现一起提交

## 不做(显式 YAGNI)

- 用户自定义 asset 路径配置(测试用 `DORA_ASSET_DIR` env 即够)
- asset 自动更新(用户 `npm update dora` 拿新快照)
- 中文搜索(数据是英文 summary)
- 性能 SLO
- 远程/本地结果合并去重(降级是 either-or)
- 部分降级(`EMPTY_CANDIDATES` 时再补)
- `enable_local_fallback` 配置开关
