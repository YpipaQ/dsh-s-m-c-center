import z from "schemastery";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import * as mcpClient from "@deepseek-ai/dsh-mcp-client";
//#region src/announce.ts
/** Static framing: what the plugin is and what it can do. */
const INTRO = [
	"本机已安装 dsh-s-m-c-center 插件（工具管理：技能 / MCP / CLI 管理器）。",
	"能力：浏览/启用/不启用/删除/导入技能；管理 MCP 服务器（stdio 与 streamable-http）；",
	"以及本地 CLI 工具清单与状态（是否安装 / 版本 / 需更新 / 子命令 / API-Key 状态）。",
	"MCP 为真实连接：激活的服务器经 @deepseek-ai/dsh-mcp-client 连接，工具注册为 mcp__<server>__<tool>，激活/归档会实际连接/断开。"
].join("");
/** Caveats the agent should know before promising anything. */
const LIMITS = [
	"注册新技能：为用户新建用户级技能时，把技能文件夹直接创建到 ~/.dsh/S-M-C/skills/<技能名>/（内含 SKILL.md，frontmatter 需有 name 与 description），不要写到 ~/.dsh/skills、~/.agents/skills 等储存库外的目录 —— 只有储存库里的技能才会被统一管理。写入后它会以「未启用」出现在管理页，用户启用（注入联接）后你即可通过 `skill` 工具加载；项目专用技能仍放当前项目的 .dsh/skills/。",
	"限制：本插件的数据统一存 ~/.dsh/S-M-C（MCP 激活 mcp.json、归档 mcp-archive.json、CLI 注册表 cli.json；密码/env 明文）；",
	"用户级技能的正本在 ~/.dsh/S-M-C/skills，启用/不启用等于在 skills 目录增删联接，不改写 SKILL.md；删除为物理删除，不可恢复。",
	"本清单在每次对话组装时生成，可能与管理页的即时操作有一处延迟。"
].join("");
/** How to reach the management surface — the GUI path is for the human. */
const ENTRY = "用户（而非你）可在设置页「Web UI 插件 → 工具管理」调整上述配置。";
/** Cap on listed names, so a large library cannot bloat the system prompt. */
const MAX_NAMES = 40;
/** Footer added when a list was truncated, so the agent knows it is partial. */
function truncatedNote(shown, total) {
	return `（仅列出前 ${shown} 个，共 ${total} 个）`;
}
/** Pick the enabled subset, preserving input order. */
function enabledOnly(items) {
	return items.filter((it) => it.enabled);
}
/** Render the skills block (names + one-line purpose when present). */
function renderSkills(skills) {
	if (skills.length === 0) return "技能：无。";
	const on = enabledOnly(skills);
	const lines = [`技能：共 ${skills.length} 个，其中可用 ${on.length} 个。`];
	const detail = on.slice(0, MAX_NAMES).map((s) => {
		const desc = s.description.trim();
		return desc === "" ? `- ${s.name}` : `- ${s.name}：${desc}`;
	});
	if (detail.length > 0) lines.push("可用技能：", ...detail);
	if (on.length > detail.length) lines.push(truncatedNote(detail.length, on.length));
	const off = skills.length - on.length;
	if (off > 0) lines.push(`另有 ${off} 个已禁用。通过 \`skill\` 工具按名称加载上述可用技能。`);
	else lines.push("通过 `skill` 工具按名称加载上述技能。");
	return lines.join("\n");
}
/**
* Render the MCP block (server + live connection status + tool namespace).
*
* Takes the combined list so an archived server can be called out as archived
* rather than silently missing — otherwise the agent has no way to answer
* "can I use the github MCP?" with anything better than a guess.
*/
function renderMcp(servers) {
	const active = servers.filter((s) => !s.archived);
	const archived = servers.filter((s) => s.archived);
	if (active.length === 0) {
		if (archived.length === 0) return "MCP 服务器：未配置。";
		return `MCP 服务器：全部 ${archived.length} 个已归档（定义在 ~/.dsh/S-M-C/mcp-archive.json，未连接，工具不可用，需用户激活后才能使用）。`;
	}
	const on = enabledOnly(active);
	const lines = [`MCP 服务器：共 ${active.length} 个，其中启用 ${on.length} 个。`];
	for (const s of on.slice(0, MAX_NAMES)) {
		const state = s.status === "running" ? "已连接" : s.status === "failed" ? s.error ? `连接失败：${s.error}` : "连接失败" : s.status === "connecting" ? "连接中" : "未连接";
		lines.push(`- ${s.name}（${s.transport}，${state}）：工具名为 mcp__${s.name}__<tool>`);
	}
	if (on.length > MAX_NAMES) lines.push(truncatedNote(MAX_NAMES, on.length));
	const off = active.length - on.length;
	if (off > 0) lines.push(`另有 ${off} 个未启用（未连接，工具不可用）。`);
	if (archived.length > 0) lines.push(`另有 ${archived.length} 个已归档（定义在 ~/.dsh/S-M-C/mcp-archive.json，未连接，工具不可用，需用户激活后才能使用）。`);
	return lines.join("\n");
}
/** Render the CLI block — the only place these tools are announced at all. */
function renderCli(entries) {
	if (entries.length === 0) return "本地 CLI 工具：未发现。";
	const on = enabledOnly(entries);
	const installed = on.filter((e) => e.exists);
	const lines = [`本地 CLI 工具：共 ${entries.length} 个，其中公告中 ${on.length} 个、已安装 ${installed.length} 个。`];
	for (const e of on.slice(0, MAX_NAMES)) {
		const origin = e.source === "skill" ? `来自技能 ${e.skill ?? ""}`.trim() : "系统 CLI";
		const where = e.exists ? `已安装${e.path ? "：" + e.path : ""}` : "未找到";
		lines.push(`- ${e.name}（${origin}，${where}）`);
	}
	if (on.length > MAX_NAMES) lines.push(truncatedNote(MAX_NAMES, on.length));
	const missing = on.length - installed.length;
	if (missing > 0) lines.push(`其中 ${missing} 个未在本机找到，调用前需先安装。`);
	lines.push("这些 CLI 未在工具列表中注册；如需使用，请通过终端/命令工具按上述名称调用。");
	const off = entries.length - on.length;
	if (off > 0) lines.push(`另有 ${off} 个已设为「隐藏」（不写进本公告），无需理会。`);
	return lines.join("\n");
}
/** Render one block, falling back to a placeholder if the read throws. */
function safe(label, render) {
	try {
		return render();
	} catch {
		return `${label}：（读取失败，请以管理页为准）`;
	}
}
/** Build the announcement text from the live managers. */
function build(sources, cwd) {
	const skills = safe("技能", () => renderSkills(sources.skills.listSkills(cwd)));
	const mcp = safe("MCP 服务器", () => renderMcp(sources.mcp.listForUi()));
	const cli = safe("本地 CLI 工具", () => renderCli(sources.cli.list(cwd)));
	return [
		INTRO,
		"",
		skills,
		"",
		mcp,
		"",
		cli,
		"",
		LIMITS,
		ENTRY
	].join("\n");
}
/**
* How long a rendered announcement stays fresh.
*
* The provider runs on every prompt assembly, and an agent loop assembles more
* than once per turn — rebuilding would repeat a four-root directory walk plus
* a PATH walk each time. A few seconds is long enough to collapse those, short
* enough that a change made in the management page shows up almost immediately.
*/
const CACHE_TTL_MS = 5e3;
let cached;
/** Drop the cached announcement so the next assembly rebuilds it. */
function invalidateAnnouncement() {
	cached = void 0;
}
/**
* Build the announcement text for one prompt assembly (memoized).
*
* @param sources - the live managers to read from.
* @param cwd - workspace root for project-scoped discovery, when known.
*/
function renderAnnouncement(sources, cwd) {
	const now = Date.now();
	if (cached !== void 0 && cached.cwd === cwd && now - cached.at < CACHE_TTL_MS) return cached.text;
	const text = build(sources, cwd);
	cached = {
		at: now,
		cwd,
		text
	};
	return text;
}
//#endregion
//#region src/store.ts
/**
* The unified external store root — the one directory this plugin owns.
*
* Skills, MCP and CLI data used to scatter four separate artefacts across
* `$DSH_HOME` (`skills-store/`, `mcp.json`, `mcp-archive.json`, `cli.json`),
* so "what does this plugin actually keep?" was a question you could only
* answer by reading the source. They now sit together under one directory
* whose name spells out its contents: **S**kills / **M**CP / **C**LI.
*
* Two things deliberately stay outside it:
*
* - `~/.dsh/skills/` — dsh's own skill root. The agent scans it, so it has to
*   stay where dsh looks; what we do is point *links* in it at the store.
* - `~/.dsh/settings.yaml` — dsh's document. We own one namespace block in it,
*   not the file.
*
* Every path below follows `$DSH_HOME`, and the whole root can be relocated
* with `$DSH_STORE_ROOT` for anyone who wants the store on another drive.
* @module
*/
/** Directory name of the unified store inside `$DSH_HOME`. */
const STORE_ROOT_NAME = "S-M-C";
/** Sub-directory holding the canonical copy of every adopted skill. */
const STORE_SKILLS_NAME = "skills";
/** File name of the active MCP document. */
const STORE_MCP_NAME = "mcp.json";
/** File name of the archived MCP document. */
const STORE_MCP_ARCHIVE_NAME = "mcp-archive.json";
/** File name of the CLI registry. */
const STORE_CLI_NAME = "cli.json";
/** The dsh home directory: `$DSH_HOME`, falling back to `~/.dsh`. */
function dshHomeDir() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}
/**
* Root of the unified store.
*
* `$DSH_STORE_ROOT` wins when set, so the store can live outside `$DSH_HOME`
* (another drive, a synced folder, …) without disturbing dsh itself. Relative
* values are resolved against the process cwd, like any other path.
*/
function storeRoot() {
	const override = process.env.DSH_STORE_ROOT;
	if (override && override.trim() !== "") return resolve(override);
	return join(dshHomeDir(), STORE_ROOT_NAME);
}
/** `$STORE_ROOT/skills` — canonical copies of adopted skills. */
function storeSkillsDir() {
	return join(storeRoot(), STORE_SKILLS_NAME);
}
/** `$STORE_ROOT/mcp.json` — active MCP server definitions. */
function storeMcpPath() {
	return join(storeRoot(), STORE_MCP_NAME);
}
/** `$STORE_ROOT/mcp-archive.json` — archived MCP definitions. */
function storeMcpArchivePath() {
	return join(storeRoot(), STORE_MCP_ARCHIVE_NAME);
}
/** `$STORE_ROOT/cli.json` — the local CLI registry. */
function storeCliPath() {
	return join(storeRoot(), STORE_CLI_NAME);
}
/**
* Move a file or directory, falling back to copy-then-delete across devices.
*
* `renameSync` is atomic and cheap but throws EXDEV when source and
* destination live on different volumes — precisely what happens when the
* store is relocated to another drive.
*/
function movePath(from, to) {
	try {
		renameSync(from, to);
	} catch (e) {
		if (e?.code !== "EXDEV") throw e;
		if (statSync(from).isDirectory()) {
			cpSync(from, to, { recursive: true });
			rmSync(from, {
				recursive: true,
				force: true
			});
		} else {
			copyFileSync(from, to);
			unlinkSync(from);
		}
	}
}
/**
* Create the store root (and nothing below it) when it is missing.
*
* Callers that only *read* can skip this; it is for the migration and for
* adoption, which both need the directory to exist before they write into it.
* Never throws on an existing directory.
*/
function ensureStoreRoot() {
	const root = storeRoot();
	mkdirSync(root, { recursive: true });
	return root;
}
//#endregion
//#region src/cli.ts
/**
* CLI manager — discovers the local command-line tools the agent can invoke
* and reports/diagnoses their state. Two sources:
*  - `skill`    : auto-discovered from a skill bundle that ships a
*                 `scripts/run-cli.*` / `scripts/cli-state.*` wrapper (the
*                 tencent-news pattern). The skill's `cli-state` script is the
*                 authoritative probe when present.
*  - `registry` : user-declared entries persisted in ~/.dsh/S-M-C/cli.json (mirrors
*                 the mcp.json document), e.g. `gh`, `git`, `tencent-news-cli`.
* Exists/path detection never spawns an untrusted binary (PATH walk only);
* a full state probe / subcommand listing runs the resolved command on demand.
* @module
*/
/** Coerce a cli-state boolean (JSON boolean or the string "true"/"false"). */
function toBool(value) {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const s = value.trim().toLowerCase();
		if (s === "true" || s === "1") return true;
		if (s === "false" || s === "0") return false;
	}
}
const IS_WIN = process.platform === "win32";
/** Known well-known tool names the plugin watches out of the box. */
const DEFAULT_REGISTRY = [
	{
		name: "gh",
		command: "gh",
		enabled: false
	},
	{
		name: "git",
		command: "git",
		enabled: false
	},
	{
		name: "tencent-news-cli",
		command: "tencent-news-cli",
		enabled: false
	}
];
/** The store's CLI registry path (kept with the rest of the S-M-C data). */
function cliConfigPath() {
	return storeCliPath();
}
/** Read the persisted registry document (never throws). */
function readCliConfig() {
	const target = cliConfigPath();
	try {
		if (!existsSync(target)) return { entries: [] };
		const raw = readFileSync(target, "utf8");
		if (!raw || raw.trim() === "") return { entries: [] };
		const data = JSON.parse(raw);
		return { entries: Array.isArray(data.entries) ? data.entries.filter((e) => e && typeof e.name === "string") : [] };
	} catch {
		return { entries: [] };
	}
}
/** Persist the registry document (creating the directory when needed). */
function writeCliConfig(data) {
	const target = cliConfigPath();
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
}
/** Validate one registry entry; returns an error string, or null when valid. */
function validateCliEntry(entry) {
	if (!entry || typeof entry !== "object") return "entry must be an object";
	const e = entry;
	if (typeof e.name !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(e.name)) return "invalid name (1-64 chars of A-Za-z0-9_.-)";
	if (e.command !== void 0 && (typeof e.command !== "string" || e.command.trim() === "")) return "command must be a non-empty string";
	return null;
}
/**
* Normalize a registry entry to its persisted shape.
*
* `enabled` means "公告给 Agent" (advertised in the announcement) and is the
* only two-state control this plugin has over a CLI — it cannot start or stop
* one, since the system owns the executable. The flag is resolved through
* {@link toBool} so a hand-edited cli.json carrying `"false"`, `"0"` or `0`
* is read as 隐藏 instead of being silently promoted to 公告 — a plain
* `!== false` check treats every non-`false` value (including the string
* "false") as true. Anything unrecognized (missing, null, garbage) falls back
* to the default: 隐藏. The value written back is always a real boolean, so
* read and write agree on the shape and no invalid state can survive a save.
*/
function normalizeCliEntry(entry) {
	const flag = toBool(entry.enabled);
	return {
		name: entry.name,
		command: typeof entry.command === "string" && entry.command.trim() !== "" ? entry.command : entry.name,
		enabled: flag === true
	};
}
/**
* The registry entries as persisted, seeded with the built-ins when the file
* is empty or missing.
*
* Seeding matters: {@link CliManager.list} falls back to {@link DEFAULT_REGISTRY}
* for an empty document, so writing a single-entry document back would make the
* built-ins vanish from the list. Every mutation therefore starts from the same
* set the reader would have shown.
*/
function persistedEntries() {
	const config = readCliConfig();
	return config.entries.length > 0 ? config.entries : DEFAULT_REGISTRY.map((e) => ({ ...e }));
}
/** Walk PATH for an executable name without spawning it (portable, safe). */
function resolveOnPath(command) {
	const name = command.trim();
	if (name === "") return void 0;
	const dirs = (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":").filter(Boolean);
	const exts = IS_WIN ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [""];
	const candidates = IS_WIN ? [name, ...exts.map((ext) => name + ext.toLowerCase())] : [name];
	for (const dir of dirs) for (const cand of candidates) {
		const full = join(dir, cand);
		if (existsSync(full)) return full;
	}
}
/** Run a command synchronously, capturing stdout/stderr. */
function runSync(cmd, args, timeoutMs = 2e4) {
	try {
		const r = spawnSync(cmd, args, {
			encoding: "utf8",
			timeout: timeoutMs,
			windowsHide: true
		});
		return {
			ok: r.status === 0,
			out: (r.stdout || "").trim(),
			err: (r.stderr || "").trim() + (r.error && r.error.message ? `\n${r.error.message}` : "")
		};
	} catch (e) {
		return {
			ok: false,
			out: "",
			err: String(e)
		};
	}
}
/** Run a skill's `cli-state.*` probe script and parse its JSON document. */
function runCliStateScript(scriptPath) {
	const { ok, out, err } = runSync(IS_WIN ? "powershell" : "sh", IS_WIN ? [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath
	] : [scriptPath]);
	if (!ok) try {
		return {
			ok: true,
			data: JSON.parse(out)
		};
	} catch {
		return {
			ok: false,
			data: null,
			error: err || out || "state script failed"
		};
	}
	try {
		return {
			ok: true,
			data: JSON.parse(out)
		};
	} catch {
		return {
			ok: false,
			data: null,
			error: "state script did not return JSON"
		};
	}
}
/** Extract the wrapped CLI command name from a skill's run-cli script. */
function cliCommandFromScript(scriptPath) {
	const raw = readFileSync(scriptPath, "utf8");
	const m = /^[ \t]*\$?[A-Za-z0-9_]*CliCommandName[ \t]*=[ \t]*["']([^"']+)["']/m.exec(raw);
	if (m) return m[1];
	return "";
}
/**
* Owns skill-derived CLI discovery plus the persisted registry. Runs in the
* Host process; only PATH walks happen during `list`, heavier probes on demand.
*/
var CliManager = class {
	skills;
	constructor(skills) {
		this.skills = skills;
	}
	/** One element of the merged CLI list, still independent of registry state. */
	skillEntries(cwd) {
		const items = [];
		const advertised = new Set(persistedEntries().filter((e) => normalizeCliEntry(e).enabled).map((e) => e.name));
		for (const skill of this.skills.listSkills(cwd)) {
			const scriptsDir = join(skill.path.split(/[\\/]/).slice(0, -1).join("/"), "scripts");
			if (!existsSync(scriptsDir)) continue;
			const entries = readdirSync(scriptsDir, { withFileTypes: true });
			const scriptName = IS_WIN ? "run-cli.ps1" : "run-cli.sh";
			const stateName = IS_WIN ? "cli-state.ps1" : "cli-state.sh";
			const runScript = entries.some((e) => e.isFile() && e.name === scriptName) ? join(scriptsDir, scriptName) : void 0;
			const stateScript = entries.some((e) => e.isFile() && e.name === stateName) ? join(scriptsDir, stateName) : void 0;
			if (runScript === void 0 && stateScript === void 0) continue;
			const command = (runScript !== void 0 ? cliCommandFromScript(runScript) : "") || skill.name;
			if (command === "") continue;
			const resolved = resolveOnPath(command);
			const known = this.knownInstallPath(command);
			items.push({
				name: command,
				command,
				source: "skill",
				skill: skill.name,
				runScript,
				stateScript,
				enabled: advertised.has(command),
				exists: resolved !== void 0 || known !== void 0,
				path: resolved ?? known
			});
		}
		return items;
	}
	/** Registry entries mapped to summary form (path detection only). */
	registryEntries() {
		return persistedEntries().map((e) => {
			const normalized = normalizeCliEntry(e);
			const resolved = resolveOnPath(normalized.command);
			return {
				name: normalized.name,
				command: normalized.command,
				source: "registry",
				enabled: normalized.enabled,
				exists: resolved !== void 0,
				path: resolved
			};
		});
	}
	/** Merge skill-derived and registry CLI entries into the UI list. */
	list(cwd) {
		const byName = /* @__PURE__ */ new Map();
		for (const s of this.skillEntries(cwd)) byName.set(s.name, s);
		for (const r of this.registryEntries()) {
			if (byName.has(r.name)) continue;
			byName.set(r.name, r);
		}
		const items = [...byName.values()];
		items.sort((a, b) => {
			if (a.source !== b.source) return a.source === "skill" ? -1 : 1;
			return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
		});
		return items;
	}
	/** Probe one CLI's detailed state (cli-state script, else version). */
	async readState(name, cwd) {
		const found = this.list(cwd).find((s) => s.name === name);
		if (found === void 0) return {
			name,
			exists: false,
			error: "unknown cli: " + name
		};
		if (found.source === "skill" && found.stateScript && existsSync(found.stateScript)) {
			const { ok, data, error } = runCliStateScript(found.stateScript);
			if (ok && data) {
				const cliExists = toBool(data.cliExists) ?? false;
				const platform = data.platform ?? {};
				const update = data.update ?? {};
				const apiKey = data.apiKey ?? {};
				return {
					name,
					exists: cliExists,
					path: typeof platform.cliPath === "string" ? platform.cliPath : found.path,
					needUpdate: toBool(update.needUpdate),
					apiKey: {
						status: typeof apiKey.status === "string" ? apiKey.status : void 0,
						present: toBool(apiKey.present),
						error: typeof apiKey.error === "string" ? apiKey.error : void 0
					},
					platform: {
						os: typeof platform.os === "string" ? platform.os : void 0,
						arch: typeof platform.arch === "string" ? platform.arch : void 0,
						cliPath: typeof platform.cliPath === "string" ? platform.cliPath : void 0,
						cliSource: typeof platform.cliSource === "string" ? platform.cliSource : void 0
					}
				};
			}
			const generic = this.genericState(found);
			Object.assign(generic, { error });
			return generic;
		}
		return this.genericState(found);
	}
	/** Generic version probe for a non-skill CLI. */
	genericState(s) {
		const resolved = s.path ?? resolveOnPath(s.command);
		if (resolved === void 0) {
			const known = this.knownInstallPath(s.command);
			if (known !== void 0) {
				const r = runSync(known, ["--version"]);
				return {
					name: s.name,
					exists: true,
					path: known,
					version: r.ok ? r.out.split("\n")[0] : void 0,
					error: r.ok ? void 0 : r.err || "version check failed"
				};
			}
			return {
				name: s.name,
				exists: false
			};
		}
		for (const [flag, rest] of [["--version", []], ["version", []]]) {
			const r = runSync(resolved, [flag, ...rest]);
			if (r.ok && r.out) return {
				name: s.name,
				exists: true,
				path: resolved,
				version: r.out.split("\n")[0]
			};
		}
		return {
			name: s.name,
			exists: true,
			path: resolved,
			error: "version not reported"
		};
	}
	/** Best-effort known install path for a tool installed outside PATH. */
	knownInstallPath(command) {
		if (command === "tencent-news-cli") {
			const root = process.env.TENCENT_NEWS_INSTALL || join(homedir(), ".tencent-news-cli");
			const bin = IS_WIN ? join(root, "bin", "tencent-news-cli.exe") : join(root, "bin", "tencent-news-cli");
			return existsSync(bin) ? bin : void 0;
		}
	}
	/** Parse a CLI's `help` output into its subcommand list. */
	async listSubcommands(name, cwd) {
		const found = this.list(cwd).find((s) => s.name === name);
		if (found === void 0) throw new Error("unknown cli: " + name);
		const command = found.path ?? resolveOnPath(found.command) ?? this.knownInstallPath(found.command) ?? found.command;
		let helpOut = "";
		if (found.source === "skill" && found.runScript && existsSync(found.runScript)) {
			const r = runSync(IS_WIN ? "powershell" : "sh", IS_WIN ? [
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				found.runScript,
				"help"
			] : [found.runScript, "help"]);
			helpOut = r.out || r.err;
		} else {
			const r = runSync(command, ["help"]);
			if (!r.ok) {
				const r2 = runSync(command, ["--help"]);
				helpOut = r2.out || r2.err || r.out || r.err;
			} else helpOut = r.out;
		}
		const subcommands = parseHelpCommands(helpOut);
		return {
			name,
			command: found.command,
			subcommands,
			help: helpOut
		};
	}
	/** Registry mutation: upsert one entry. */
	saveEntry(entry) {
		const normalized = normalizeCliEntry(entry);
		const entries = persistedEntries();
		const idx = entries.findIndex((e) => e.name === normalized.name);
		if (idx >= 0) entries[idx] = normalized;
		else entries.push(normalized);
		writeCliConfig({ entries: entries.map(normalizeCliEntry) });
		return normalized;
	}
	/**
	* Registry mutation: set whether a CLI is advertised to the agent.
	*
	* Upserts, so it also works for a skill-provided CLI, which has no registry
	* entry of its own: flipping such a row writes one, and that entry is what
	* {@link skillEntries} reads back. The document is seeded from the built-ins
	* first, so toggling a built-in always lands instead of silently no-oping.
	*/
	setEnabled(name, enabled) {
		const entries = persistedEntries();
		const entry = entries.find((e) => e.name === name);
		const flag = enabled === true;
		if (entry === void 0) entries.push({
			name,
			command: name,
			enabled: flag
		});
		else entry.enabled = flag;
		writeCliConfig({ entries: entries.map(normalizeCliEntry) });
	}
	/**
	* Registry mutation: remove one entry.
	* Seeded from the built-ins first, so deleting one of them actually sticks —
	* writing an empty document would just reinstate the fallback list on read.
	*/
	removeEntry(name) {
		writeCliConfig({ entries: persistedEntries().filter((e) => e.name !== name).map(normalizeCliEntry) });
	}
};
/** Parse `Available Commands:` / `Commands:` block into a subcommand list. */
function parseHelpCommands(help) {
	const lines = help.split(/\r?\n/);
	const result = [];
	let capture = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^(available commands|commands):\s*$/i.test(trimmed)) {
			capture = true;
			continue;
		}
		if (capture) {
			if (trimmed === "") break;
			const m = /^([a-z][a-z0-9_-]*)/i.exec(trimmed);
			if (m && !/^usage|^flags|^help/i.test(m[1])) result.push(m[1]);
		}
	}
	return result;
}
//#endregion
//#region src/skills.ts
/**
* Skills filesystem engine — scans the four manageable skill roots, parses
* SKILL.md frontmatter, and performs enable/disable, delete, scan-for-import,
* and import. Runs in the Host process with direct node:fs access (a real npm
* package no longer needs the shell+node hack the dynamic plugin used).
*
* Skills adopted into the store live in `~/.dsh/S-M-C/skills/<slug>/` as the
* single canonical copy; enabling one writes a directory link back into its
* source root (`~/.dsh/skills/<slug>`), disabling removes that link. dsh's own
* scanner follows links (`skill-filesystem` `nodeEntryKind` stats a symlink
* entry), so a linked skill is fully visible to the agent while an unlinked one
* is invisible — and the SKILL.md itself is never rewritten.
* @module
*/
/**
* Directory name of the legacy store, kept only so {@link migrateStoreRoot}
* can recognise an old layout and move it. New code uses `storeSkillsDir()`
* from ./store.ts — the skills live under the unified S-M-C root now.
*/
const STORE_DIR_NAME = "skills-store";
function agentsHomeDir() {
	return process.env.DSH_AGENTS_HOME || join(homedir(), ".agents");
}
/** True when `child` is `parent` or lives beneath it (case-insensitive on Windows). */
function inside(parent, child) {
	const p = resolve(parent);
	const c = resolve(child);
	if (process.platform === "win32") {
		const lower = c.toLowerCase();
		const base = p.toLowerCase();
		return lower === base || lower.startsWith(base.endsWith(sep) ? base : base + sep);
	}
	return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}
