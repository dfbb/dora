# dora

[English](README.md) · [中文](README.zh.md) · 日本語 · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md)

> AIコーディングエージェント向けのコミュニティスキルマーケットプレイス — 安全・インストール不要・オフライン対応。

## なぜ dora を使うのか？

- 🔒 **GitHubからのみダウンロード**：すべてのスキルは公開リポジトリから取得。セキュリティレベル（`safe` / `warn` / `danger`）が付与されており、閾値を設定すれば dora が自動でフィルタリングします。
- ⚡ **トークンを消費しない**：スキルはオンデマンドで読み込まれ、使用するまでコンテキストウィンドウを占有しません。
- 📦 **手動インストール不要**：コマンド1つで検索・クローンが完了。スキルを事前にインストールする必要はありません。
- 🌐 **オフライン対応**：約9,500件のスキルがバンドルされたローカルインデックスを内蔵。リモートエンジンに接続できない場合は自動的に切り替わります。

## dora の仕組み

1. **クエリ** — タスクを説明すると、dora が [api.doraskill.org](https://api.doraskill.org) に対して一致するコミュニティスキルを検索します
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

対応プラットフォーム：`claude-code`、`codex`、`opencode`、`gemini-cli`、`qwen-code`。

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
