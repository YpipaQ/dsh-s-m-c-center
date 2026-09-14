<div align="center">
  🌏 <a href="./README.zh.md">中文</a> · <b>English</b>
</div>

<div align="center">
  <b style="font-size: 1.15em;">A DeepSeek Harness (DSH) web plugin: a Skill + MCP + CLI manager in one settings page, plus an uninstall-prep page that gives everything back.</b><br /><br />
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/releases"><img alt="release" src="https://img.shields.io/github/package-json/v/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=release&amp;color=fe7d37&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=stars&amp;color=f0a01e&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/forks"><img alt="forks" src="https://img.shields.io/github/forks/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=forks&amp;color=2b8df5&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="npm" src="https://img.shields.io/npm/v/dsh-s-m-c-center?style=flat-square&amp;label=npm&amp;color=cb3837&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="total downloads" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2F2026-08-26%3A2030-01-01%2Fdsh-s-m-c-center&amp;query=%24.downloads&amp;label=total%20downloads&amp;style=flat-square&amp;color=2ea44f&amp;labelColor=555" /></a>
  <a href="./LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="dsh" src="https://img.shields.io/badge/dsh-%3E%3D0.1.2--alpha.2-4d6bfe?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="node" src="https://img.shields.io/node/v/dsh-s-m-c-center?style=flat-square&amp;labelColor=555" /></a>
</div>

# dsh-s-m-c-center

> **Tool Manager** — a self-contained DSH web plugin that adds a first-class **settings page** for the
> agent's three tool families: **Skills**, **MCP servers**, and **local CLI tools** — plus an
> uninstall-prep page that gives all of it back cleanly.
>
> Mounted purely as a profile bundle patch + package — **no DeepSeek Harness source changes**.

## ✨ What it is

One settings page (「Web UI 插件 → 工具管理」) that manages the agent's tool families — and gives
them all back cleanly when you want to uninstall:

| Tab | Manages | Backing |
|---|---|---|
| **Skills 技能** | browse / enable / disable / delete / import skills (project + user roots) | user-level canonical copy in `~/.dsh/S-M-C/skills` + directory junction; project-level `SKILL.md` frontmatter rewrite |
| **MCP 服务** | create / edit / test / enable / archive / delete MCP servers | real `@deepseek-ai/dsh-mcp-client` connections (`mcp__<server>__<tool>`); archived ones move to `S-M-C/mcp-archive.json` |
| **CLI 工具** | discover / probe local CLI tools; register system CLIs | skill-embedded `scripts/run-cli` + `S-M-C/cli.json` |
| **卸载准备 (Uninstall prep)** | undo the skills migration ↔ migrate again; inject all archived MCP back; lists the store files to remove by hand | migration is reversible both ways (red / green conditional button); MCP injection is one-way by design |

> Full feature guide (in Chinese): [`docs/功能介绍.md`](./docs/功能介绍.md).

## 💡 Features

- **Skills** — group by project/user level & source (`.dsh/skills`, `.agents/skills`, `~/.dsh/skills`, `~/.agents/skills`); user-level skills are adopted into the **unified store** `~/.dsh/S-M-C/skills` — enable = inject a directory junction into the skills root, disable = remove it (`SKILL.md` is never rewritten); project-level skills stay in place and still use frontmatter; two-step physical delete; detail (description / whenToUse / body); import from an arbitrary directory (native picker or typed path) into the store and enable it.
- **MCP** — two sub-pages (manage / create): the list gives each server one switch (**enable / archive**) plus delete, the create page holds the form or JSON editor with **test connection** (one-shot real probe) before saving; **enable / archive** actually connects/disconnects and registers `mcp__<server>__<tool>` tools (an archived definition moves to `S-M-C/mcp-archive.json` — not connected, not announced, kept whole so it can be moved back); live status (`connecting` / `running` / `failed` / `stopped`).
- **CLI** — auto-discovers the CLI a skill wraps (its `scripts/run-cli.*` / `scripts/cli-state.*`, the tencent-news pattern); probes whether it is installed / its version / needs-update / API-key state (parsing `cli-state` JSON) and lists its subcommands (from `help`); a `S-M-C/cli.json` registry for system CLIs (`gh`, `git`, `tencent-news-cli` …) with an **announce / hide** switch (**hidden by default** — it only decides whether the CLI is written into the agent announcement, since the plugin cannot start or stop a system CLI) and delete; every row shows its origin and location (`Skill CLI · <path>` / `System CLI · <path>`).
- **Uninstall prep** — the escape hatch before removing the plugin. "撤销迁移" (red) moves every stored skill back to its original location; when the store is empty but skills still sit in the skills directories, the same button turns into a green "迁移" to bring them back into the store — **reversible in both directions**. "MCP 全部注入" moves every archived server back into `mcp.json` in one pass and reconnects it. The page also lists exactly which store directory and config block must be removed by hand.
- **UI** — fully bilingual copy (zh / en, 160 keys each; an English shell renders no Chinese); the announce section folds its long explanation behind an inline toggle, collapsed by default; destructive actions use two-step confirmation.

## 📷 Screenshots

<div align="center">
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-skills.png" alt="Skills tab" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-mcp.png" alt="MCP tab" width="49%" />
  <br />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-cli.png" alt="CLI tab" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-uninstall.png" alt="Uninstall prep tab" width="49%" />
</div>
<p align="center"><i>The four tabs: Skills (unified store + junctions), MCP (real connections), CLI (discover / probe / register), and Uninstall prep (reversible migration + the manual cleanup checklist). Personal paths are mosaicked.</i></p>

## 🏗️ Architecture

