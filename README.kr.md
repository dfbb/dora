# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · 한국어 · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> AI 코딩 에이전트를 위한 커뮤니티 스킬 마켓플레이스 — 안전하고, 설치 없이, 오프라인에서도 사용 가능.

## 왜 dora인가요?

- 🔒 **GitHub에서만 다운로드**: 모든 스킬은 공개 저장소에서 가져옵니다. 각 스킬에는 보안 등급(`safe` / `warn` / `danger`)이 있으며, 임계값을 설정하면 dora가 자동으로 필터링합니다.
- ⚡ **토큰 소모 없음**: 스킬은 필요할 때만 로드됩니다. 사용하기 전까지 컨텍스트 윈도우를 차지하지 않습니다.
- 📦 **수동 설치 불필요**: 명령어 하나로 검색과 클론이 완료됩니다. 스킬을 미리 설치할 필요가 없습니다.
- 🌐 **오프라인 지원**: 약 9,500개의 스킬로 구성된 로컬 인덱스가 내장되어 있습니다. 원격 엔진에 연결할 수 없으면 자동으로 전환됩니다.

## dora 작동 방식

1. **쿼리** — 작업을 설명하면 dora가 [api.doraskill.org](https://api.doraskill.org)에서 일치하는 커뮤니티 스킬을 검색합니다
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

지원 플랫폼: `claude-code`, `codex`, `opencode`, `gemini-cli`, `qwen-code`.

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