/** True when `path` is a symlink or a Windows junction. */
function isLink(path) {
	try {
		readlinkSync(path);
		return true;
	} catch {
		return false;
	}
}
/** Link target, or undefined when `path` is a real file/directory. */
function linkTarget(path) {
	try {
		return readlinkSync(path);
	} catch {
		return;
	}
}
/**
* Resolve a directory entry to a usable kind, following links.
*
* A junction reports `isSymbolicLink()` and neither `isDirectory()` nor
* `isFile()`, so a naive scan silently skips every linked skill. This mirrors
* dsh's own `nodeEntryKind` so the UI and the agent agree on what exists.
*/
function entryKind(fullPath, entry) {
	if (entry.isDirectory()) return "directory";
	if (entry.isFile()) return "file";
	if (!entry.isSymbolicLink()) return void 0;
	try {
		const info = statSync(fullPath);
		if (info.isDirectory()) return "directory";
		if (info.isFile()) return "file";
	} catch {
		return;
	}
}
/** Resolve (and materialize) the user-level skill roots plus the store. */
function getRoots() {
	const home = homedir();
	const dshHome = dshHomeDir();
	const agentsHome = agentsHomeDir();
	const userSkillsDir = join(dshHome, "skills");
	mkdirSync(userSkillsDir, { recursive: true });
	return {
		home,
		dshHome,
		agentsHome,
		userSkillsDir,
		storeDir: storeSkillsDir(),
		agentsSkillsDir: join(agentsHome, "skills")
	};
}
/** How many parent directories {@link findProjectRoot} will climb. */
const MAX_ROOT_HOPS = 100;
/** Marker whose presence means "this directory is a project root". */
const PROJECT_MARKER = ".git";
/** Walk up from cwd to the nearest .git directory (the project root). */
function findProjectRoot(cwd) {
	let current = resolve(cwd ?? process.cwd());
	let hops = 0;
	while (hops++ < MAX_ROOT_HOPS) {
		if (existsSync(join(current, PROJECT_MARKER))) return current;
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return current;
}
/** Project-level sources are the ones that belong to a workspace. */
function levelOf(source) {
	return source.startsWith("project") ? "project" : "user";
}
/** The exact spellings a YAML scalar may use for each literal. */
const TRUE_LITERALS = /* @__PURE__ */ new Set([
	"true",
	"True",
	"TRUE"
]);
const FALSE_LITERALS = /* @__PURE__ */ new Set([
	"false",
	"False",
	"FALSE"
]);
const NULL_LITERALS = /* @__PURE__ */ new Set(["null", "~"]);
/** Read one frontmatter scalar: a literal, an integer, or the raw string. */
function scalarValue(raw) {
	if (TRUE_LITERALS.has(raw)) return true;
	if (FALSE_LITERALS.has(raw)) return false;
	if (NULL_LITERALS.has(raw)) return null;
	return /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : raw;
}
/** Boolean reading of a frontmatter value; undefined when it is not one. */
function parseBool$1(value) {
	if (typeof value === "boolean") return value;
	if (value === 1 || value === "1") return true;
	if (value === 0 || value === "0") return false;
	if (typeof value !== "string") return void 0;
	switch (value.toLowerCase()) {
		case "true":
		case "yes":
		case "on": return true;
		case "false":
		case "no":
		case "off": return false;
		default: return;
	}
}
/** Separator line that opens and closes a frontmatter block. */
const FENCE = "---";
/** Drop one layer of matching quotes from a scalar. */
function unquote$1(value) {
	const first = value[0];
	if (value.length < 2 || first !== value[value.length - 1]) return value;
	return first === "\"" || first === "'" ? value.slice(1, -1) : value;
}
/**
* Read the leading `---` block of a skill document.
* @returns the parsed keys plus the remaining body, or null when the document
*   has no block (a plain markdown file is not a skill).
*/
function parseFrontmatter(raw) {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== FENCE) return null;
	const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
	if (closing < 0) return null;
	const data = {};
	for (const line of lines.slice(1, closing)) {
		const separator = line.indexOf(":");
		if (separator < 0) continue;
		const key = line.slice(0, separator).trim();
		data[key] = scalarValue(unquote$1(line.slice(separator + 1).trim()));
	}
	return {
		data,
		body: lines.slice(closing + 1).join("\n")
	};
}
/** A frontmatter field read as text; anything non-string reads as ''. */
function textField(data, key) {
	const value = data[key];
	return typeof value === "string" ? value : "";
}
/**
* Parse one skill document.
* @returns null when it has no frontmatter, or is missing its name/description
*   (dsh requires both, so such a file is not a skill).
*/
function parseSkillFile(raw) {
	const front = parseFrontmatter(raw);
	if (front === null) return null;
	const name = textField(front.data, "name");
	const description = textField(front.data, "description");
	if (name === "" || description === "") return null;
	const disableModel = parseBool$1(front.data["disable-model-invocation"]);
	const userInvocable = parseBool$1(front.data["user-invocable"]);
	return {
		name,
		description,
		whenToUse: textField(front.data, "whenToUse"),
		enabled: disableModel !== true || userInvocable !== false,
		content: front.body.trim()
	};
}
/** Matches a frontmatter line that sets one of the invocation keys. */
const INVOCATION_LINE = new RegExp(`^\\s*(${[
	"disable-model-invocation",
	"disableModelInvocation",
	"modelInvocable",
	"user-invocable",
	"userInvocable"
].join("|")})\\s*:`);
/**
* Rewrite the frontmatter so the skill reads as enabled or disabled.
*
* Only ever used for project-level skills: a managed skill is switched off by
* removing its link, which leaves the file untouched. The old spellings are
* stripped along with the current ones, because dsh drops a whole skill when
* it meets a retired spelling.
*/
function toggleInvocation(raw, enabled) {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== FENCE) return raw;
	const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
	if (closing < 0) return raw;
	const kept = lines.slice(1, closing).filter((line) => !INVOCATION_LINE.test(line));
	if (!enabled) kept.push("disable-model-invocation: true", "user-invocable: false");
	return [
		lines[0],
		...kept,
		...lines.slice(closing)
	].join("\n");
}
/** Filesystem-safe store directory name for a skill. */
function slugify(input) {
	const s = input.trim().toLowerCase().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/[.-]+$/g, "").replace(/^-+/, "");
	return s === "" ? "skill" : s;
}
/** A slug that does not collide with `taken` (appends -2, -3 …). */
function uniqueSlug(taken, base) {
	if (!taken.has(base)) return base;
	for (let i = 2;; i++) {
		const candidate = base + "-" + String(i);
		if (!taken.has(candidate)) return candidate;
	}
}
/** Root directory a link is written back to for one source. */
function rootFor(source, roots) {
	return source === "user-agents" ? roots.agentsSkillsDir : roots.userSkillsDir;
}
/** Link kind: junctions need no elevation on Windows, symlinks elsewhere. */
const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";
var SkillsManager = class {
	/** The skills directory (created on demand inside the unified store root). */
	storeDir() {
		return storeSkillsDir();
	}
	/**
	* Read the store manifest, rebuilding it from disk when missing or corrupt.
	* A corrupt file is kept as `index.corrupt.json` rather than deleted.
	*/
	readStoreIndex() {
		const dir = this.storeDir();
		const file = join(dir, "index.json");
		if (!existsSync(file)) return this.recoverIndex();
		try {
			const parsed = JSON.parse(readFileSync(file, "utf8"));
			if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.entries)) throw new Error("malformed store index");
			return parsed;
		} catch {
			try {
				copyFileSync(file, join(dir, "index.corrupt.json"));
			} catch {}
			const recovered = this.recoverIndex();
			this.writeStoreIndex(recovered);
			return recovered;
		}
	}
	/** Write the manifest atomically (temp file + rename). */
	writeStoreIndex(index) {
		const dir = this.storeDir();
		mkdirSync(dir, { recursive: true });
		const file = join(dir, "index.json");
		const tmp = file + ".tmp";
		writeFileSync(tmp, JSON.stringify(index, null, 2), "utf8");
		renameSync(tmp, file);
	}
	/**
	* Rebuild the manifest from whatever bundles exist in the store directory.
	* Used when index.json is missing (first run after a manual copy, or a
	* corrupt file) so adopted skills are not silently orphaned.
	*/
	recoverIndex() {
		const dir = this.storeDir();
		const entries = [];
		if (!existsSync(dir)) return {
			version: 1,
			entries
		};
		let names = [];
		try {
			names = readdirSync(dir);
		} catch {
			return {
				version: 1,
				entries
			};
		}
		for (const slug of names) {
			if (slug.startsWith(".")) continue;
			const mdPath = join(dir, slug, "SKILL.md");
			if (!existsSync(mdPath)) continue;
			let parsed = null;
			try {
				parsed = parseSkillFile(readFileSync(mdPath, "utf8"));
			} catch {
				continue;
			}
			if (parsed === null) continue;
			entries.push({
				slug,
				name: parsed.name,
				origin: "",
				source: this.linkedSource(slug) ?? "user-dsh",
				enabled: this.linkedSource(slug) !== void 0,
				adoptedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		}
		return {
			version: 1,
			entries
		};
	}
	/** Which root currently holds a link for `slug`, if any. */
	linkedSource(slug) {
		const roots = getRoots();
		const store = this.storeDir();
		for (const source of ["user-dsh", "user-agents"]) {
			const link = join(rootFor(source, roots), slug);
			const target = linkTarget(link);
			if (target !== void 0 && inside(store, resolve(link, "..", target))) return source;
		}
	}
	/** Replace (or insert) one manifest entry. */
	upsertEntry(entry) {
		const index = this.readStoreIndex();
		const idx = index.entries.findIndex((e) => e.slug === entry.slug);
		if (idx >= 0) index.entries[idx] = entry;
		else index.entries.push(entry);
		this.writeStoreIndex(index);
	}
	/** Drop one manifest entry. */
	dropEntry(slug) {
		const index = this.readStoreIndex();
		index.entries = index.entries.filter((e) => e.slug !== slug);
		this.writeStoreIndex(index);
	}
	/**
	* Materialise the link for one stored skill. No-op when it already exists;
	* refuses to overwrite a real directory.
	*/
	linkInto(slug, source) {
		const root = rootFor(source, getRoots());
		mkdirSync(root, { recursive: true });
		const link = join(root, slug);
		const target = join(this.storeDir(), slug);
		if (isLink(link)) return;
		if (existsSync(link)) throw new Error("已存在同名条目：" + link);
		symlinkSync(target, link, LINK_TYPE);
	}
	/**
	* Remove the link for one stored skill. Only ever removes a link — a real
	* directory is left alone so a stray path can never delete the store copy.
	*/
	unlinkFrom(slug, source) {
		const link = join(rootFor(source, getRoots()), slug);
		if (!isLink(link)) return;
		if (process.platform === "win32") rmdirSync(link);
		else unlinkSync(link);
	}
	/**
	* Repoint every link that targets `from` at `to`.
	*
	* A junction stores an absolute target string, so moving the store silently
	* breaks every link into it: the bundles are intact, but `~/.dsh/skills/x`
	* still names the old path and the agent stops seeing the skill entirely.
	* This is the repair step the store-root migration runs right after moving.
	* @param from - the old store directory (may no longer exist).
	* @param to - the new store directory.
	* @returns how many links were rebuilt.
	*/
	relinkSkills(from, to) {
		const roots = getRoots();
		const base = resolve(from);
		let count = 0;
		for (const dir of [roots.userSkillsDir, roots.agentsSkillsDir]) {
			if (!existsSync(dir)) continue;
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = join(dir, entry.name);
				if (!isLink(full)) continue;
				const target = linkTarget(full);
				if (target === void 0 || !inside(base, target)) continue;
				try {
					if (process.platform === "win32") rmdirSync(full);
					else unlinkSync(full);
				} catch {
					continue;
				}
				try {
					symlinkSync(join(to, basename(target)), full, LINK_TYPE);
					count++;
				} catch {}
			}
		}
		return count;
	}
	/**
	* Move one skill into the store as a bundle and (when enabled) link it back.
	*
	* The stored copy is normalised: any `disable-model-invocation` /
	* `user-invocable` flags are stripped, because from here on visibility is
	* decided by link presence alone — leaving the flags in place would keep a
	* re-enabled skill hidden from the model.
	*/
	adopt(sourcePath, kind, source, enabled) {
		const store = this.storeDir();
		mkdirSync(store, { recursive: true });
		const mdPath = kind === "bundle" ? join(sourcePath, "SKILL.md") : sourcePath;
		const raw = readFileSync(mdPath, "utf8");
		const parsed = parseSkillFile(raw);
		if (parsed === null) throw new Error("不是有效的技能文件：" + mdPath);
		const slug = uniqueSlug(new Set(readdirSync(store).filter((n) => !n.startsWith("."))), slugify(parsed.name || basename(sourcePath, extname(sourcePath))));
		const dest = join(store, slug);
		if (kind === "bundle") {
			movePath(sourcePath, dest);
			writeFileSync(join(dest, "SKILL.md"), toggleInvocation(raw, true), "utf8");
		} else {
			mkdirSync(dest, { recursive: true });
			movePath(sourcePath, join(dest, "SKILL.md"));
			writeFileSync(join(dest, "SKILL.md"), toggleInvocation(raw, true), "utf8");
		}
		if (enabled) this.linkInto(slug, source);
		this.upsertEntry({
			slug,
			name: parsed.name,
			origin: sourcePath,
			source,
			enabled,
			adoptedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		return slug;
	}
	/**
	* Resolve a skill path back to its store identity, or undefined when the
	* skill is not managed (still in place, toggled by frontmatter).
	*/
	resolveManaged(path) {
		const store = this.storeDir();
		const dir = dirname(path);
		const target = linkTarget(dir);
		if (target !== void 0) {
			const resolvedTarget = resolve(dir, target);
			if (inside(store, resolvedTarget)) {
				const slug = basename(resolvedTarget);
				return {
					slug,
					source: this.linkedSource(slug) ?? this.entryOf(slug)?.source ?? "user-dsh"
				};
			}
		}
		if (inside(store, path)) {
			const slug = basename(dir);
			return {
				slug,
				source: this.entryOf(slug)?.source ?? "user-dsh"
			};
		}
	}
	/** Manifest entry for one slug, when present. */
	entryOf(slug) {
		return this.readStoreIndex().entries.find((e) => e.slug === slug);
	}
	/** Scan one skill root directory into SkillSummary records. */
	scanRoot(dir, source) {
		const items = [];
		if (!existsSync(dir)) return items;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return items;
		}
		const store = this.storeDir();
		for (const entry of entries) {
			const name = entry.name;
			if (!name || name === ".system" || name[0] === ".") continue;
			const full = join(dir, name);
			const kind = entryKind(full, entry);
			if (kind === "directory") {
				const mdPath = join(full, "SKILL.md");
				if (!existsSync(mdPath)) continue;
				let raw;
				try {
					raw = readFileSync(mdPath, "utf8");
				} catch {
					continue;
				}
				const parsed = parseSkillFile(raw);
				if (parsed === null) continue;
				items.push({
					...parsed,
					source,
					level: levelOf(source),
					kind: "bundle",
					path: mdPath,
					...managedFields(store, full)
				});
			} else if (kind === "file" && name.endsWith(".md")) {
				let raw;
				try {
					raw = readFileSync(full, "utf8");
				} catch {
					continue;
				}
				const parsed = parseSkillFile(raw);
				if (parsed === null) continue;
				items.push({
					...parsed,
					source,
					level: levelOf(source),
					kind: "file",
					path: full,
					managed: false
				});
			}
		}
		return items;
	}
	/** The roots to walk for a listing, in display order: project, then user. */
	scanTargets(cwd) {
		const roots = getRoots();
		const userTargets = [{
			path: roots.userSkillsDir,
			source: "user-dsh"
		}, {
			path: roots.agentsSkillsDir,
			source: "user-agents"
		}];
		if (!cwd) return userTargets;
		const projectRoot = findProjectRoot(cwd);
		return [
			{
				path: join(projectRoot, ".dsh", "skills"),
				source: "project-dsh"
			},
			{
				path: join(projectRoot, ".agents", "skills"),
				source: "project-agents"
			},
			...userTargets
		];
	}
	/**
	* List skills across project and/or user roots, de-duplicated by path, plus
	* every stored skill that is currently unlinked (so it can be re-enabled).
	*/
	listSkills(cwd) {
		const seen = /* @__PURE__ */ new Set();
		const items = [];
		for (const target of this.scanTargets(cwd)) for (const found of this.scanRoot(target.path, target.source)) {
			if (seen.has(found.path)) continue;
			seen.add(found.path);
			items.push(found);
		}
		const store = this.storeDir();
		for (const entry of this.readStoreIndex().entries) {
			if (this.linkedSource(entry.slug) !== void 0) continue;
			const mdPath = join(store, entry.slug, "SKILL.md");
			if (seen.has(mdPath)) continue;
			let parsed = null;
			try {
				parsed = parseSkillFile(readFileSync(mdPath, "utf8"));
			} catch {
				continue;
			}
			if (parsed === null) continue;
			seen.add(mdPath);
			items.push({
				name: parsed.name,
				description: parsed.description,
				whenToUse: parsed.whenToUse,
				enabled: false,
				source: entry.source,
				level: levelOf(entry.source),
				kind: "bundle",
				path: mdPath,
				managed: true,
				slug: entry.slug
			});
		}
		const knownSlugs = new Set(this.readStoreIndex().entries.map((e) => e.slug));
		let stored = [];
		try {
			stored = readdirSync(store);
		} catch {}
		for (const slug of stored) {
			if (slug.startsWith(".") || knownSlugs.has(slug)) continue;
			const mdPath = join(store, slug, "SKILL.md");
			if (seen.has(mdPath)) continue;
			let parsed = null;
			try {
				parsed = parseSkillFile(readFileSync(mdPath, "utf8"));
			} catch {
				continue;
			}
			if (parsed === null) continue;
			seen.add(mdPath);
			items.push({
				name: parsed.name,
				description: parsed.description,
				whenToUse: parsed.whenToUse,
				enabled: false,
				source: "user-dsh",
				level: "user",
				kind: "bundle",
				path: mdPath,
				managed: true,
				slug
			});
		}
		items.sort((a, b) => {
			if (a.level !== b.level) return a.level === "project" ? -1 : 1;
			return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
		});
		return items;
	}
	/** Read one skill document (body included). */
	readSkill(path) {
		if (!existsSync(path)) return null;
		const parsed = parseSkillFile(readFileSync(path, "utf8"));
		if (parsed === null) return null;
		return {
			...parsed,
			path
		};
	}
	/**
	* Enable/disable a skill. Managed skills are linked/unlinked (their SKILL.md
	* is never touched); everything else still falls back to rewriting the
	* frontmatter invocation flags.
	*/
	setSkillEnabled(path, enabled) {
		const managed = this.resolveManaged(path);
		if (managed !== void 0) {
			const entry = this.entryOf(managed.slug);
			if (enabled) this.linkInto(managed.slug, managed.source);
			else this.unlinkFrom(managed.slug, managed.source);
			this.upsertEntry({
				slug: managed.slug,
				name: entry?.name ?? basename(managed.slug),
				origin: entry?.origin ?? "",
				source: managed.source,
				enabled,
				adoptedAt: entry?.adoptedAt ?? (/* @__PURE__ */ new Date()).toISOString()
			});
			return;
		}
		writeFileSync(path, toggleInvocation(readFileSync(path, "utf8"), enabled), "utf8");
	}
	/** Delete a skill: for managed ones, drop the link and the store copy. */
	deleteSkill(path, kind) {
		const managed = this.resolveManaged(path);
		if (managed !== void 0) {
			this.unlinkFrom(managed.slug, managed.source);
			const bundle = join(this.storeDir(), managed.slug);
			if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, {
				recursive: true,
				force: true
			});
			this.dropEntry(managed.slug);
			return bundle;
		}
		const target = kind === "bundle" ? dirname(path) : path;
		rmSync(target, {
			recursive: true,
			force: true
		});
		return target;
	}
	/**
	* One-shot migration: move every user-level skill into the store and link
	* back the ones that were enabled. Project-level skills stay in place —
	* moving them into `$DSH_HOME` would detach them from the repository that
	* owns them.
	*
	* Idempotent: a second call is a no-op. Individual failures are collected
	* rather than thrown, and the offending skill is simply left where it was.
	*/
	migrate() {
		const index = this.readStoreIndex();
		if (index.migratedAt !== void 0) return {
			moved: 0,
			failures: index.failures ?? []
		};
		const roots = getRoots();
		const failures = [];
		let moved = 0;
		for (const scan of [{
			path: roots.userSkillsDir,
			source: "user-dsh"
		}, {
			path: roots.agentsSkillsDir,
			source: "user-agents"
		}]) for (const item of this.scanRoot(scan.path, scan.source)) {
			if (item.managed) continue;
			const sourcePath = item.kind === "bundle" ? dirname(item.path) : item.path;
			try {
				this.adopt(sourcePath, item.kind, scan.source, item.enabled);
				moved++;
			} catch (e) {
				failures.push({
					path: sourcePath,
					reason: String(e?.message ?? e)
				});
			}
		}
		const next = this.readStoreIndex();
		next.migratedAt = (/* @__PURE__ */ new Date()).toISOString();
		next.failures = failures;
		try {
			this.writeStoreIndex(next);
		} catch {}
		return {
			moved,
			failures
		};
	}
	/**
	* Undo {@link migrate}: restore every stored skill to its original path and
	* drop the store manifest. The invocation flags are re-applied so a skill
	* that was disabled before the migration comes back disabled.
	*/
	rollbackMigration() {
		const index = this.readStoreIndex();
		const failures = [];
		let moved = 0;
		for (const entry of index.entries) {
			const bundle = join(this.storeDir(), entry.slug);
			if (!existsSync(bundle)) continue;
			this.unlinkFrom(entry.slug, entry.source);
			const origin = entry.origin;
			if (origin === "") {
				failures.push({
					path: bundle,
					reason: "缺少原始路径，已保留在储存器中"
				});
				continue;
			}
			try {
				mkdirSync(dirname(origin), { recursive: true });
				if (extname(origin).toLowerCase() === ".md") {
					movePath(join(bundle, "SKILL.md"), origin);
					writeFileSync(origin, toggleInvocation(readFileSync(origin, "utf8"), entry.enabled), "utf8");
					rmSync(bundle, {
						recursive: true,
						force: true
					});
				} else {
					movePath(bundle, origin);
					const mdPath = join(origin, "SKILL.md");
					writeFileSync(mdPath, toggleInvocation(readFileSync(mdPath, "utf8"), entry.enabled), "utf8");
				}
				moved++;
			} catch (e) {
				failures.push({
					path: origin,
					reason: String(e?.message ?? e)
				});
			}
		}
		if (failures.length === 0) try {
			rmSync(join(this.storeDir(), "index.json"), { force: true });
		} catch {}
		return {
			moved,
			failures
		};
	}
	/**
	* Undo a rollback: run the one-shot migration again.
	*
	* This is the uninstall page's "undo" for the skills half of 归还 — a skill
	* given back to its original location can be re-adopted into the store at
	* any time. A rollback that fully succeeded deleted the manifest, so
	* {@link migrate} would re-run on its own; when failures kept the manifest
	* alive, the marker has to be cleared first or migrate() would no-op.
	*/
	reMigrate() {
		const index = this.readStoreIndex();
		if (index.migratedAt !== void 0) {
			delete index.migratedAt;
			try {
				this.writeStoreIndex(index);
			} catch {}
		}
		return this.migrate();
	}
	/** Store state for the UI banner. */
	storeStatus() {
		const dir = this.storeDir();
		const index = this.readStoreIndex();
		let enabled = 0;
		for (const entry of index.entries) if (this.linkedSource(entry.slug) !== void 0) enabled++;
		const knownSlugs = new Set(index.entries.map((e) => e.slug));
		let extra = 0;
		try {
			for (const slug of readdirSync(dir)) {
				if (slug.startsWith(".") || knownSlugs.has(slug)) continue;
				if (existsSync(join(dir, slug, "SKILL.md"))) extra++;
			}
		} catch {}
		return {
			root: storeRoot(),
			dir,
			migrated: index.migratedAt !== void 0,
			migratedAt: index.migratedAt,
			count: index.entries.length + extra,
			enabled,
			failures: index.failures ?? []
		};
	}
	/** Scan an arbitrary directory for importable skills. */
	scanSkills(dir) {
		if (!existsSync(dir)) throw new Error("directory not found: " + dir);
		const entries = readdirSync(dir, { withFileTypes: true });
		const items = [];
		for (const entry of entries) {
			const name = entry.name;
			if (!name || name[0] === ".") continue;
			const full = join(dir, name);
			const kind = entryKind(full, entry);
			if (kind === "directory") {
				const mdPath = join(full, "SKILL.md");
				if (!existsSync(mdPath)) continue;
				let raw;
				try {
					raw = readFileSync(mdPath, "utf8");
				} catch {
					continue;
				}
				const parsed = parseSkillFile(raw);
				if (parsed !== null) items.push({
					name: parsed.name,
					description: parsed.description,
					sourcePath: full,
					kind: "bundle"
				});
			} else if (kind === "file" && name.endsWith(".md") && name !== "SKILL.md") {
				let raw;
				try {
					raw = readFileSync(full, "utf8");
				} catch {
					continue;
				}
				const parsed = parseSkillFile(raw);
				if (parsed !== null) items.push({
					name: parsed.name,
					description: parsed.description,
					sourcePath: full,
					kind: "file"
				});
			}
		}
		return items;
	}
	/** Import selected skills into the store as enabled bundles. */
	importSkills(items) {
		const results = [];
		for (const it of items) try {
			const slug = this.adopt(it.sourcePath, it.kind, "user-dsh", true);
			results.push({
				name: join(this.storeDir(), slug),
				ok: true
			});
		} catch (e) {
			results.push({
				name: it.sourcePath,
				ok: false,
				reason: String(e?.message ?? e)
			});
		}
		return results;
	}
};
/** `{ managed, slug }` for a scanned entry, when it is a link into the store. */
function managedFields(store, full) {
	const target = linkTarget(full);
	if (target === void 0) return { managed: false };
	const resolved = resolve(dirname(full), target);
	if (!inside(store, resolved)) return { managed: false };
	return {
		managed: true,
		slug: basename(resolved)
	};
}
/**
* Move a path, falling back to copy+delete when the source and destination sit
* on different devices (rename cannot cross them).
*/
//#endregion
//#region src/migrate.ts
/**
* One-shot migration into the unified store root (`~/.dsh/S-M-C`).
*
* Before the unified store the plugin scattered four artefacts across `$DSH_HOME`
* (`skills-store/`, `mcp.json`, `mcp-archive.json`, `cli.json`). They belong
* together, so this moves them — once — and leaves the old paths empty.
*
* The subtle part is the skills. A junction stores an *absolute* target, so
* relocating the store invalidates every link that pointed into it: the bundles
* survive the move but become invisible to the agent, which is worse than an
* obvious failure. Step (3) therefore walks the skill roots and rebuilds any
* link whose target sits under the old directory.
*
* Best effort throughout: a failure is collected and reported rather than
* thrown, because the plugin failing to mount is a worse outcome than the
* store being in a mixed state the status route can show.
* @module
*/
/** Legacy locations, relative to `$DSH_HOME`. */
const LEGACY_SKILLS = STORE_DIR_NAME;
const LEGACY_DOCS = [
	"mcp.json",
	"mcp-archive.json",
	"cli.json"
];
/** Move the four legacy artefacts into the unified store root. */
function migrateStoreRoot(skills) {
	const home = dshHomeDir();
	const result = {
		moved: [],
		relinked: 0,
		failures: []
	};
	try {
		ensureStoreRoot();
	} catch (e) {
		result.failures.push({
			path: storeRoot(),
			reason: message(e)
		});
		return result;
	}
	const oldSkills = join(home, LEGACY_SKILLS);
	const newSkills = storeSkillsDir();
	const hadOldSkills = existsSync(oldSkills);
	if (hadOldSkills && resolve(oldSkills) !== resolve(newSkills)) try {
		movePath(oldSkills, newSkills);
		result.moved.push("skills-store/");
	} catch (e) {
		result.failures.push({
			path: oldSkills,
			reason: message(e)
		});
	}
	const targets = {
		"mcp.json": storeMcpPath(),
		"mcp-archive.json": storeMcpArchivePath(),
		"cli.json": storeCliPath()
	};
	for (const name of LEGACY_DOCS) {
		const from = join(home, name);
		const to = targets[name];
		if (!existsSync(from)) continue;
		if (resolve(from) === resolve(to)) continue;
		try {
			movePath(from, to);
			result.moved.push(name);
		} catch (e) {
			result.failures.push({
				path: from,
				reason: message(e)
			});
		}
	}
	if (hadOldSkills) try {
		result.relinked = skills.relinkSkills(oldSkills, newSkills);
	} catch (e) {
		result.failures.push({
			path: newSkills,
			reason: message(e)
		});
	}
	return result;
}
function message(e) {
	return String(e?.message ?? e);
}
//#endregion
//#region src/mcp.ts
/** Schema version stamped on the archive document. */
const ARCHIVE_VERSION = 1;
/** Server names the client accepts: 1–32 chars of `A-Za-z0-9_-`. */
const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** Per-call timeout handed to the client. */
const TOOL_CALL_TIMEOUT_MS = 6e4;
/** Reconnect policy handed to the client (backoff up to 10 attempts). */
const RECONNECT = {
	enabled: true,
	initialDelayMs: 500,
	maxDelayMs: 3e4,
	maxAttempts: 10
};
/** The active document: `$STORE_ROOT/mcp.json`. */
function mcpConfigPath() {
	return storeMcpPath();
}
/**
* The archive document: `$STORE_ROOT/mcp-archive.json`.
*
* The MCP spelling of "not offered" — the same idea as a skill with no link in
* its root, or a CLI switched to 隐藏. The definition survives untouched, but
* because it no longer appears in the active document it is neither connected
* nor announced.
*/
function mcpArchivePath() {
	return storeMcpArchivePath();
}
/**
* Read a `{ servers: [...] }` document, tolerating anything.
*
* The three failure modes that must not throw: the file is absent (first run),
* it is empty (created but never written), and it is corrupt (hand-edited
* mid-save). Each collapses to "no servers", which the callers already handle.
*/
function readServers(target) {
	try {
		if (!existsSync(target)) return [];
		const raw = readFileSync(target, "utf8");
		if (raw.trim() === "") return [];
		const list = JSON.parse(raw)?.servers;
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}
/** Write a document as pretty JSON, creating the store directory on demand. */
function writeDocument(target, body) {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, JSON.stringify(body, null, 2), "utf8");
}
/** The active document, as the rest of the plugin knows it. */
function readMcpConfig() {
	return { servers: readServers(mcpConfigPath()) };
}
/** Persist the active document. */
function writeMcpConfig(data) {
	writeDocument(mcpConfigPath(), data);
}
/** The archive document, always carrying the current schema version. */
function readMcpArchive() {
	return {
		version: ARCHIVE_VERSION,
		servers: readServers(mcpArchivePath())
	};
}
/** Persist the archive document, stamping the schema version. */
function writeMcpArchive(data) {
	writeDocument(mcpArchivePath(), {
		version: ARCHIVE_VERSION,
		servers: data.servers
	});
}
/** True when `value` is a usable `Record<string, string>` (for env/headers). */
function plainRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
/** The fields a `stdio` definition persists; anything else is dropped. */
function stdioFields(s) {
	return {
		command: s.command,
		args: Array.isArray(s.args) ? s.args : [],
		env: plainRecord(s.env),
		cwd: s.cwd || ""
	};
}
/** The fields a `streamable-http` definition persists. */
function httpFields(s) {
	return {
		url: s.url,
		headers: plainRecord(s.headers)
	};
}
/** Non-empty string check shared by the transport-specific rules. */
function filled(value) {
	return typeof value === "string" && value.trim() !== "";
}
/** What a transport still needs beyond name + transport. */
const TRANSPORT_REQUIREMENT = {
	stdio: {
		field: "command",
		message: "stdio transport requires command"
	},
	"streamable-http": {
		field: "url",
		message: "streamable-http transport requires url"
	}
};
/**
* Check one definition coming in over the wire.
* @returns `null` when acceptable, otherwise the reason to show the user.
*/
function validateMcpServer(server) {
	if (server === null || typeof server !== "object" || Array.isArray(server)) return "server must be an object";
	const candidate = server;
	if (typeof candidate.name !== "string" || !NAME_PATTERN.test(candidate.name)) return "invalid name (1-32 chars of A-Za-z0-9_-)";
	const transport = candidate.transport;
	if (transport !== "stdio" && transport !== "streamable-http") return "transport must be 'stdio' or 'streamable-http'";
	const requirement = TRANSPORT_REQUIREMENT[transport];
	if (!filled(candidate[requirement.field])) return requirement.message;
	return null;
}
/**
* Put a definition into the exact shape that gets persisted.
*
* Only the fields the transport actually uses survive — a `url` left over from
* switching a server to stdio would otherwise sit in `mcp.json` forever, and a
* reused name would silently keep talking to the old endpoint.
*/
function normalizeMcpServer(server) {
	const base = {
		name: server.name,
		transport: server.transport,
		enabled: server.enabled !== false
	};
	return Object.assign(base, server.transport === "stdio" ? stdioFields(server) : httpFields(server));
}
/** Translate a persisted definition into the client plugin's config. */
function toMcpClientConfig(s) {
	const shared = {
		serverName: s.name,
		toolCallTimeoutMs: TOOL_CALL_TIMEOUT_MS,
		failOnStartupError: true,
		reconnect: RECONNECT
	};
	return s.transport === "stdio" ? {
		...shared,
		transport: "stdio",
		...stdioFields(s)
	} : {
		...shared,
		transport: "streamable-http",
		...httpFields(s)
	};
}
/** Whether two definitions would produce the same connection. */
function sameShape(a, b) {
	const left = { ...normalizeMcpServer(a) };
	const right = { ...normalizeMcpServer(b) };
	const fields = /* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const field of fields) if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false;
	return true;
}
/** Message from an unknown thrown value. */
function reasonOf(e) {
	return String(e?.message ?? e);
}
/** The same list without `name`. */
function without(list, name) {
	return list.filter((s) => s.name !== name);
}
/** Replace the same-named entry where it sits, or append when it is new. */
function upsert(list, entry) {
	const at = list.findIndex((s) => s.name === entry.name);
	if (at >= 0) list[at] = entry;
	else list.push(entry);
	return list;
}
/**
* Owns every live mcp-client fiber, keyed by server name.
*
* The set is *converged*, not commanded: {@link sync} takes the desired list
* and reconciles what is running against it, so the same call covers startup,
* a toggle, an edit, and a plugin teardown.
*/
var McpManager = class {
	ctx;
	live = /* @__PURE__ */ new Map();
	notes = /* @__PURE__ */ new Map();
	constructor(ctx) {
		this.ctx = ctx;
	}
	/** Re-read the active document and converge onto it. */
	async reload() {
		await this.sync(readMcpConfig().servers);
	}
	/**
	* Make the live set match `servers` (enabled ones only).
	*
	* Two passes, planned before either acts: first everything that is running
	* but no longer wanted — removed, disabled, or edited into a different shape
	* — is torn down; then everything wanted without a fiber is brought up.
	*/
	async sync(servers) {
		const wanted = /* @__PURE__ */ new Map();
		for (const s of servers) if (s.enabled !== false) wanted.set(s.name, s);
		const stale = [];
		for (const [name, entry] of this.live) {
			const target = wanted.get(name);
			if (target === void 0 || !sameShape(entry.config, target)) stale.push(name);
		}
		for (const name of stale) await this.drop(name);
		for (const [name, config] of wanted) {
			if (this.live.has(name)) continue;
			this.notes.set(name, { status: "connecting" });
			let fiber;
			try {
				fiber = this.ctx.plugin(mcpClient, toMcpClientConfig(config));
			} catch (e) {
				this.notes.set(name, {
					status: "failed",
					error: reasonOf(e)
				});
				continue;
			}
			this.live.set(name, {
				config: normalizeMcpServer(config),
				fiber
			});
			fiber.then(() => {
				this.notes.set(name, { status: "running" });
			}, (e) => {
				this.live.delete(name);
				this.notes.set(name, {
					status: "failed",
					error: reasonOf(e)
				});
			});
		}
	}
	/** Stop and dispose one connection, if it is running. */
	async drop(name) {
		const entry = this.live.get(name);
		if (entry === void 0) return;
		this.live.delete(name);
		this.notes.delete(name);
		try {
			await entry.fiber.dispose();
		} catch {}
	}
	/** Tear every connection down (plugin teardown). */
	async dispose() {
		for (const name of [...this.live.keys()]) await this.drop(name);
	}
	/**
	* Fold every `enabled: false` entry out of the active document into the
	* archive. Runs once at startup and is idempotent: after a pass the active
	* document has no disabled entries left to find. A hand-edited `enabled:
	* false` is picked up on the next start by design — "not active" has one
	* spelling now, and it is "absent from mcp.json".
	* @returns how many entries were found disabled.
	*/
	migrateArchive() {
		const active = readMcpConfig();
		const disabled = active.servers.filter((s) => s.enabled === false);
		if (disabled.length === 0) return 0;
		const archive = readMcpArchive();
		const known = new Set(archive.servers.map((s) => s.name));
		for (const s of disabled) {
			if (known.has(s.name)) continue;
			archive.servers.push({
				...normalizeMcpServer(s),
				enabled: false
			});
		}
		writeMcpArchive(archive);
		writeMcpConfig({ servers: active.servers.filter((s) => s.enabled !== false) });
		return disabled.length;
	}
	/** Move one active definition into the archive (the caller then syncs). */
	archiveServer(name) {
		const active = readMcpConfig();
		const found = active.servers.find((s) => s.name === name);
		if (found === void 0) return;
		const archive = readMcpArchive();
		archive.servers = without(archive.servers, name);
		archive.servers.push({
			...normalizeMcpServer(found),
			enabled: false
		});
		writeMcpArchive(archive);
		writeMcpConfig({ servers: without(active.servers, name) });
	}
	/** Move one archived definition back into the active document. */
	activateServer(name) {
		const archive = readMcpArchive();
		const found = archive.servers.find((s) => s.name === name);
		if (found === void 0) return;
		writeMcpArchive({
			version: ARCHIVE_VERSION,
			servers: without(archive.servers, name)
		});
		const active = readMcpConfig();
		active.servers = without(active.servers, name);
		active.servers.push({
			...normalizeMcpServer(found),
			enabled: true
		});
		writeMcpConfig(active);
	}
	/**
	* Restore the whole archive at once — the uninstall page's MCP half.
	*
	* One write per document rather than a loop over {@link activateServer}.
	* There is deliberately no undo: a server put back can be archived again on
	* its own row whenever the user wants.
	* @returns how many definitions were restored.
	*/
	activateAll() {
		const archive = readMcpArchive();
		if (archive.servers.length === 0) return 0;
		const restored = archive.servers.map((s) => ({
			...normalizeMcpServer(s),
			enabled: true
		}));
		writeMcpArchive({
			version: ARCHIVE_VERSION,
			servers: []
		});
		const active = readMcpConfig();
		const taken = new Set(active.servers.map((s) => s.name));
		for (const s of restored) {
			if (taken.has(s.name)) continue;
			taken.add(s.name);
			active.servers.push(s);
		}
		writeMcpConfig(active);
		return restored.length;
	}
	/** Drop a definition from whichever document holds it. */
	deleteServer(name) {
		const active = readMcpConfig();
		if (active.servers.some((s) => s.name === name)) writeMcpConfig({ servers: without(active.servers, name) });
		const archive = readMcpArchive();
		if (archive.servers.some((s) => s.name === name)) writeMcpArchive({
			version: ARCHIVE_VERSION,
			servers: without(archive.servers, name)
		});
	}
	/**
	* Persist a definition as active.
	*
	* Saving is how a row is enabled: an archived entry of the same name is
	* pulled out of the archive, and the active entry keeps its position in the
	* file when it already existed.
	*/
	saveServer(server) {
		const definition = {
			...normalizeMcpServer(server),
			enabled: true
		};
		const archive = readMcpArchive();
		if (archive.servers.some((s) => s.name === definition.name)) writeMcpArchive({
			version: ARCHIVE_VERSION,
			servers: without(archive.servers, definition.name)
		});
		writeMcpConfig({ servers: upsert(readMcpConfig().servers, definition) });
		return definition;
	}
	/**
	* One-shot probe behind the "test connection" button: connect (with
	* failOnStartupError, so a bad server rejects instead of lingering), then
	* always dispose. Already-live servers answer ok immediately — a second
	* fiber would collide on the reserved serverName namespace.
	*/
	async testConnect(server) {
		const probe = normalizeMcpServer(server);
		if (this.live.has(probe.name)) return { ok: true };
		const fiber = this.ctx.plugin(mcpClient, toMcpClientConfig(probe));
		try {
			await fiber;
			return { ok: true };
		} catch (e) {
			return {
				ok: false,
				error: reasonOf(e)
			};
		} finally {
			try {
				await fiber.dispose();
			} catch {}
		}
	}
	/**
	* Persisted definitions merged with live status, for the UI.
	* @param servers - entries from one document.
	* @param archived - true when they came from the archive: such rows are
	*   always reported inactive and stopped, whatever the live set says.
	*/
	summarize(servers, archived = false) {
		return servers.map((s) => {
			const note = this.notes.get(s.name);
			const enabled = !archived && s.enabled !== false;
			return {
				...s,
				enabled,
				status: enabled ? note?.status ?? "connecting" : "stopped",
				error: note?.error,
				archived
			};
		});
	}
	/**
	* Snapshot of the active document plus live status.
	*
	* Safe to call from a prompt renderer: it only re-reads the file and merges
	* in-memory status — it never converges the live set, unlike {@link reload}.
	*/
	current() {
		try {
			return this.summarize(readMcpConfig().servers);
		} catch {
			return [];
		}
	}
	/**
	* Active rows first, archived rows after, for the management list.
	*
	* The archived rows have to be there: without them, archiving a server would
	* remove the only row that could switch it back on.
	*/
	listForUi() {
		try {
			return [...this.summarize(readMcpConfig().servers, false), ...this.summarize(readMcpArchive().servers, true)];
		} catch {
			return [];
		}
	}
};
//#endregion
//#region src/protocol.ts
/** API paths shared by the host routes and the browser api client. */
const SMC_API = {
	skills: "/api/dsh-s-m-c-center/skills",
	skillRead: "/api/dsh-s-m-c-center/skills/read",
	skillToggle: "/api/dsh-s-m-c-center/skills/toggle",
	skillDelete: "/api/dsh-s-m-c-center/skills/delete",
	skillScan: "/api/dsh-s-m-c-center/skills/scan",
	skillImport: "/api/dsh-s-m-c-center/skills/import",
	skillStore: "/api/dsh-s-m-c-center/skills/store",
	skillRollback: "/api/dsh-s-m-c-center/skills/rollback",
	/** Re-run the one-shot migration after a rollback (the uninstall page's undo). */
	skillRemigrate: "/api/dsh-s-m-c-center/skills/remigrate",
	mcp: "/api/dsh-s-m-c-center/mcp",
	mcpSave: "/api/dsh-s-m-c-center/mcp/save",
	/** Activate (true) or archive (false) a definition — see McpServerSummary.archived. */
	mcpEnabled: "/api/dsh-s-m-c-center/mcp/enabled",
	/** Move every archived definition back into the active document (uninstall page). */
	mcpRestoreAll: "/api/dsh-s-m-c-center/mcp/restore-all",
	mcpDelete: "/api/dsh-s-m-c-center/mcp/delete",
	mcpTest: "/api/dsh-s-m-c-center/mcp/test",
	cli: "/api/dsh-s-m-c-center/cli",
	cliState: "/api/dsh-s-m-c-center/cli/state",
	cliSubcommands: "/api/dsh-s-m-c-center/cli/subcommands",
	cliSave: "/api/dsh-s-m-c-center/cli/save",
	cliEnabled: "/api/dsh-s-m-c-center/cli/enabled",
	cliDelete: "/api/dsh-s-m-c-center/cli/delete",
	cliProbe: "/api/dsh-s-m-c-center/cli/probe",
	settings: "/api/dsh-s-m-c-center/settings",
	settingsSave: "/api/dsh-s-m-c-center/settings/save"
};
//#endregion
//#region src/routes.ts
/** Requests may not exceed this much JSON (definitions and import lists are small). */
const MAX_BODY_BYTES = 1024 * 1024;
/** Socket addresses a browser on this machine presents — and nothing else. */
const LOOPBACK_ADDRESSES = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"::1",
	"::ffff:127.0.0.1"
]);
/** Hostnames a same-machine browser may use in its Host header. */
const LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"[::1]"
]);
/** Parse a Host header into a URL; undefined when it is not one. */
function hostUrl(host) {
	try {
		return new URL("http://" + host);
	} catch {
		return;
	}
}
/**
* Whether the request came from a browser on this machine.
*
* These routes spawn MCP servers and write user files, so a LAN-exposed dsh
* must not serve them. Three fences, cheapest first: the socket address (not
* forgeable by the client), the Host header, and the browser's own
* same-origin markers, which stop another origin from driving them via fetch.
*/
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address === void 0 || !LOOPBACK_ADDRESSES.has(address)) return false;
	const host = request.headers.host;
	if (typeof host !== "string" || host === "") return false;
	const target = hostUrl(host);
	if (target === void 0 || !LOOPBACK_HOSTNAMES.has(target.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === target.host;
	} catch {
		return false;
	}
}
/** Answer with JSON; no referrer ever travels back to the page. */
function writeJson(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(JSON.stringify(body));
}
/**
* Read a JSON object body.
* @returns the parsed object, or undefined when the body is oversized,
*   malformed, or not an object — the caller answers 400 for all three.
*/
async function readJsonBody(req) {
	const chunks = [];
	let received = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		received += buffer.length;
		if (received > MAX_BODY_BYTES) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return parsed !== null && typeof parsed === "object" ? parsed : void 0;
	} catch {
		return;
	}
}
/** A query parameter, or undefined when the route got none. */
function queryParam(url, name) {
	return url.searchParams.get(name) ?? void 0;
}
/** Message from an unknown thrown value. */
function failure(e) {
	return String(e?.message ?? e);
}
/** A string field off a request body; '' when absent or not a string. */
function bodyText(body, key) {
	const value = body?.[key];
	return typeof value === "string" ? value : "";
}
/** A boolean field off a request body; true only when it is exactly `true`. */
function bodyFlag(body, key) {
	return body?.[key] === true;
}
/**
* Build every /api/dsh-s-m-c-center route (exact paths).
* @param deps - skills engine, MCP connection manager, and CLI manager.
* @returns the route registrations.
*/
function makeRoutes(deps) {
	const { skills, mcp, cli, readOwnSettings, writeOwnSettings } = deps;
	/** Turn away anything that is not a loopback call using the right method. */
	const guard = (req, res, method) => {
		const refusal = !isLoopbackRequest(req) ? {
			status: 403,
			error: "forbidden: loopback-only"
		} : req.method !== method ? {
			status: 405,
			error: "method not allowed"
		} : null;
		if (refusal === null) return true;
		writeJson(res, refusal.status, {
			ok: false,
			error: refusal.error
		});
		return false;
	};
	/** Wrap one handler in the shared fences: loopback, method, JSON body. */
	const handle = (method, path, act) => ({
		kind: "exact",
		path,
		handler: async (req, res) => {
			if (!guard(req, res, method)) return;
			let payload = {};
			if (method === "POST") {
				const parsed = await readJsonBody(req);
				if (parsed === void 0) {
					writeJson(res, 400, {
						ok: false,
						error: "invalid or oversized JSON body"
					});
					return;
				}
				payload = parsed;
			}
			try {
				await act(req, res, payload, new URL(req.url ?? "/", "http://localhost"));
			} catch (e) {
				writeJson(res, 500, {
					ok: false,
					error: failure(e)
				});
			}
		}
	});
	const ok = (data = {}) => ({
		ok: true,
		...data
	});
	/** Every definition name across both documents, for not-found checks. */
	const allKnownNames = () => [...readMcpConfig().servers.map((s) => s.name), ...readMcpArchive().servers.map((s) => s.name)];
	return { routes: [
		handle("GET", SMC_API.skills, async (_req, res, _body, url) => {
			writeJson(res, 200, ok({ items: skills.listSkills(queryParam(url, "cwd")) }));
		}),
		handle("POST", SMC_API.skillRead, async (_req, res, body, _url) => {
			const path = bodyText(body, "path");
			if (!path) {
				writeJson(res, 400, {
					ok: false,
					error: "path required"
				});
				return;
			}
			const skill = skills.readSkill(path);
			if (skill === null) {
				writeJson(res, 404, {
					ok: false,
					error: "not a valid skill file: " + path
				});
				return;
			}
			writeJson(res, 200, ok({ skill }));
		}),
		handle("POST", SMC_API.skillToggle, async (_req, res, body, _url) => {
			const path = bodyText(body, "path");
			if (!path) {
				writeJson(res, 400, {
					ok: false,
					error: "path required"
				});
				return;
			}
			const enabled = bodyFlag(body, "enabled");
			skills.setSkillEnabled(path, enabled);
			writeJson(res, 200, ok({
				path,
				enabled
			}));
		}),
		handle("POST", SMC_API.skillDelete, async (_req, res, body, _url) => {
			const path = bodyText(body, "path");
			if (!path) {
				writeJson(res, 400, {
					ok: false,
					error: "path required"
				});
				return;
			}
			const kind = body.kind === "bundle" ? "bundle" : "file";
			const removed = skills.deleteSkill(path, kind);
			writeJson(res, 200, ok({
				path,
				removed
			}));
		}),
		handle("POST", SMC_API.skillScan, async (_req, res, body, _url) => {
			const dir = bodyText(body, "dir");
			if (!dir) {
				writeJson(res, 400, {
					ok: false,
					error: "directory is required"
				});
				return;
			}
			writeJson(res, 200, ok({ items: skills.scanSkills(dir) }));
		}),
		handle("GET", SMC_API.skillStore, async (_req, res, _body, _url) => {
			writeJson(res, 200, ok({ store: skills.storeStatus() }));
		}),
		handle("POST", SMC_API.skillRollback, async (_req, res, _body, _url) => {
			writeJson(res, 200, ok({ result: skills.rollbackMigration() }));
		}),
		handle("POST", SMC_API.skillRemigrate, async (_req, res, _body, _url) => {
			writeJson(res, 200, ok({ result: skills.reMigrate() }));
		}),
		handle("POST", SMC_API.skillImport, async (_req, res, body, _url) => {
			const items = Array.isArray(body?.items) ? body.items : [];
			if (items.length === 0) {
				writeJson(res, 400, {
					ok: false,
					error: "nothing selected"
				});
				return;
			}
			const results = skills.importSkills(items.map((it) => ({
				sourcePath: typeof it.sourcePath === "string" ? it.sourcePath : "",
				kind: it.kind === "bundle" ? "bundle" : "file"
			})));
			writeJson(res, 200, ok({ results }));
		}),
		handle("GET", SMC_API.mcp, async (_req, res, _body, _url) => {
			writeJson(res, 200, ok({ servers: mcp.listForUi() }));
		}),
		handle("POST", SMC_API.mcpSave, async (_req, res, body, _url) => {
			const server = body?.server;
			const err = validateMcpServer(server);
			if (err) {
				writeJson(res, 400, {
					ok: false,
					error: err
				});
				return;
			}
			const normalized = mcp.saveServer(server);
			await mcp.sync(readMcpConfig().servers);
			writeJson(res, 200, ok({ server: normalized }));
		}),
		handle("POST", SMC_API.mcpEnabled, async (_req, res, body, _url) => {
			const name = bodyText(body, "name");
			const enabled = bodyFlag(body, "enabled");
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			if (!allKnownNames().includes(name)) {
				writeJson(res, 404, {
					ok: false,
					error: "server not found: " + name
				});
				return;
			}
			if (enabled) mcp.activateServer(name);
			else mcp.archiveServer(name);
			await mcp.sync(readMcpConfig().servers);
			writeJson(res, 200, ok({
				name,
				enabled
			}));
		}),
		handle("POST", SMC_API.mcpDelete, async (_req, res, body, _url) => {
			const name = bodyText(body, "name");
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			if (!allKnownNames().includes(name)) {
				writeJson(res, 404, {
					ok: false,
					error: "server not found: " + name
				});
				return;
			}
			mcp.deleteServer(name);
			await mcp.sync(readMcpConfig().servers);
			writeJson(res, 200, ok({ name }));
		}),
		handle("POST", SMC_API.mcpRestoreAll, async (_req, res, _body, _url) => {
			const restored = mcp.activateAll();
			await mcp.sync(readMcpConfig().servers);
			writeJson(res, 200, ok({ restored }));
		}),
		handle("POST", SMC_API.mcpTest, async (_req, res, body, _url) => {
			const server = body?.server;
			const err = validateMcpServer(server);
			if (err) {
				writeJson(res, 400, {
					ok: false,
					error: err
				});
				return;
			}
			const result = await mcp.testConnect(server);
			writeJson(res, 200, ok({ test: result }));
		}),
		handle("GET", SMC_API.cli, async (_req, res, _body, url) => {
			writeJson(res, 200, ok({ items: cli.list(queryParam(url, "cwd")) }));
		}),
		handle("GET", SMC_API.cliState, async (_req, res, _body, url) => {
			const name = queryParam(url, "name") ?? "";
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			const state = await cli.readState(name, queryParam(url, "cwd"));
			writeJson(res, 200, ok({ state }));
		}),
		handle("GET", SMC_API.cliSubcommands, async (_req, res, _body, url) => {
			const name = queryParam(url, "name") ?? "";
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			const subcommands = await cli.listSubcommands(name, queryParam(url, "cwd"));
			writeJson(res, 200, ok({ subcommands }));
		}),
		handle("POST", SMC_API.cliSave, async (_req, res, body, _url) => {
			const entry = body?.entry;
			const err = validateCliEntry(entry);
			if (err) {
				writeJson(res, 400, {
					ok: false,
					error: err
				});
				return;
			}
			const normalized = cli.saveEntry(entry);
			writeJson(res, 200, ok({ entry: normalized }));
		}),
		handle("POST", SMC_API.cliEnabled, async (_req, res, body, _url) => {
			const name = bodyText(body, "name");
			const enabled = bodyFlag(body, "enabled");
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			cli.setEnabled(name, enabled);
			writeJson(res, 200, ok({
				name,
				enabled
			}));
		}),
		handle("POST", SMC_API.cliDelete, async (_req, res, body, _url) => {
			const name = bodyText(body, "name");
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			cli.removeEntry(name);
			writeJson(res, 200, ok({ name }));
		}),
		handle("POST", SMC_API.cliProbe, async (_req, res, body, _url) => {
			const name = bodyText(body, "name");
			if (!name) {
				writeJson(res, 400, {
					ok: false,
					error: "name required"
				});
				return;
			}
			const cwd = typeof body?.cwd === "string" ? body.cwd : void 0;
			const state = await cli.readState(name, cwd);
			const subcommands = await cli.listSubcommands(name, cwd);
			writeJson(res, 200, ok({
				state,
				subcommands
			}));
		}),
		handle("GET", SMC_API.settings, async (_req, res, _body, _url) => {
			writeJson(res, 200, ok({ settings: readOwnSettings() }));
		}),
		handle("POST", SMC_API.settingsSave, async (_req, res, body, _url) => {
			const raw = body?.settings;
			if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
				writeJson(res, 400, {
					ok: false,
					error: "settings object required"
				});
				return;
			}
			const incoming = raw;
			const current = readOwnSettings();
			const next = {
				enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : current.enabled,
				announceToAgent: typeof incoming.announceToAgent === "boolean" ? incoming.announceToAgent : current.announceToAgent
			};
			const applied = writeOwnSettings(next);
			writeJson(res, 200, ok({ settings: applied }));
		})
	] };
}
//#endregion
//#region src/settings.ts
/**
* Plugin-settings persistence for the manager's own config namespace
* (`dsh-s-m-c-center`) inside ~/.dsh/settings.yaml.
*
* The official settings surface does not expose third-party namespaces to the
* browser, so the card's "announce to agent" switch round-trips through a
* host route that edits the YAML file directly. To avoid re-serializing the
* whole document (and clobbering sibling plugins' nested structures), the
* writer performs a surgical top-level-block replacement: only the
* `dsh-s-m-c-center:` key's block is rewritten, every other line is kept
* byte-for-byte.
* @module
*/
/** The top-level settings key this plugin owns. */
const SETTINGS_NAMESPACE = "dsh-s-m-c-center";
/**
* The key builds before the rename wrote to. Installs from that era still carry
* the block — {@link migrateSettingsNamespace} moves it over once.
*/
const LEGACY_SETTINGS_NAMESPACE = "skills-mcp-manager";
/** Defaults, mirroring the host-side cordis schema in index.ts. */
const DEFAULT_SETTINGS = {
	enabled: true,
	announceToAgent: true
};
/** Path of the dsh settings document. */
function settingsPath() {
	return join(process.env.DSH_HOME || join(homedir(), ".dsh"), "settings.yaml");
}
/**
* Locate the line range of a top-level block: the `key:` line plus every
* following line that is blank or indented. Returns null when absent.
* @param lines - document split into lines.
* @param key - top-level key to find (matched as `^key:`).
* @returns `{ start, end }` half-open range, or null.
*/
function findBlock(lines, key) {
	const head = new RegExp("^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:");
	let start = -1;
	for (let i = 0; i < lines.length; i++) if (head.test(lines[i])) {
		start = i;
		break;
	}
	if (start < 0) return null;
	let end = start + 1;
	while (end < lines.length) {
		const line = lines[end];
		if (line.trim() === "") {
			end++;
			continue;
		}
		if (/^\s/.test(line)) {
			end++;
			continue;
		}
		break;
	}
	return {
		start,
		end
	};
}
function parseBool(v, fallback) {
	if (v === true || v === "true" || v === "yes" || v === "on" || v === 1 || v === "1") return true;
	if (v === false || v === "false" || v === "no" || v === "off" || v === 0 || v === "0") return false;
	return fallback;
}
/** Strip one layer of matching quotes from a scalar. */
function unquote(v) {
	const s = v.trim();
	if (s.length >= 2 && (s[0] === "\"" && s[s.length - 1] === "\"" || s[0] === "'" && s[s.length - 1] === "'")) return s.slice(1, -1);
	return s;
}
/** Read `key: value` pairs from a block body (one indent level deep only). */
function parseBlockBody(lines) {
	const data = {};
	for (const line of lines) {
		const m = /^\s+([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
		if (m) data[m[1]] = unquote(m[2]);
	}
	return data;
}
/** Read the plugin's settings, falling back to defaults for anything missing. */
function readSettings() {
	const target = settingsPath();
	if (!existsSync(target)) return { ...DEFAULT_SETTINGS };
	let raw;
	try {
		raw = readFileSync(target, "utf8");
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
	const lines = raw.split(/\r?\n/);
	const block = findBlock(lines, SETTINGS_NAMESPACE);
	if (block === null) return { ...DEFAULT_SETTINGS };
	const body = parseBlockBody(lines.slice(block.start + 1, block.end));
	return {
		enabled: parseBool(body.enabled, DEFAULT_SETTINGS.enabled),
		announceToAgent: parseBool(body.announceToAgent, DEFAULT_SETTINGS.announceToAgent)
	};
}
/** Serialize the settings as a YAML block (2-space indent, `key:` first line). */
function renderBlock(settings) {
	return [
		"dsh-s-m-c-center:",
		"  enabled: " + settings.enabled,
		"  announceToAgent: " + settings.announceToAgent
	];
}
/**
* Replace (or append) the plugin's top-level block, leaving every other line
* untouched. Creates the file (and its directory) when missing.
* @param settings - the complete settings to persist.
* @returns the path written.
*/
function writeSettings(settings) {
	const target = settingsPath();
	ensureSettingsDir();
	const normalized = {
		enabled: settings.enabled !== false,
		announceToAgent: settings.announceToAgent !== false
	};
	let lines = [];
	if (existsSync(target)) try {
		lines = readFileSync(target, "utf8").split(/\r?\n/);
	} catch {
		lines = [];
	}
	if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	const block = findBlock(lines, SETTINGS_NAMESPACE);
	const rendered = renderBlock(normalized);
	if (block === null) {
		writeFileSync(target, lines.concat(rendered).join("\n") + "\n", "utf8");
		return target;
	}
	writeFileSync(target, lines.slice(0, block.start).concat(rendered, lines.slice(block.end)).join("\n") + "\n", "utf8");
	return target;
}
/** Ensure the settings directory exists before a write (defensive). */
function ensureSettingsDir() {
	mkdirSync(dirname(settingsPath()), { recursive: true });
}
/**
* Rename a legacy settings block to the current key, in place.
*
* Only the block's first line changes, so every value the user ever set is
* carried across untouched; the rest of the document is not even re-serialized.
* If the current key is already present the stale block is simply dropped —
* the live one wins.
*
* Idempotent: once there is nothing legacy left to find it does nothing.
*
* @returns true when the document was rewritten.
*/
function migrateSettingsNamespace() {
	const target = settingsPath();
	if (!existsSync(target)) return false;
	let lines;
	try {
		lines = readFileSync(target, "utf8").split(/\r?\n/);
	} catch {
		return false;
	}
	const legacy = findBlock(lines, LEGACY_SETTINGS_NAMESPACE);
	if (legacy === null) return false;
	if (findBlock(lines, "dsh-s-m-c-center") === null) lines[legacy.start] = "dsh-s-m-c-center:";
	else lines.splice(legacy.start, legacy.end - legacy.start);
	writeFileSync(target, lines.join("\n"), "utf8");
	return true;
}
//#endregion
//#region src/index.ts
/** Cordis plugin id. Renaming it breaks existing profiles — treat as fixed. */
const name = "dsh-s-m-c-center";
/** Services that must be present before any surface mounts. `settings` is
* absent on purpose: the config section is attached later through
* `ctx.inject`, so a host without a settings surface still gets routes + MCP. */
const inject = [
	"webServer",
	"tools",
	"systemPrompt"
];
/**
* Key of this plugin's block in `~/.dsh/settings.yaml`.
*
* Written as a literal rather than imported so the browser half can spell the
* same value without depending on a Host package. It stays a plain kebab-case
* string because the `settingsNamespace()` branding helper was dropped from
* `@deepseek-ai/dsh-settings` in DSH 0.1.2-alpha.2.
*/
const SMC_NAMESPACE = "dsh-s-m-c-center";
/** Schema form of the above, so dsh validates the block as it loads it. */
const Config = z.object({
	enabled: z.boolean().default(true),
	announceToAgent: z.boolean().default(true)
});
/** Fallbacks used until a config block has been written. */
const DEFAULT_ENABLED = true;
const DEFAULT_ANNOUNCE = true;
/** Where the announcement sits inside the tool-guidance band. */
const SECTION_ORDER = 160;
/**
* Workspace root for project-scoped discovery in the announcement.
* Project-level skills live under the cwd, so the same plugin announces a
* different skill set depending on where dsh is running.
*/
function workspaceCwd() {
	try {
		return process.cwd();
	} catch {
		return;
	}
}
/**
* Model-facing announcement: plugin presence, capabilities, and limits.
*
* Kept as the static form of the announcement and used as the fallback when the
* live state cannot be read. The section normally renders
* {@link renderAnnouncement} instead, which splices in the actual skills, MCP
* servers and CLI tools — see `src/announce.ts` for why that matters.
*/
const SMC_GUIDANCE = "本机已安装 dsh-s-m-c-center 插件（工具管理：技能 / MCP / CLI 管理器）：设置页「Web UI 插件 → 工具管理」。能力：浏览/启用/不启用/删除/导入技能（项目级 .dsh/skills、.agents/skills 与用户级 ~/.dsh/skills、~/.agents/skills）；管理 MCP 服务器（stdio 与 streamable-http，激活/归档）；以及本地 CLI 工具清单与状态（发现 skill 内嵌的 CLI 包装脚本如 scripts/run-cli、以及系统 CLI 如 gh/git/tencent-news-cli，报告是否安装/版本/需更新/子命令/API-Key 状态）。MCP 是真实连接：激活的服务器经 @deepseek-ai/dsh-mcp-client 真正连接并把工具注册为 mcp__<server>__<tool>，激活/归档会实际连接/断开。注册新技能：为用户新建用户级技能时，把技能文件夹直接创建到 ~/.dsh/S-M-C/skills/<技能名>/（内含 SKILL.md），不要写到 ~/.dsh/skills、~/.agents/skills 等储存库外的目录 —— 只有储存库里的技能才会被统一管理；写入后会以「未启用」出现在管理页，用户启用后你即可通过 skill 工具加载，项目专用技能仍放当前项目的 .dsh/skills/。限制：本插件的数据统一存 ~/.dsh/S-M-C（MCP 激活 mcp.json、归档 mcp-archive.json、CLI 注册表 cli.json；密码/env 明文、权限 0600 由用户自行保证）；用户级技能正本在 ~/.dsh/S-M-C/skills，启用/不启用等于在 skills 目录增删联接（不改写 SKILL.md）；删除为物理删除，不可恢复。用户提到「技能管理 / 技能导入 / MCP 服务器 / MCP 连接 / CLI 工具 / CLI 状态」时即指本插件，请据此协作。";
/**
* Wire this plugin into a host context: adopt any legacy on-disk layout, build
* the three engines, then register whichever surfaces the current config asks
* for — and keep them in step with every later config change.
*
* @param ctx - host context exposing the webserver / tools / system-prompt services.
* @param config - the composition entry's config, if any; schema defaults are
*   already applied by the loader before this runs.
*/
function apply(ctx, config) {
	let current = () => config ?? {};
	const resolve = () => ({
		enabled: current().enabled ?? DEFAULT_ENABLED,
		announceToAgent: current().announceToAgent ?? DEFAULT_ANNOUNCE
	});
	const skills = new SkillsManager();
	const cli = new CliManager(skills);
	const mcp = new McpManager(ctx);
	try {
		migrateSettingsNamespace();
		migrateStoreRoot(skills);
		skills.migrate();
		mcp.migrateArchive();
		invalidateAnnouncement();
	} catch {}
	let disposeSection;
	let disposeRoutes;
	let applyAnnouncement = () => {};
	const { routes } = makeRoutes({
		skills,
		mcp,
		cli,
		readOwnSettings: () => readSettings(),
		writeOwnSettings: (next) => {
			writeSettings(next);
			current = () => ({
				enabled: readSettings().enabled,
				announceToAgent: readSettings().announceToAgent
			});
			invalidateAnnouncement();
			applyAnnouncement();
			return readSettings();
		}
	});
	applyAnnouncement = () => {
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		if (!resolve().enabled) return;
		if (resolve().announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-s-m-c-center",
			order: SECTION_ORDER,
			text: () => {
				try {
					return renderAnnouncement({
						skills,
						mcp,
						cli
					}, workspaceCwd());
				} catch {
					return SMC_GUIDANCE;
				}
			}
		});
	};
	const sync = () => {
		const value = resolve();
		if (disposeRoutes !== void 0) {
			disposeRoutes();
			disposeRoutes = void 0;
		}
		invalidateAnnouncement();
		applyAnnouncement();
		if (!value.enabled) {
			mcp.dispose();
			return;
		}
		disposeRoutes = ctx.effect(() => {
			const disposers = routes.map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "dsh-s-m-c-center: routes");
		mcp.reload();
	};
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, SMC_NAMESPACE, Config, config ?? {}, {
			setSource: (source) => {
				current = source;
				sync();
			},
			onChange: sync
		});
	});
	ctx.effect(() => () => {
		mcp.dispose();
	}, "dsh-s-m-c-center: mcp");
	sync();
}
//#endregion
export { Config, SMC_GUIDANCE, SMC_NAMESPACE, apply, inject, name };