**Mounting & the two halves** — the plugin is just an npm package plus one profile bundle
patch line; zero changes to dsh source:

<div align="center">
  <img src="./docs/arch-overview.svg" alt="Mounting and dual-half architecture" width="88%" />
</div>
<p align="center"><i>Labels are in Chinese (file names, routes and API paths are verbatim): the host half registers the routes, announces every agent and really connects MCP; the client half only renders the settings page. They talk over <code>/api/dsh-skills-mcp/*</code>.</i></p>

**Store layout** — everything the plugin owns lives in `~/.dsh/S-M-C`; the two directories dsh
scans deliberately stay outside it (the plugin only injects / removes links inside them):

<div align="center">
  <img src="./docs/arch-store.svg" alt="Unified store layout" width="88%" />
</div>
<p align="center"><i>The canonical copy of a skill always lives in the store; the entry under <code>~/.dsh/skills</code> is just a link pointing at it.</i></p>

**What the three switches actually do on disk** — not a config field, but real file / connection
changes:

<div align="center">
  <img src="./docs/arch-lifecycle.svg" alt="What the three switches do" width="88%" />
</div>
<p align="center"><i>Skills = add/remove a link; MCP enable/archive = move the definition between <code>mcp.json</code> and <code>mcp-archive.json</code>; CLI = visibility only.</i></p>

## 🚀 Install

> **Requires**: DeepSeek Harness **`>= 0.1.2-alpha.2`** (all `@deepseek-ai/*` packages are released
> in lockstep). Verified end-to-end on **`0.1.5-rc.2`**; every API this plugin uses was checked to
> exist with a matching signature from `0.1.2-alpha.2` onwards.

> **Install as a normal package — do NOT link it via a junction.** A junction makes dependencies
> fail to resolve upward (e.g. `schemastery` / `react`) and desyncs the package name from
> `cordis.patch.yml`; both break DSH startup.

> **npm release note**: this package (`dsh-s-m-c-center`) is **not on npm yet** — for personal
> reasons on the author's side the publish is deferred past September 17. Until then, install from
> source or from the tarball below.

```sh
# From npm: https://www.npmjs.com/package/dsh-s-m-c-center
# Note: not on npm yet (publish deferred past Sep 17 for personal reasons) — use source or tarball
dsh plugin --profile web add dsh-s-m-c-center
# or: npm install dsh-s-m-c-center

# From source (this repo / after cloning)
dsh plugin --profile web add <absolute path to this folder>

# Or the built tarball
dsh plugin --profile web add <path>/dsh-s-m-c-center-<version>.tgz

# Or the convenience scripts
bash scripts/install.sh                                        # macOS / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts/install.ps1   # Windows
```

After installing, **restart DSH and hard-refresh the browser** (Cmd/Ctrl+Shift+R). Then open
「设置 → Web UI 插件 → **工具管理**」 (Settings → Web UI Plugins → Tool Manager).

> **No restart needed to update**: once the plugin is installed, later upgrades **should not require
> restarting DSH** — overwrite the files and hard-refresh the browser. (Only changes that touch
> Host-side routes or backend logic need a DSH restart; UI-only changes take effect on refresh.)

## ⚙️ Configuration

```yaml
# This plugin's own settings namespace (dsh settings)
dsh-s-m-c-center:
  enabled: true        # master switch (routes, MCP connections, CLI probes)
  announceToAgent: true # announce the plugin to every agent's system prompt
```

Runtime state:

- **Unified store**: everything this plugin owns lives in `~/.dsh/S-M-C/` (**S**kills / **M**CP / **C**LI) — `skills/`, `mcp.json`, `mcp-archive.json`, `cli.json`. Old locations are migrated on first start; the whole store can be relocated with `DSH_STORE_ROOT` (the plugin rebuilds the junctions for you).
- MCP: active servers in `S-M-C/mcp.json`, archived ones in `S-M-C/mcp-archive.json` (credentials/headers stored **plaintext** — keep both files at `0600`).
- CLI registry: `S-M-C/cli.json`.

## 🗂️ Repository structure

```
dsh-s-m-c-center/
├── src/                # TypeScript source (host + client halves)
│   ├── index.ts        # host entry (plug-in load, settings namespace, agent announcement)
│   ├── skills.ts       # skills filesystem engine
│   ├── mcp.ts          # MCP config store + real connection manager
│   ├── cli.ts          # CLI discovery / probe / registry + cli-state parsing
│   ├── routes.ts       # /api/dsh-skills-mcp route family
│   ├── protocol.ts     # shared types + API paths
│   └── client/         # browser half (entry, SettingsCard, manager, api, locales, css)
├── lib/                # built plugin (host: index.js; client: client.js; types/*)
├── cordis.patch.yml    # DSH bundle patch (package name must match package.json)
├── dsh.plugin.json     # DSH plugin manifest (id / version / main / client.main)
├── package.json        # npm package (dsh.bundle.patch + dsh.client)
├── LICENSE             # MIT
├── README.md / README.zh.md
├── docs/
│   ├── 功能介绍.md      # full feature guide (zh)
│   ├── development.md  # dev notes (build, tests, store layout)
│   ├── arch-*.svg      # architecture diagrams (used above)
│   ├── social-preview.png  # repo social preview card (set in repo settings)
│   └── shots/          # UI screenshots (used above)
└── scripts/install.*   # one-click install into a DSH profile
```

## 🛠️ Development

See [`docs/development.md`](./docs/development.md) for the two-half build (`tsdown`, reconstructs
`lib/index.js` + `lib/client.js`), type-checking, and the test suite.

## 📄 License

[MIT](./LICENSE).

---

*Chinese version: [`README.zh.md`](./README.zh.md).*
