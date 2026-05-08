# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · Français · [Español](README.es.md) · [Deutsch](README.de.md)

> Un marketplace de compétences communautaires pour les agents IA — sûr, sans installation, disponible hors ligne.

## Pourquoi dora ?

- 🔒 **Téléchargements GitHub uniquement** : Chaque skill est vérifiable publiquement. Chacun possède un niveau de sécurité (`safe` / `warn` / `danger`) — définissez votre seuil et dora filtre automatiquement.
- ⚡ **Zéro overhead de tokens** : Les skills se chargent à la demande. Ils n'occupent pas votre fenêtre de contexte tant que vous n'en avez pas besoin.
- 📦 **Aucune installation manuelle** : Une seule commande pour rechercher et cloner — sans pré-installer les skills.
- 🌐 **Disponible hors ligne** : Un catalogue de ~9 500 skills est intégré à dora. Si le moteur distant est inaccessible, dora bascule automatiquement.

## Comment fonctionne dora

1. **Requête** — Décrivez votre tâche ; dora interroge [api.doraskill.org](https://api.doraskill.org) pour trouver les skills communautaires correspondants
2. **Téléchargement** — Le skill correspondant est cloné depuis son **dépôt GitHub** dans un cache local
3. **Vérification de sécurité** — Chaque skill possède un niveau de sécurité (`safe` / `warn` / `danger`) ; dora filtre selon votre seuil configuré
4. **Exécution** — Le `SKILL.md` du skill est chargé dans le contexte de l'IA et l'agent suit ses instructions
5. **Fallback hors ligne** — Si `api.doraskill.org` est inaccessible, dora bascule automatiquement sur un index BM25 local (~9 500 skills, inclus — aucun téléchargement nécessaire)

## Installation

<details open>
<summary><strong>Claude Code</strong> — marketplace de plugins, entièrement automatique</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Redémarrez Claude Code (ou exécutez `/reload-plugins`).

| Commande slash | Fonction |
|---|---|
| `/dora:dora <tâche>` | Rechercher, choisir, charger et exécuter un skill. Sans arguments → liste le cache. |
| `/dora:dora local: <tâche>` | Identique, mais recherche uniquement dans l'index local (ignore le moteur distant). |
| `/dora:dora-stats` | Statistiques d'utilisation. |
| `/dora:dora-doctor` | Diagnostics. |
| `/dora:dora-upgrade` | Mettre à jour dora. |
| `/dora:dora-purge` | Supprimer tous les skills en cache. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Fusionne le serveur MCP dans `~/.codex/config.toml` (fusion TOML profonde, sauvegarde `.bak`), le hook SessionStart dans `~/.codex/hooks.json`, et ajoute le routage à `~/.codex/AGENTS.md`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Écrit `opencode.json` (fusion profonde) et ajoute le routage à `AGENTS.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Fusionne le serveur MCP dans `~/.gemini/settings.json` et ajoute le routage à `GEMINI.md`.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Fusionne le serveur MCP dans `settings.json`.

</details>

## Adaptateur multiplateforme

dora détecte automatiquement la plateforme CLI en cours d'exécution et adapte le chargement des skills.

**Priorité de détection :** variable d'environnement `DORA_PLATFORM` → MCP clientInfo → signaux d'environnement → fallback.

Lorsque `dora_load` retourne un `execution_context` non nul, l'agent l'affiche avant d'exécuter le skill — cela inclut les mappages de noms d'outils ou les avertissements de compatibilité pour les plateformes non vérifiées.

Plateformes supportées : `claude-code`, `codex`, `opencode`, `gemini-cli`, `qwen-code`.

## Fallback hors ligne

`dora_query` bascule automatiquement sur un catalogue local quand le moteur distant est inaccessible.

- **Déclencheurs :** `engine_unreachable` (réseau/timeout) ou `http_error` avec statut ≥ 500 ou 429. Les autres erreurs 4xx sont renvoyées à l'appelant telles quelles.
- **Forcer le local :** Passez `local_only: true` à `dora_query` (ou utilisez `/dora:dora local: <tâche>`) pour ignorer le moteur distant.
- **Catalogue :** ~9 465 skills, inclus dans le package npm (aucun téléchargement supplémentaire).
- **Format des résultats :** identique au distant (`{skills: [...]}`) avec un champ `source: "remote" | "local"` ajouté.
- **Diagnostics :** `dora_doctor` inclut une vérification de l'index local.

Les résultats vides du moteur distant (`empty_candidates`) ne déclenchent pas le fallback.

## Configuration

`~/.dora/config.yaml` (ou `./.dora/config.yaml` pour un projet local) :

```yaml
skill_query_url: http://api.doraskill.org  # URL du moteur de requêtes
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Commandes

```
dora query <text>              Rechercher dans le moteur de skills
dora load <name> <url> <lvl>   Cloner et mettre en cache un skill
dora touch <key>               Marquer un skill en cache comme utilisé
dora list                      Lister les skills en cache
dora stats                     Statistiques d'utilisation
dora doctor                    Diagnostics
dora upgrade                   Mettre à jour dora
dora purge --yes               Supprimer tous les skills en cache
dora mcp                       Démarrer le serveur MCP stdio
dora install [platform]        Détecter automatiquement ou spécifier la plateforme
```

## Données

- Cache : `~/.dora/skills/<name>_<owner>/`
- Statut : `~/.dora/skills/status.yaml`
- Journal des requêtes : `~/.dora/query-log.jsonl`
- Configuration : `~/.dora/config.yaml` (non supprimé par purge)

## License

MIT
