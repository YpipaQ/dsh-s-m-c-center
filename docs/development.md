# Development notes

This repo ships both a TypeScript source tree (`src/`) and the built plugin (`lib/`). To change
behavior you edit `src/*`, rebuild, and commit the regenerated `lib/`.

## Architecture

Two halves, both built from `src/` into `lib/` by a single `tsdown` run:

| Half | Entry | Output | Build target |
|---|---|---|---|
| Host (node) | `src/index.ts` | `lib/index.js` | ESM, platform `node` |
| Client (browser) | `src/client/index.ts` | `lib/client.js` | CJS wrapped in `window.__ModuleLoader__.load(...)`, platform `browser` |

- **Host half** — `src/index.ts` is a composition root: it constructs the three engines, builds
  the route table, registers the agent tool and the announcement. Everything else lives in
  `src/shared/` (cross-domain primitives) or `src/features/<domain>/` (one vertical slice per tool
  family: `skills`, `mcp`, `cli`, `context`, `announce`, `settings`). It uses `node:fs`, `node:os`,
  `node:path`, `node:child_process`, `@deepseek-ai/dsh-settings`, `schemastery`,
  `@deepseek-ai/dsh-mcp-client`. It registers the `/api/dsh-s-m-c-center/*` route family on the
  **loopback-only** `webServer` and announces itself to every agent via `systemPrompt.section`.
- **Client half** — `src/client/index.ts` registers the settings page and the sidebar entry, over
  `src/client/shared/` (api, locales, ui atoms, shared hooks, constants, formatting, styles),
  `src/client/shell/` (`SettingsCard` slot face, `ManagerShell` tabs, `sidebar`) and
  `src/client/features/<tab>/` (one panel + its hooks per tab: `skills`, `mcp`, `cli`, `guide`).
  It uses only `react` as a runtime external; the `@deepseek-ai/dsh-client-*` imports are
  **type-only** (erased at build).
- `src/shared/protocol/api-paths.ts` holds the shared `SMC_API` path constants both halves import —
  a route rename is a single edit.

### Import-path rule

`moduleResolution` is `bundler`, which does **not** resolve a directory import to its `index.ts`.
Worse, a file `x.ts` sitting next to a directory `x/` makes the bare specifier `./x` ambiguous. So
every cross-module import is written in full — `shared/protocol/index.ts`, `features/skills/index.ts`.
A shortened `from '../shared/protocol.ts'` fails with TS2307 and then cascades into a wave of
misleading TS7006 "Parameter implicitly has an 'any' type" errors, because the unresolved import
degrades the types it was supposed to supply.

## Build

The build config lives at the repo root:

- `tsdown.config.ts` — externalizes host value deps + node builtins; externalizes `react`/`react-dom`
  for the client; inlines CSS Modules (`[hash]_[local]`, `data-plugin-css` style tags) via a local
  lightningcss plugin; adds the `__ModuleLoader__.load` banner/footer.
- `tsconfig.json` — type-check only.

```sh
pnpm install --ignore-scripts   # installs tsdown, typescript, @tsdown/css, react, etc.
pnpm exec tsc --noEmit          # type-check (expect 0 errors)
pnpm exec tsc -p tsconfig.build.json   # regenerate lib/types/** (declarations + .d.ts.map)
pnpm exec tsdown                # regenerate lib/index.js + lib/client.js
# ...or both build steps together:
pnpm build
```

> **`lib/types` comes from `tsc -p tsconfig.build.json`, not from tsdown** (tsdown runs with
> `dts: false`). Skipping that step ships stale declarations — one release went out with `reMigrate()` /
> `activateAll()` missing from `lib/types/`, and a newly added panel with no `.d.ts` at all.
>
> `tsconfig.build.json` also enables `declarationMap`. Without the flag tsc never rewrites the
> existing `.d.ts.map` files, so they stay frozen at whatever they were the last time it was on —
> which is how a couple of long-lived maps ended up byte-identical to another project's and made
> this package look derivative. Keep the flag on and the maps stay honest.

> `pnpm exec` shells out through pnpm, which may try to hit the registry first; on an offline
> machine drive the tools directly: `node node_modules/typescript/lib/tsc.js --noEmit`,
> `node node_modules/vitest/vitest.mjs run`, `node node_modules/tsdown/dist/run.mjs`.

## Verification (no DSH restart needed)

Type-check + bundle syntax are enough to confirm the code is sound before installing:

```sh
pnpm exec tsc --noEmit
node --check lib/index.js
node --check lib/client.js
```

To sanity-check the CLI manager without a Host process, drive `src/features/cli/manager.ts` with a
stub `SkillsManager` (Node ≥23.6 with `--experimental-transform-types`) and point it at a real skill
bundle that ships `scripts/run-cli.*`.

## Install / activate

A Host route + client bundle change only takes effect after **restarting the DSH profile process**
(the client bundle is served at page load, not hot-reloaded). Install as a **normal package**
(`dsh plugin --profile <name> add <path|tgz|name>`), never via junction.

## Tests

```sh
pnpm exec vitest run
```

Every suite sets `DSH_HOME` / `DSH_AGENTS_HOME` / `DSH_STORE_ROOT` to a per-test temp dir, so the
real `~/.dsh` is never touched. `tests/store-root.test.ts` also exercises the full upgrade path
(legacy `skills-store` → `S-M-C` with junction repointing).

## Store layout

All runtime data lives in the unified store `~/.dsh/S-M-C` — see `src/shared/paths.ts` (the single
source of truth for every path) and the 「统一外挂储存库」 chapter in `docs/功能介绍.md`. Never
hard-code a `~/.dsh/...` path in `src/`.
