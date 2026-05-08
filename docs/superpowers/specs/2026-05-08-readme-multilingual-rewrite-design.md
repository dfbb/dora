# README 多语言重写设计文档

**日期**: 2026-05-08  
**目标**: 以普通用户为核心受众重写 README.md，同时新建 6 个语言版本，技术细节完整保留

---

## 背景

当前 README.md 以技术语言开头（"Dynamically query and load community skills for AI coding agents"），对普通用户缺乏吸引力。用户核心关切——安全、简单、省 token、离线可用——埋在后半段，不够突出。

此外 dora 尚无任何非英文文档，错过了大量非英文用户。

---

## 目标

1. 让普通用户第一眼看到"这对我有什么用"
2. 清晰讲述 dora 的工作原理（skills.sh → GitHub → 安全识别 → 执行 → 离线回退）
3. 技术参数（config.yaml、CLI 命令、数据路径）完整保留，位置挪到后半段
4. 新建 6 个语言版本：中文、日文、韩文、法文、西班牙文、德文
5. 建立同步规范：每次 README.md 变动，必须同步更新全部语言版本

---

## 文档结构（方案 A）

```
# dora
[语言导航链接行]
> 一句话定位

## 为什么用 dora？        ← 新增，4 个价值要点 bullet
## dora 如何工作          ← 新增，替换现有 "What it does"，5 步流程
## 安装                   ← 保留现有各平台 details
## 使用                   ← 保留 slash command 表格
## 跨平台适配             ← 保留
## 离线回退               ← 保留，补充 local: 前缀说明
## 配置                   ← 保留 config.yaml 完整字段
## CLI 命令               ← 保留完整命令列表
## 数据存储路径           ← 保留
## License
```

---

## Section 设计

### 语言导航链接

```markdown
[中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)
```

放在标题 `# dora` 正下方，定位语之前。

### 一句话定位

```
> 给 AI coding agent 用的技能市场——安全、免安装、离线可用。
```

英文版：
```
> A community skill marketplace for AI coding agents — safe, zero-install, offline-ready.
```

### 为什么用 dora？

```markdown
- 🔒 **只从 GitHub 下载**：每个 skill 来源公开可查，有安全等级标注（safe / warn / danger），你设定阈值，dora 自动过滤
- ⚡ **不占 token**：skill 按需加载，平时不占 context 窗口，用时才读入
- 📦 **不用手动安装**：一条命令查询 + 克隆，无需提前安装任何 skill
- 🌐 **离线可用**：内置约 9,500 个 skill 的本地索引，网络不通时自动切换
```

英文版对应：
```markdown
- 🔒 **GitHub-only downloads**: Every skill is publicly auditable. Each has a security level (`safe` / `warn` / `danger`) — set your threshold and dora filters automatically.
- ⚡ **Zero token overhead**: Skills load on demand. They don't occupy your context window until you actually need them.
- 📦 **No manual installs**: One command to search and clone — no pre-installing skills.
- 🌐 **Offline-ready**: A bundled catalog of ~9,500 skills ships with dora. If the remote engine is unreachable, dora falls back automatically.
```

### dora 如何工作（英文）

```markdown
1. **Query** — Describe your task; dora queries [skills.sh](https://skills.sh) for matching community skills
2. **Download** — The matched skill is cloned from its **GitHub repository** into a local cache
3. **Security check** — Each skill has a security level (`safe` / `warn` / `danger`); dora filters by your configured threshold
4. **Execute** — The skill's `SKILL.md` is loaded into the AI's context and the agent follows its instructions
5. **Offline fallback** — If `api.doraskill.org` is unreachable, dora automatically switches to a local BM25 index (~9,500 skills, bundled — no download needed)
```

---

## 多语言文件规范

| 文件 | 语言 |
|---|---|
| `README.md` | English（主文件） |
| `README.zh.md` | 中文 |
| `README.ja.md` | 日本語 |
| `README.kr.md` | 한국어 |
| `README.fr.md` | Français |
| `README.es.md` | Español |
| `README.de.md` | Deutsch |

每个语言版本：
- 内容与 README.md 完全对应
- 语言导航链接指向各文件（当前语言不加链接，或标注为当前）
- 技术参数（命令、配置字段、路径）保持英文原文，仅说明性文字翻译

---

## 同步规范

**强制规则**：每次 README.md 有任何改动，必须在同一个 commit 中同步更新全部 6 个语言版本。无例外。

已在 `memory/feedback_readme_sync.md` 中记录此规范，确保跨 session 生效。

---

## 实现步骤

1. 重写 `README.md`（英文）
2. 新建 `README.zh.md`（中文）
3. 新建 `README.ja.md`（日文）
4. 新建 `README.kr.md`（韩文）
5. 新建 `README.fr.md`（法文）
6. 新建 `README.es.md`（西班牙文）
7. 新建 `README.de.md`（德文）
8. 更新 memory 中的 README 同步规范记录
9. 一次性 commit 所有文件，bump 版本号（内容变化，但不影响 API，patch 即可）
