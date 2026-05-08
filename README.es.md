# dora

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.kr.md) · [Français](README.fr.md) · Español · [Deutsch](README.de.md)

> Un marketplace de habilidades comunitarias para agentes de IA — seguro, sin instalación, disponible sin conexión.

## ¿Por qué dora?

- 🔒 **Solo descargas desde GitHub**: Cada skill es auditable públicamente. Cada uno tiene un nivel de seguridad (`safe` / `warn` / `danger`) — establece tu umbral y dora filtra automáticamente.
- ⚡ **Sin overhead de tokens**: Los skills se cargan bajo demanda. No ocupan tu ventana de contexto hasta que los necesites.
- 📦 **Sin instalaciones manuales**: Un solo comando para buscar y clonar — sin preinstalar skills.
- 🌐 **Disponible sin conexión**: Un catálogo de ~9.500 skills viene incluido con dora. Si el motor remoto no está disponible, dora cambia automáticamente.

## Cómo funciona dora

1. **Consulta** — Describe tu tarea; dora consulta [api.doraskill.org](https://api.doraskill.org) para encontrar skills comunitarios coincidentes
2. **Descarga** — El skill coincidente se clona desde su **repositorio GitHub** a un caché local
3. **Verificación de seguridad** — Cada skill tiene un nivel de seguridad (`safe` / `warn` / `danger`); dora filtra según tu umbral configurado
4. **Ejecución** — El `SKILL.md` del skill se carga en el contexto de la IA y el agente sigue sus instrucciones
5. **Fallback sin conexión** — Si `api.doraskill.org` no está disponible, dora cambia automáticamente a un índice BM25 local (~9.500 skills, incluido — sin descargas necesarias)

## Instalación

<details open>
<summary><strong>Claude Code</strong> — marketplace de plugins, completamente automático</summary>

```bash
/plugin marketplace add dfbb/dora
/plugin install dora@dora
```

Reinicia Claude Code (o ejecuta `/reload-plugins`).

| Comando slash | Función |
|---|---|
| `/dora:dora <tarea>` | Buscar, seleccionar, cargar y ejecutar un skill. Sin argumentos → lista el caché. |
| `/dora:dora local: <tarea>` | Igual, pero solo busca en el índice local (omite el motor remoto). |
| `/dora:dora-stats` | Estadísticas de uso. |
| `/dora:dora-doctor` | Diagnósticos. |
| `/dora:dora-upgrade` | Actualizar dora. |
| `/dora:dora-purge` | Eliminar todos los skills en caché. |

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install codex
```

Fusiona el servidor MCP en `~/.codex/config.toml` (fusión TOML profunda, copia de seguridad `.bak`), el hook SessionStart en `~/.codex/hooks.json`, y agrega el enrutamiento a `~/.codex/AGENTS.md`.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g @doraskill/dora
dora install opencode
```

Escribe `opencode.json` (fusión profunda) y agrega el enrutamiento a `AGENTS.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g @doraskill/dora
dora install gemini-cli
```

Fusiona el servidor MCP en `~/.gemini/settings.json` y agrega el enrutamiento a `GEMINI.md`.

</details>

<details>
<summary><strong>Qwen Code</strong></summary>

```bash
npm install -g @doraskill/dora
dora install qwen-code
```

Fusiona el servidor MCP en `settings.json`.

</details>

## Adaptador multiplataforma

dora detecta automáticamente la plataforma CLI en ejecución y adapta la carga de skills.

**Prioridad de detección:** variable de entorno `DORA_PLATFORM` → MCP clientInfo → señales de entorno → fallback.

Cuando `dora_load` devuelve un `execution_context` no nulo, el agente lo muestra antes de ejecutar el skill — incluye mapeos de nombres de herramientas o advertencias de compatibilidad para plataformas no verificadas.

Plataformas soportadas: `claude-code`, `codex`, `opencode`, `gemini-cli`, `qwen-code`.

## Fallback sin conexión

`dora_query` cambia automáticamente a un catálogo local cuando el motor remoto no está disponible.

- **Disparadores:** `engine_unreachable` (red/timeout) o `http_error` con estado ≥ 500 o 429. Otros errores 4xx se devuelven al llamante tal cual.
- **Forzar local:** Pasa `local_only: true` a `dora_query` (o usa `/dora:dora local: <tarea>`) para omitir el motor remoto.
- **Catálogo:** ~9.465 skills, incluidos en el paquete npm (sin descarga adicional).
- **Formato de resultados:** idéntico al remoto (`{skills: [...]}`) con un campo `source: "remote" | "local"` añadido.
- **Diagnósticos:** `dora_doctor` incluye una verificación del índice local.

Los resultados vacíos del motor remoto (`empty_candidates`) no activan el fallback.

## Configuración

`~/.dora/config.yaml` (o `./.dora/config.yaml` para proyectos locales):

```yaml
skill_query_url: http://api.doraskill.org  # URL del motor de consultas
min_security_level: warn                  # safe | warn | danger
top_k: 5
cache_ttl_days: 7
query_timeout_seconds: 30
```

## Comandos

```
dora query <text>              Buscar en el motor de skills
dora load <name> <url> <lvl>   Clonar y almacenar en caché un skill
dora touch <key>               Marcar un skill en caché como usado
dora list                      Listar skills en caché
dora stats                     Estadísticas de uso
dora doctor                    Diagnósticos
dora upgrade                   Actualizar dora
dora purge --yes               Eliminar todos los skills en caché
dora mcp                       Iniciar el servidor MCP stdio
dora install [platform]        Detectar automáticamente o especificar plataforma
```

## Datos

- Caché: `~/.dora/skills/<name>_<owner>/`
- Estado: `~/.dora/skills/status.yaml`
- Registro de consultas: `~/.dora/query-log.jsonl`
- Configuración: `~/.dora/config.yaml` (no eliminado por purge)

## License

MIT
