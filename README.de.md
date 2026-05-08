# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · [Español](README.es.md) · Deutsch

> Ein Community-Skill-Marktplatz für KI-Coding-Agenten — sicher, ohne Installation, offline verfügbar.

## Warum dora?

- 🔒 **Nur Downloads von GitHub**: Jeder Skill ist öffentlich überprüfbar. Jeder hat ein Sicherheitslevel (`safe` / `warn` / `danger`) — legen Sie Ihren Schwellenwert fest und dora filtert automatisch.
- ⚡ **Null Token-Overhead**: Skills werden on demand geladen. Sie belegen Ihr Kontextfenster nicht, bis Sie sie tatsächlich benötigen.
- 📦 **Keine manuellen Installationen**: Ein Befehl zum Suchen und Klonen — keine Vorinstallation von Skills.
- 🌐 **Offline verfügbar**: Ein gebündelter Katalog mit ~9.500 Skills ist in dora enthalten. Wenn der Remote-Engine nicht erreichbar ist, wechselt dora automatisch.

## Wie dora funktioniert

1. **Abfrage** — Beschreiben Sie Ihre Aufgabe; dora fragt [api.doraskill.org](https://api.doraskill.org) nach passenden Community-Skills
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

Unterstützte Plattformen: `claude-code`, `codex`, `opencode`, `gemini-cli`, `qwen-code`.

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
