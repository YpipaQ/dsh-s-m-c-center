# dsh-s-m-c-center — AGENTS.md

> Guidance for AI agents / contributors working in this repository.

## What this is

A **self-contained** DeepSeek Harness (DSH) web plugin that adds a first-class **settings page**
(「Web UI 插件 → 工具管理」) managing the agent's tool families — Skills / MCP / CLI, plus an
uninstall-prep page that gives the managed data back before the plugin is removed:

| Tab | What it manages | Backing |
|---|---|---|
| Skills 技能 | browse / enable / disable / delete / import skills (project + user roots) | user-level canonical copy in `~/.dsh/S-M-C/skills` + directory junction; project-level `SKILL.md` frontmatter rewrite |
| MCP 服务 | create / edit / test / **enable / archive** / delete MCP servers | real `@deepseek-ai/dsh-mcp-client` connections (`mcp__<server>__<tool>`); archived → `S-M-C/mcp-archive.json` |
| CLI 工具 | discover / probe local CLI tools; register system CLIs | skill-embedded `scripts/run-cli` + `S-M-C/cli.json` |
| 卸载准备 (Uninstall prep) | give the managed data back before removing the plugin: rollback ↔ re-migrate skills (red / green conditional button), inject all archived MCP back, list the files to delete by hand | `skills.reMigrate()` / `mcp.activateAll()`, plus the store paths read from `src/store.ts` |

It mounts purely as a profile bundle patch + package. **It does NOT modify DeepSeek Harness (DSH)
source** — the plugin is a standalone package, installed alongside the harness.

## Repository layout

```
dsh-s-m-c-center/
├── src/                # TypeScript source (host + client halves)
│   ├── index.ts        # host entry (plug-in load, settings namespace, agent announcement)
│   ├── skills.ts       # skills filesystem engine
│   ├── mcp.ts          # MCP config store + real connection manager
│   ├── cli.ts          # CLI discovery / probe / registry + cli-state parsing
│   ├── routes.ts       # /api/dsh-skills-mcp route family
│   ├── protocol.ts     # shared types + API paths
│   ├── store.ts        # unified store root (S-M-C) — single source of truth for paths
│   ├── migrate.ts      # one-shot migration into the store root
│   ├── announce.ts     # system-prompt section rendered for every agent
│   ├── settings.ts     # read/write this plugin's block in ~/.dsh/settings.yaml
│   ├── tsconfig.json / tsconfig.build.json / tsdown.config.ts  # type-check + declarations + two-half build
│   ├── client/         # browser half
│   │   ├── components/ # SettingsCard, ManagerShell, one panel per tab (Skills/Mcp/Cli/Uninstall), ui/ atoms
│   │   ├── hooks/      # useApi, useAsyncList, useSkills, useMcp, useCli, useManagerSettings
│   │   ├── utils/      # tab constants + formatting helpers
│   │   └── index.ts / api.ts / locales.ts / settings-card.module.css
│   └── ../tests/       # vitest suites (isolated DSH_HOME / DSH_STORE_ROOT per test)
├── lib/                # built plugin (host: index.js; client: client.js; types/*)
├── cordis.patch.yml    # DSH bundle patch
├── dsh.plugin.json     # DSH plugin manifest (id / version / main / client.main)
├── package.json        # npm package (dsh.bundle.patch + dsh.client)
├── LICENSE             # MIT
├── README.md / README.zh.md
├── docs/development.md # dev notes (two-half build, tests, store layout)
└── scripts/install.*   # one-click install into a DSH profile
```

## Hard rules

- **Do NOT modify DeepSeek Harness (DSH) source.** Never write to `~/.dsh/source/current` or commit harness changes. The plugin is always a package the profile references.
- **Install as a normal package, not a junction.** A junction breaks Node dependency resolution (the plugin's deps like `schemastery`/`react` fail to resolve upward) and desyncs the package name from `cordis.patch.yml`. Install via `dsh plugin --profile <name> add <path>` or `file:<tarball>`.
- **The package name must match `cordis.patch.yml`'s `name`** (`dsh-s-m-c-center`). Do not rename one without the other, or DSH boot fails with `Cannot find package ...`.
- `lib/` is the shipped artifact. It is **built from `src/`** (this repo has a source tree). To change behavior, edit `src/*`, then rebuild — `pnpm build` runs both steps: `tsc -p tsconfig.build.json` for `lib/types/**` (declarations + `.d.ts.map`) and `tsdown` for `lib/index.js` / `lib/client.js` — and commit the regenerated `lib/`. Running only `tsdown` leaves `lib/types/` stale, which is how an earlier release shipped without `reMigrate()` / `activateAll()` in its declarations.
- The **host half** registers the `/api/dsh-skills-mcp/*` route family on the loopback-only `webServer`; the **client half** registers the settings page. Keep the shared `SKILLS_MCP_API` path constants in `src/protocol.ts` as the single source of truth for both halves.
- **Never hard-code a `~/.dsh/...` path in `src/`** — every store path comes from `src/store.ts`
(`storeRoot()` / `storeSkillsDir()` / `storeMcpPath()` / `storeMcpArchivePath()` / `storeCliPath()`),
which honours `$DSH_HOME` and `$DSH_STORE_ROOT`. Tests depend on that indirection.

## Typical dev flow

- **Install from npm (published)**: `dsh plugin --profile web add dsh-s-m-c-center` (or `npm install dsh-s-m-c-center`), then restart DSH + hard-refresh the browser.
- **Install from source**: `dsh plugin --profile web add <abs path>` (local dir / tarball), then restart DSH + hard-refresh.
- **Build**: 
  ```sh
  pnpm install --ignore-scripts
  pnpm exec tsc --noEmit    # type-check (0 errors expected)
  pnpm exec vitest run      # tests (all green expected)
  pnpm exec tsc -p tsconfig.build.json   # regenerate lib/types/** (declarations + maps)
  pnpm exec tsdown          # regenerate lib/index.js + lib/client.js
  ```
- **Tarball**: `pnpm pack` (or `npm pack`) → `dsh-s-m-c-center-<version>.tgz`.

## Where things live at runtime

- Skill roots **scanned by dsh**: `<project>/.dsh/skills`, `<project>/.agents/skills`, `~/.dsh/skills`, `~/.agents/skills`. We never move these — we only inject/remove junctions in them.
- **Unified store** (everything we own): `~/.dsh/S-M-C/` — `skills/` (canonical skill copies + `index.json`), `mcp.json` (active), `mcp-archive.json` (archived), `cli.json`. Override the whole root with `$DSH_STORE_ROOT`; override the dsh home with `$DSH_HOME`.
- Credentials/headers in `mcp*.json` are **plaintext** — keep them at `0600`.

## Present (this repo has a source tree)

Because this repo ships `src/` **and** the built `lib/`, it legitimately carries `tsconfig.json`,
`tsdown.config.ts`, and a `typecheck` script. `tests/` is a **vitest** suite (`pnpm exec vitest run`);
every case sets `DSH_HOME` / `DSH_AGENTS_HOME` / `DSH_STORE_ROOT` to a temp dir so the real `~/.dsh`
is never touched — never write a test that reads the real home.
