window.__ModuleLoader__.load({
	id: "dsh-s-m-c-center",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			title: "工具管理",
			description: "管理技能、MCP 服务器与本地 CLI 工具（MCP 为真实连接）。",
			expand: "展开",
			collapse: "收起",
			notExposed: "当前部署未向此客户端提供该插件的设置命名空间。",
			readOnly: "设置文档为只读，无法保存更改。",
			unsaved: "未保存",
			discard: "放弃更改",
			save: "保存",
			saving: "保存中…",
			saveFailed: "保存未成功，请重试。",
			inherit: "继承",
			overridden: "已覆盖",
			reset: "重置",
			invalid: "输入无效",
			enabled: "启用插件",
			enabledHint: "关闭后，路由与 MCP 连接会全部停止。",
			announce: "向 Agent 公告",
			announceHint: "在系统提示中向每个 Agent 说明本插件的存在与能力。",
			on: "开",
			off: "关",
			tabSkills: "Skills 技能",
			tabMcp: "MCP 服务",
			tabCli: "CLI 工具",
			tabGuide: "使用说明",
			panelMcp: "MCP 服务器",
			panelCli: "本地 CLI 工具",
			panelUninstall: "卸载准备",
			panelGuide: "使用说明",
			guideIntro: "本插件把 agent 的三类工具（技能 / MCP / CLI）收在一个设置页里。下面按类别说明各自是怎么工作的；最下方是卸载前的准备。",
			guideSkillsH: "技能（Skills）",
			guideStoreH: "储存库与目录联接",
			guideStoreP: "用户级技能的正本统一放在储存库的 skills/ 目录；各个 skills 目录里看到的是指向正本的目录联接。你不用管联接——界面上只有「启用 / 不启用」。",
			guideEnableH: "启用 / 不启用",
			guideEnableP: "启用 = 在对应 skills 目录注入联接，AI 立刻能用；不启用 = 移除联接，AI 完全看不到。两种情况都不改写 SKILL.md。项目级技能就地管理，仍按前言里的开关。",
			guideMcpH: "MCP 服务器",
			guideConnectH: "真实连接",
			guideConnectP: "激活的服务器经 @deepseek-ai/dsh-mcp-client 真正连接，工具注册为 mcp__<server>__<tool>——不是只写了一份配置。连接失败会在那一行显示原因。",
			guideArchiveH: "激活 / 归档",
			guideArchiveP: "归档 = 把定义移到 mcp-archive.json：不连接、不公告，但完整保留；点「激活」随时移回 mcp.json 并重新连接。编辑一条已归档的服务器再保存，等同于激活它。",
			guideCliH: "本地 CLI 工具",
			guideDiscoverH: "发现与体检",
			guideDiscoverP: "自动发现 skill 内嵌的 CLI（scripts/run-cli）与登记的系统 CLI（gh / git 等），探测是否安装、版本、是否需更新、API-Key 状态，并列出子命令。",
			guideAnnounceH: "公告 / 隐藏",
			guideAnnounceP: "开关只决定「是否把这个 CLI 写进给 AI 的公告」——CLI 由系统安装，插件无法启停它。随 skills 安装的 CLI（标「技能 CLI」）建议保持隐藏：它们主要供所属 skill 自己调用，公告出去只会撑大系统提示。",
			guideDataH: "数据放在哪里",
			guideDataP: "插件的全部数据都在统一储存库（默认 ~/.dsh/S-M-C，可用 DSH_STORE_ROOT 改位）：skills/ 放技能正本、mcp.json 放激活的服务器、mcp-archive.json 放归档的、cli.json 放 CLI 登记表。密码与环境变量为明文，文件权限 0600 需自行保证。",
			sourceSystem: "系统 CLI",
			skillList: "技能列表",
			skillsTabInPlace: "就地管理",
			skillsTabStore: "储存库",
			adopt: "收容",
			adoptBusy: "收容中…",
			msgAdopted: "已收容进储存库并启用：{name}",
			inPlaceNote: "启用 / 禁用＝是否注入 agent 上下文（写入 / 移除 SKILL.md 前言标记）。未收容的技能（文件本来就在扫描目录里）与已发送快捷方式的技能都可切换；快捷方式被移除时锁定为禁用。",
			storePageNote: "是否在 skills 文件夹发送快捷方式（A/B）。发送＝agent 经联接看到该技能；移除＝联接消失，就地管理页的启用 / 禁用随之锁定。未收容的技能不参与此轴——需先导入或收容。",
			importSkill: "导入技能",
			newServer: "新建 / 编辑服务器",
			registerCli: "登记系统 CLI",
			modeForm: "表单",
			modeJson: "JSON",
			refresh: "刷新",
			edit: "编辑",
			delete: "删除",
			confirmDelete: "再次点击确认删除",
			add: "添加",
			testConnect: "测试连接",
			testing: "测试中…",
			loading: "加载中…",
			chooseFolder: "选择文件夹",
			scanDir: "扫描目录",
			scanning: "扫描中…",
			importSelected: "导入选中 ({n})",
			rollback: "撤销迁移",
			rollingBack: "撤销中…",
			probe: "探测",
			probing: "探测中…",
			details: "详情",
			announceTitle: "向 AI 公告",
			announceReading: "读取中…",
			announceOnState: "已开启",
			announceOffState: "已关闭",
			announceOnNote: "开启后，插件会在每个智能体的系统提示中声明自身能力（技能 / MCP / CLI 管理）。",
			announceOffNote: "关闭后，则完全不向 AI 暴露本插件的存在与能力。",
			persistA: "设置持久化到",
			persistB: "命名空间，写在",
			persistC: "；切换即时生效，无需重启。",
			pluginDisabled: "插件已禁用：路由与 MCP 连接、CLI 探测均已停止，重新启用后刷新即可恢复。",
			storeMigrated: "技能已迁入统一储存库：{root}",
			storeCount: "共 {count} 个，已启用 {enabled} 个。",
			storeFailures: " 有 {n} 个未能迁移，已保留在原位置。",
			stConnecting: "连接中",
			stRunning: "运行中",
			stFailed: "失败",
			stStopped: "已停止",
			stInstalled: "已安装",
			stNotFound: "未找到",
			stNotConnected: "未连接",
			suffixArchived: " （已归档）",
			suffixHidden: " （已隐藏）",
			suffixNotEnabled: " （未启用）",
			suffixDir: " (目录)",
			suffixFile: " (文件)",
			badgeStore: "储存器",
			badgeInPlace: "就地管理",
			badgeArchive: "归档库",
			badgeActive: "已启用",
			badgeSkill: "Skill",
			cliAdvertised: "公告",
			cliHidden: "隐藏",
			cliSkillSource: "技能 CLI",
			mcpTabManage: "管理",
			mcpTabCreate: "新建",
			activate: "激活",
			archive: "归档",
			switchEnable: "启用",
			switchLocked: "锁定禁用（无快捷方式）",
			linkOn: "已发送快捷方式",
			linkOff: "无快捷方式",
			linkNone: "未收容",
			switchDisable: "禁用",
			filterAll: "全部",
			filterEnabled: "已启用",
			filterDisabled: "未启用",
			levelProject: "项目级",
			levelUser: "用户级",
			emptySkills: "没有发现技能",
			emptyStoreTab: "储存库为空",
			otherSubpageHint: "其余技能在另一个子页。",
			emptySkillMatch: "没有匹配的技能",
			emptyMcp: "尚未配置任何 MCP 服务器",
			emptyMcpMatch: "没有匹配的服务器",
			emptyCli: "未发现 CLI 工具",
			emptyCliMatch: "没有匹配的 CLI",
			phSearchSkill: "搜索技能名称…",
			phSearchServer: "搜索服务器名称…",
			phSearchCli: "搜索 CLI 名称…",
			phImportDir: "目录路径（含 SKILL.md 的技能目录或平铺 .md）",
			phCliName: "CLI 命令名，例如 gh",
			phCliCall: "调用名（可留空，默认同命令名）",
			phServerName: "例如 github",
			fieldName: "名称 name",
			fieldTransport: "传输 transport",
			fieldCommand: "命令 command",
			fieldArgs: "参数 args（每行一个）",
			fieldEnv: "环境变量 env（KEY=VALUE 每行一个）",
			fieldCwd: "工作目录 cwd",
			fieldUrl: "URL",
			fieldHeaders: "请求头 headers（KEY=VALUE 每行一个）",
			rowExists: "存在",
			rowPath: "路径",
			rowVersion: "版本",
			rowNeedUpdate: "需要更新",
			rowApiKey: "API Key",
			rowKeyError: "Key 错误",
			yesUpdateRecommended: "是（建议 update）",
			no: "否",
			configured: "已配置",
			msgEnterCliName: "请输入 CLI 命令名",
			msgJsonFailed: "JSON 解析失败：{error}",
			msgSaved: "已保存 {name}",
			msgConnectOk: "连接成功",
			msgConnectFailed: "连接失败：{error}",
			msgActivated: "已激活 {name}",
			msgArchived: "已归档 {name}",
			msgRollbackOk: "已撤销迁移，恢复 {moved} 个技能到原位置",
			msgRollbackPartial: "恢复 {moved} 个技能，{failed} 个失败",
			msgEnterDir: "请输入目录路径",
			msgNoImportable: "未发现可导入的技能",
			msgSelectFirst: "请先勾选要导入的技能",
			msgImported: "已导入 {n} 个技能",
			detailWhenToUse: "何时使用",
			cliSkillPrefix: "技能",
			uninstallIntro: "准备卸载本插件时，先在这里把托管的数据归还回系统默认位置，再手动删除储存库目录。",
			uninstallSkillsTitle: "技能迁移",
			uninstallSkillsNote: "储存库里有技能时，「撤销迁移」把它们移回原始位置、联接一并移除，agent 看到的技能与迁移前完全一致；储存库空着而 skills 目录里还有技能时，按钮变为「迁移」，可随时把技能重新收进储存库。",
			uninstallMcpTitle: "MCP 注入",
			uninstallMcpNote: "「MCP 全部注入」把归档的服务器一次性移回 mcp.json 并重新连接。此操作无需撤回：不需要的服务器随时可以在「MCP 服务」页单独停用或删除。",
			uninstallFilesTitle: "需要手动删除的文件",
			uninstallFilesNote: "插件卸载不会清理数据。移除插件后，请手动删除整个储存库目录；删除目录即包含以下全部内容：",
			uninstallFilesList: "skills/（技能正本）、mcp.json（激活的 MCP 服务器）、mcp-archive.json（归档的 MCP 服务器）、cli.json（CLI 登记表）",
			uninstallSettingsPath: "另外，~/.dsh/settings.yaml 中的 dsh-s-m-c-center 配置块可以一并删掉。",
			uninstallNothing: "储存库中没有技能、skills 目录也没有待迁移的技能，归档里也没有 MCP 服务器——无需任何操作。",
			migrateSkills: "迁移",
			migratingSkills: "迁移中…",
			restoreAllMcp: "MCP 全部注入",
			restoringMcp: "注入中…",
			msgMigrateDone: "已迁移 {moved} 个技能。",
			msgRestoreDone: "已注入 {restored} 个 MCP 服务器。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			title: "Tool Manager",
			description: "Manage skills, MCP servers and local CLI tools (MCP connects for real).",
			expand: "Show",
			collapse: "Hide",
			notExposed: "This deployment does not expose the plugin settings namespace to this client.",
			readOnly: "The settings document is read-only; changes cannot be saved.",
			unsaved: "Unsaved",
			discard: "Discard",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The save did not land; please retry.",
			inherit: "Inherit",
			overridden: "Overridden",
			reset: "Reset",
			invalid: "Invalid",
			enabled: "Enable plugin",
			enabledHint: "When off, routes and MCP connections all stop.",
			announce: "Announce to agent",
			announceHint: "Describe this plugin and its capabilities in every agent system prompt.",
			on: "On",
			off: "Off",
			tabSkills: "Skills",
			tabMcp: "MCP servers",
			tabCli: "CLI tools",
			tabGuide: "Guide",
			panelMcp: "MCP servers",
			panelCli: "Local CLI tools",
			panelUninstall: "Uninstall preparation",
			panelGuide: "Guide",
			guideIntro: "The plugin gathers the agent’s three tool families (skills, MCP servers, local CLI tools) into one settings page. Below is how each of them works; the last section covers uninstalling.",
			guideSkillsH: "Skills",
			guideStoreH: "The store and its links",
			guideStoreP: "The canonical copy of every user-level skill lives under skills/ in the store; what each skills directory shows is a junction pointing at it. You never manage the links — the UI only offers enable / disable.",
			guideEnableH: "Enable / disable",
			guideEnableP: "Enabling injects a junction into the matching skills directory and the AI can use the skill right away; disabling removes it and the AI sees nothing. Neither rewrites SKILL.md. Project-level skills stay in place and still switch through their frontmatter.",
			guideMcpH: "MCP servers",
			guideConnectH: "Real connections",
			guideConnectP: "Enabled servers are really connected through @deepseek-ai/dsh-mcp-client and register their tools as mcp__<server>__<tool> — not merely a config entry. A failed connection shows its reason on the row.",
			guideArchiveH: "Enable / archive",
			guideArchiveP: "Archiving moves a definition to mcp-archive.json: not connected, not announced, but kept whole; “enable” moves it back to mcp.json and reconnects it. Editing an archived server and saving has the same effect as enabling it.",
			guideCliH: "Local CLI tools",
			guideDiscoverH: "Discovery and health check",
			guideDiscoverP: "Finds the CLIs a skill embeds (scripts/run-cli) plus registered system CLIs (gh, git …), probing whether each is installed, its version, whether an update is due, its API-key state, and its subcommands.",
			guideAnnounceH: "Announce / hide",
			guideAnnounceP: "The switch only decides whether the CLI is written into the agent announcement — the plugin cannot start or stop a CLI the system installs. Skill-provided CLIs (labelled “Skill CLI”) are best left hidden: their own skill calls them, and announcing them only pads the system prompt.",
			guideDataH: "Where the data lives",
			guideDataP: "Everything this plugin stores lives in one place — by default ~/.dsh/S-M-C (relocate with DSH_STORE_ROOT): skills/ holds the canonical skill copies, mcp.json the enabled servers, mcp-archive.json the archived ones, cli.json the CLI registry. Secrets and env vars are plain text; file permissions (0600) are up to you.",
			sourceSystem: "System CLI",
			skillList: "Skills",
			skillsTabInPlace: "In place",
			skillsTabStore: "Store",
			adopt: "Adopt",
			adoptBusy: "Adopting…",
			msgAdopted: "Adopted into the store and enabled: {name}",
			inPlaceNote: "Enable / disable = whether the skill is injected into the agent context (written as / removed from the SKILL.md frontmatter marker). Switchable for unmanaged skills (their file already sits in a scanned root) and for skills whose link is in place; locked to disabled once the link is removed.",
			storePageNote: "Whether a link is sent into the skills folder (A/B). Sending it makes the skill reachable through the link; removing it drops the link and locks the in-place enable/disable switch. Unmanaged skills are outside this axis — import or adopt them first.",
			importSkill: "Import skills",
			newServer: "New / edit server",
			registerCli: "Register a system CLI",
			modeForm: "Form",
			modeJson: "JSON",
			refresh: "Refresh",
			edit: "Edit",
			delete: "Delete",
			confirmDelete: "Click again to confirm",
			add: "Add",
			testConnect: "Test connection",
			testing: "Testing…",
			loading: "Loading…",
			chooseFolder: "Choose folder",
			scanDir: "Scan directory",
			scanning: "Scanning…",
			importSelected: "Import selected ({n})",
			rollback: "Undo migration",
			rollingBack: "Undoing…",
			probe: "Probe",
			probing: "Probing…",
			details: "Details",
			announceTitle: "Announce to AI",
			announceReading: "Loading…",
			announceOnState: "On",
			announceOffState: "Off",
			announceOnNote: "When on, the plugin declares what it can do (skills / MCP / CLI) in every agent system prompt.",
			announceOffNote: "When off, the plugin is completely invisible to the AI — neither its presence nor its capabilities.",
			persistA: "The setting persists under the",
			persistB: " namespace in",
			persistC: "; switching takes effect immediately, no restart needed.",
			pluginDisabled: "Plugin disabled: routes, MCP connections and CLI probing have all stopped. Re-enable it and refresh to recover.",
			storeMigrated: "Skills moved into the unified store: {root}",
			storeCount: "{count} in total, {enabled} enabled.",
			storeFailures: " {n} could not be moved and were left in place.",
			stConnecting: "Connecting",
			stRunning: "Running",
			stFailed: "Failed",
			stStopped: "Stopped",
			stInstalled: "Installed",
			stNotFound: "Not found",
			stNotConnected: "Not connected",
			suffixArchived: " (archived)",
			suffixHidden: " (hidden)",
			suffixNotEnabled: " (disabled)",
			suffixDir: " (dir)",
			suffixFile: " (file)",
			badgeStore: "Store",
			badgeInPlace: "In place",
			badgeArchive: "Archive",
			badgeActive: "Enabled",
			badgeSkill: "Skill",
			cliAdvertised: "Advertised",
			cliHidden: "Hidden",
			cliSkillSource: "Skill CLI",
			mcpTabManage: "Manage",
			mcpTabCreate: "Create",
			activate: "Enable",
			archive: "Archive",
			switchEnable: "Enable",
			switchLocked: "Locked off (no link)",
			linkOn: "Link sent",
			linkOff: "No link",
			linkNone: "Not adopted",
			switchDisable: "Disable",
			filterAll: "All",
			filterEnabled: "Enabled",
			filterDisabled: "Disabled",
			levelProject: "Project",
			levelUser: "User",
			emptySkills: "No skills found",
			emptyStoreTab: "The store is empty",
			otherSubpageHint: "Remaining skills live on the other sub-page.",
			emptySkillMatch: "No matching skills",
			emptyMcp: "No MCP servers configured yet",
			emptyMcpMatch: "No matching servers",
			emptyCli: "No CLI tools found",
			emptyCliMatch: "No matching CLIs",
			phSearchSkill: "Search skill names…",
			phSearchServer: "Search server names…",
			phSearchCli: "Search CLI names…",
			phImportDir: "Directory path (a skill dir with SKILL.md, or flat .md files)",
			phCliName: "CLI command name, e.g. gh",
			phCliCall: "Invoked name (optional; defaults to the command name)",
			phServerName: "e.g. github",
			fieldName: "Name (name)",
			fieldTransport: "Transport (transport)",
			fieldCommand: "Command (command)",
			fieldArgs: "Args (one per line)",
			fieldEnv: "Env (KEY=VALUE, one per line)",
			fieldCwd: "Working directory (cwd)",
			fieldUrl: "URL",
			fieldHeaders: "Headers (KEY=VALUE, one per line)",
			rowExists: "Exists",
			rowPath: "Path",
			rowVersion: "Version",
			rowNeedUpdate: "Update needed",
			rowApiKey: "API key",
			rowKeyError: "Key error",
			yesUpdateRecommended: "Yes (update recommended)",
			no: "No",
			configured: "Configured",
			msgEnterCliName: "Enter the CLI command name",
			msgJsonFailed: "JSON parse failed: {error}",
			msgSaved: "Saved {name}",
			msgConnectOk: "Connected",
			msgConnectFailed: "Connection failed: {error}",
			msgActivated: "Enabled {name}",
			msgArchived: "Archived {name}",
			msgRollbackOk: "Migration undone: {moved} skills restored to their original locations",
			msgRollbackPartial: "Restored {moved} skills, {failed} failed",
			msgEnterDir: "Enter a directory path",
			msgNoImportable: "No importable skills found",
			msgSelectFirst: "Select the skills to import first",
			msgImported: "Imported {n} skills",
			detailWhenToUse: "When to use",
			cliSkillPrefix: "Skill",
			uninstallIntro: "Before uninstalling this plugin, give its managed data back to the system default locations here, then delete the store directory by hand.",
			uninstallSkillsTitle: "Skills migration",
			uninstallSkillsNote: "When the store holds skills, \"Undo migration\" moves them back to their original locations and removes the links — what the agent sees is exactly what it saw before the migration. When the store is empty but skills still sit in the skills directories, the button turns into \"Migrate\" to bring them back into the store.",
			uninstallMcpTitle: "MCP injection",
			uninstallMcpNote: "\"Inject all MCP\" moves every archived server back into mcp.json in one pass and reconnects it. No undo is provided: a server you no longer need can be archived or deleted individually on the MCP tab at any time.",
			uninstallFilesTitle: "Files to remove by hand",
			uninstallFilesNote: "Uninstalling the plugin does not clean up its data. After removal, delete the whole store directory; deleting it covers everything listed below:",
			uninstallFilesList: "skills/ (canonical skill copies), mcp.json (active MCP servers), mcp-archive.json (archived MCP servers), cli.json (CLI registry)",
			uninstallSettingsPath: "Also feel free to delete the dsh-s-m-c-center block in ~/.dsh/settings.yaml.",
			uninstallNothing: "The store holds no skills, no skills await migration, and no MCP servers are archived — nothing to do.",
			migrateSkills: "Migrate",
			migratingSkills: "Migrating…",
			restoreAllMcp: "Inject all MCP",
			restoringMcp: "Injecting…",
			msgMigrateDone: "Migrated {moved} skills.",
			msgRestoreDone: "Injected {restored} MCP servers."
		};
		//#endregion
		//#region \0dsh-css:src/client/settings-card.module.css.mjs
		const css = ".KApx_W_manager{--sp-1:4px;--sp-2:8px;--sp-3:10px;--sp-4:12px;--sp-5:14px;--sp-6:20px;--r-sm:6px;--r-md:8px;--r-pill:999px;--line:#80808040;--line-strong:#80808061;--fill-1:#8080800f;--fill-2:#8080801f;--fill-3:#8080802e;--muted:gray;--danger:#e5534b;--danger-line:#e5534b6b;--danger-fill:#e5534b1a;--ok:#3fb950;--ok-line:#3fb9506b;--ok-fill:#3fb9501a;--focus:0 0 0 2px #80808059;gap:var(--sp-6);flex-direction:column;font-size:13px;line-height:1.5;display:flex}.KApx_W_sectionPage{gap:var(--sp-4);flex-direction:column;max-width:1040px;display:flex}.KApx_W_pageHeading{letter-spacing:.01em;margin:0;font-size:17px;font-weight:600}.KApx_W_pageIntro{color:var(--muted);margin:0;font-size:13px}.KApx_W_tabs{gap:var(--sp-1);border-bottom:1px solid var(--line);display:flex}.KApx_W_tab,.KApx_W_tabActive{font:inherit;color:inherit;padding:var(--sp-2) var(--sp-5);cursor:pointer;opacity:.68;background:0 0;border:none;border-bottom:2px solid #0000;margin-bottom:-1px;transition:opacity .12s,border-color .12s,background .12s}.KApx_W_tab:hover{opacity:.9;background:var(--fill-1)}.KApx_W_tab:focus-visible{box-shadow:var(--focus);border-radius:var(--r-sm) var(--r-sm) 0 0;outline:none}.KApx_W_tabActive{opacity:1;border-bottom-color:currentColor;font-weight:600}.KApx_W_panel{gap:var(--sp-6);flex-direction:column;display:flex}.KApx_W_section{gap:var(--sp-3);flex-direction:column;display:flex}.KApx_W_h{margin:0;font-size:14px;font-weight:600}.KApx_W_hGrow{flex:auto;margin:0;font-size:14px;font-weight:600}.KApx_W_groupH{margin:var(--sp-3) 0 var(--sp-1);color:var(--muted);text-transform:none;letter-spacing:.02em;font-size:12px;font-weight:600}.KApx_W_docH1{margin:20px 0 0;font-size:15px;font-weight:600}.KApx_W_inline{align-items:center;gap:var(--sp-2);flex-wrap:wrap;display:flex}.KApx_W_row{align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);transition:border-color .12s,background .12s;display:flex}.KApx_W_row:hover{border-color:var(--line-strong);background:var(--fill-2)}.KApx_W_row+.KApx_W_row{margin-top:var(--sp-2)}.KApx_W_main{flex:auto;min-width:0}.KApx_W_name{align-items:center;gap:var(--sp-2);color:inherit;flex-wrap:wrap;font-weight:600;display:flex}.KApx_W_nameText{overflow-wrap:anywhere;word-break:break-word;flex:auto;min-width:0}.KApx_W_desc{color:var(--muted);text-overflow:ellipsis;white-space:nowrap;margin-top:2px;font-size:12px;overflow:hidden}.KApx_W_badge{border-radius:var(--r-pill);background:var(--fill-3);white-space:nowrap;flex:none;padding:1px 8px;font-size:11px}.KApx_W_status{color:var(--muted);white-space:nowrap;flex:none;font-size:11px;font-weight:400}.KApx_W_switch{white-space:nowrap;cursor:pointer;user-select:none;align-items:center;gap:6px;font-size:12px;display:inline-flex}.KApx_W_switch input{-webkit-appearance:none;appearance:none;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--fill-2);cursor:pointer;flex:none;width:34px;height:18px;margin:0;transition:background .15s,border-color .15s;position:relative}.KApx_W_switch input:after{content:\"\";background:var(--muted);border-radius:50%;width:12px;height:12px;transition:transform .15s,background .15s;position:absolute;top:2px;left:2px}.KApx_W_switch input:checked{background:#80808073;border-color:#8080808c}.KApx_W_switch input:checked:after{background:#fff;transform:translate(16px)}.KApx_W_switch input:focus-visible{box-shadow:var(--focus);outline:none}.KApx_W_switch input:disabled{opacity:.45;cursor:default}.KApx_W_btn,.KApx_W_btnPrimary,.KApx_W_btnDanger,.KApx_W_btnSuccess,.KApx_W_btnActive{font:inherit;padding:var(--sp-1) var(--sp-3);border:1px solid var(--line-strong);border-radius:var(--r-sm);color:inherit;white-space:nowrap;cursor:pointer;background:0 0;font-size:12px;transition:background .12s,border-color .12s,opacity .12s}.KApx_W_btn:hover,.KApx_W_btnActive:hover{background:var(--fill-2)}.KApx_W_btn:focus-visible,.KApx_W_btnPrimary:focus-visible,.KApx_W_btnDanger:focus-visible,.KApx_W_btnSuccess:focus-visible,.KApx_W_btnActive:focus-visible{box-shadow:var(--focus);outline:none}.KApx_W_btn:disabled,.KApx_W_btnPrimary:disabled,.KApx_W_btnDanger:disabled,.KApx_W_btnSuccess:disabled,.KApx_W_btnActive:disabled{opacity:.45;cursor:default}.KApx_W_btnPrimary{background:var(--fill-2);border-color:currentColor;font-weight:600}.KApx_W_btnPrimary:hover{background:var(--fill-3)}.KApx_W_btnDanger{color:var(--danger);border-color:var(--danger-line)}.KApx_W_btnDanger:hover{background:var(--danger-fill)}.KApx_W_btnSuccess{color:var(--ok);border-color:var(--ok-line);font-weight:600}.KApx_W_btnSuccess:hover{background:var(--ok-fill)}.KApx_W_btnActive{background:var(--fill-3);border-color:var(--line-strong);font-weight:600}.KApx_W_error{color:var(--danger);font-size:12px}.KApx_W_note,.KApx_W_notExposed,.KApx_W_readOnly{color:var(--muted);font-size:12px}.KApx_W_noteLines{gap:var(--sp-1);color:var(--muted);flex-direction:column;font-size:12px;line-height:1.6;display:flex}.KApx_W_noteLines>div{margin:0}.KApx_W_noteFoot{padding-top:var(--sp-1);border-top:1px solid var(--line)}.KApx_W_noteLines code{border-radius:var(--r-sm);background:var(--fill-2);padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.KApx_W_disabledBanner{padding:var(--sp-2) var(--sp-3);border:1px solid var(--danger-line);border-radius:var(--r-md);background:var(--danger-fill);color:var(--danger);margin:0;font-size:12px}.KApx_W_storeNote{padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1)}.KApx_W_collapsible{border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);overflow:hidden}.KApx_W_collapsibleHead{align-items:center;gap:var(--sp-2);box-sizing:border-box;width:100%;padding:var(--sp-2) var(--sp-3);color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;font-size:12px;display:flex}.KApx_W_collapsibleHead:hover{background:var(--fill-2)}.KApx_W_collapsibleHead:focus-visible{box-shadow:var(--focus);outline:none}.KApx_W_collapsibleChev{width:12px;color:var(--muted);flex:none;font-size:10px}.KApx_W_collapsibleLabel{overflow-wrap:anywhere;flex:auto;min-width:0;font-weight:600}.KApx_W_collapsibleAction{color:var(--muted);flex:none;font-size:11px}.KApx_W_collapsibleBody{gap:var(--sp-1);padding:0 var(--sp-3) var(--sp-2) calc(var(--sp-3) + 18px);color:var(--muted);flex-direction:column;font-size:12px;line-height:1.5;display:flex}.KApx_W_collapsibleBody code{border-radius:var(--r-sm);background:var(--fill-2);padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.KApx_W_pathList{gap:var(--sp-1);padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-2);user-select:all;overflow-wrap:anywhere;flex-direction:column;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;display:flex}.KApx_W_pathMain{font-weight:600}.KApx_W_pathSub{color:var(--muted)}.KApx_W_descWrap{color:var(--muted);overflow-wrap:anywhere;word-break:break-word;min-width:0;font-size:12px;line-height:1.6}.KApx_W_empty,.KApx_W_loading{justify-content:center;align-items:center;gap:var(--sp-1);padding:28px var(--sp-4);border:1px dashed var(--line);border-radius:var(--r-md);color:var(--muted);text-align:center;flex-direction:column;font-size:12px;display:flex}.KApx_W_loading{border-style:solid;animation:1.4s ease-in-out infinite KApx_W_pulse}@keyframes KApx_W_pulse{0%,to{opacity:1}50%{opacity:.55}}@media (prefers-reduced-motion:reduce){.KApx_W_loading{animation:none}.KApx_W_switch input,.KApx_W_switch input:after,.KApx_W_tab,.KApx_W_row,.KApx_W_btn,.KApx_W_btnPrimary,.KApx_W_btnDanger,.KApx_W_btnSuccess,.KApx_W_btnActive{transition:none}}.KApx_W_emptyTitle{color:inherit;opacity:.85;font-size:13px;font-weight:600}.KApx_W_emptyHint{max-width:46ch;font-size:12px}.KApx_W_detail{margin:var(--sp-1) 0 0;padding:var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);font-size:12px}.KApx_W_pre{margin:var(--sp-2) 0 0;padding:var(--sp-2);border-radius:var(--r-sm);background:var(--fill-2);white-space:pre-wrap;word-break:break-word;max-height:320px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow:auto}.KApx_W_scanList{gap:var(--sp-2);flex-direction:column;align-items:flex-start;display:flex}.KApx_W_scanList>.KApx_W_row{box-sizing:border-box;width:100%}.KApx_W_input,.KApx_W_inputGrow,.KApx_W_inputMono,.KApx_W_filterSelect{font:inherit;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--fill-1);color:inherit;box-sizing:border-box;padding:6px 8px;font-size:13px;transition:border-color .12s,box-shadow .12s,background .12s}.KApx_W_input,.KApx_W_inputMono{width:100%}.KApx_W_inputGrow{flex:auto;width:auto;min-width:220px}.KApx_W_inputMono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.KApx_W_filterSelect{flex:none;width:auto}.KApx_W_input:hover,.KApx_W_inputGrow:hover,.KApx_W_inputMono:hover,.KApx_W_filterSelect:hover{border-color:#80808080}.KApx_W_input:focus,.KApx_W_inputGrow:focus,.KApx_W_inputMono:focus,.KApx_W_filterSelect:focus{background:var(--fill-2);box-shadow:var(--focus);border-color:#80808099;outline:none}.KApx_W_input::placeholder,.KApx_W_inputGrow::placeholder,.KApx_W_inputMono::placeholder{color:var(--muted);opacity:.75}textarea.KApx_W_input,textarea.KApx_W_inputMono{resize:vertical;min-height:34px}.KApx_W_form{gap:var(--sp-3);flex-direction:column;display:flex}.KApx_W_fieldLabel{gap:var(--sp-1);flex-direction:column;display:flex}.KApx_W_fieldName{color:var(--muted);font-size:12px}@media (width<=720px){.KApx_W_row{flex-wrap:wrap}.KApx_W_inputGrow{min-width:100%}.KApx_W_tabs{scrollbar-width:thin;overflow-x:auto}.KApx_W_tab,.KApx_W_tabActive{padding:var(--sp-2) var(--sp-3)}}";
		const tagId = "dsh-s-m-c-center/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-s-m-c-center";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "KApx_W_badge",
			"btn": "KApx_W_btn",
			"btnActive": "KApx_W_btnActive",
			"btnDanger": "KApx_W_btnDanger",
			"btnPrimary": "KApx_W_btnPrimary",
			"btnSuccess": "KApx_W_btnSuccess",
			"collapsible": "KApx_W_collapsible",
			"collapsibleAction": "KApx_W_collapsibleAction",
			"collapsibleBody": "KApx_W_collapsibleBody",
			"collapsibleChev": "KApx_W_collapsibleChev",
			"collapsibleHead": "KApx_W_collapsibleHead",
			"collapsibleLabel": "KApx_W_collapsibleLabel",
			"desc": "KApx_W_desc",
			"descWrap": "KApx_W_descWrap",
			"detail": "KApx_W_detail",
			"disabledBanner": "KApx_W_disabledBanner",
			"docH1": "KApx_W_docH1",
			"empty": "KApx_W_empty",
			"emptyHint": "KApx_W_emptyHint",
			"emptyTitle": "KApx_W_emptyTitle",
			"error": "KApx_W_error",
			"fieldLabel": "KApx_W_fieldLabel",
			"fieldName": "KApx_W_fieldName",
			"filterSelect": "KApx_W_filterSelect",
			"form": "KApx_W_form",
			"groupH": "KApx_W_groupH",
			"h": "KApx_W_h",
			"hGrow": "KApx_W_hGrow",
			"inline": "KApx_W_inline",
			"input": "KApx_W_input",
			"inputGrow": "KApx_W_inputGrow",
			"inputMono": "KApx_W_inputMono",
			"loading": "KApx_W_loading",
			"main": "KApx_W_main",
			"manager": "KApx_W_manager",
			"name": "KApx_W_name",
			"nameText": "KApx_W_nameText",
			"notExposed": "KApx_W_notExposed",
			"note": "KApx_W_note",
			"noteFoot": "KApx_W_noteFoot",
			"noteLines": "KApx_W_noteLines",
			"pageHeading": "KApx_W_pageHeading",
			"pageIntro": "KApx_W_pageIntro",
			"panel": "KApx_W_panel",
			"pathList": "KApx_W_pathList",
			"pathMain": "KApx_W_pathMain",
			"pathSub": "KApx_W_pathSub",
			"pre": "KApx_W_pre",
			"pulse": "KApx_W_pulse",
			"readOnly": "KApx_W_readOnly",
			"row": "KApx_W_row",
			"scanList": "KApx_W_scanList",
			"section": "KApx_W_section",
			"sectionPage": "KApx_W_sectionPage",
			"status": "KApx_W_status",
			"storeNote": "KApx_W_storeNote",
			"switch": "KApx_W_switch",
			"tab": "KApx_W_tab",
			"tabActive": "KApx_W_tabActive",
			"tabs": "KApx_W_tabs"
		};
		//#endregion
		//#region src/client/components/ui/index.tsx
		/**
		* Primitive UI atoms shared by the three panels.
		*
		* These are deliberately dumb: no API access, no data fetching, no knowledge of
		* skills/MCP/CLI. They exist so the panels stay declarative and the class-name
		* vocabulary lives in exactly one place per widget.
		*/
		/** A single styled button; `type=button` so it never submits a form. */
		function Button({ children, onClick, disabled, variant = "default", title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: variant === "primary" ? settings_card_module_css_default.btnPrimary : variant === "danger" ? settings_card_module_css_default.btnDanger : variant === "active" ? settings_card_module_css_default.btnActive : variant === "success" ? settings_card_module_css_default.btnSuccess : settings_card_module_css_default.btn,
				onClick,
				disabled,
				title,
				children
			});
		}
		/** A labelled form row (label wraps the control so clicks focus it). */
		function Field({ label, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: settings_card_module_css_default.fieldLabel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.fieldName,
					children: label
				}), children]
			});
		}
		/** A read-only `label: value` row used by the CLI probe detail pane. */
		function StateRow({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.inline,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.desc,
					style: { minWidth: 92 },
					children: [label, ":"]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.desc,
					children: value || "—"
				})]
			});
		}
		/** Checkbox styled as a toggle switch. */
		function Switch({ checked, onChange, disabled, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: settings_card_module_css_default.switch,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					disabled,
					onChange,
					role: "switch"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		/** Small pill for source labels and subcommand chips. */
		function Badge({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: settings_card_module_css_default.badge,
				children
			});
		}
		/** Placeholder shown when a list has no rows. */
		function EmptyState({ title, hint }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.empty,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.emptyTitle,
					children: title
				}), hint ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.emptyHint,
					children: hint
				}) : null]
			});
		}
		/** Inline failure message. */
		function ErrorText({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.error,
				children
			});
		}
		/** Inline loading placeholder. `t` keeps the copy in the plugin dictionary. */
		function Loading({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.loading,
				children: t("loading")
			});
		}
		//#endregion
		//#region src/client/utils/format.ts
		/**
		* Pure formatting helpers for the manager UI. No React, no framework imports —
		* everything here is a plain function so it can be unit-tested in isolation.
		*/
		/** Human label for a skill source id (the host reports stable ids, not paths). */
		function sourceLabel(source) {
			if (source === "project-dsh") return ".dsh/skills";
			if (source === "project-agents") return ".agents/skills";
			if (source === "user-dsh") return "~/.dsh/skills";
			if (source === "user-agents") return "~/.agents/skills";
			return source;
		}
		/** Parse `KEY=VALUE` lines into an object (blank/malformed lines are dropped). */
		function parseKv(text) {
			const obj = {};
			if (!text) return obj;
			for (const line of text.split(/\n/)) {
				const t = line.trim();
				if (!t) continue;
				const i = t.indexOf("=");
				if (i < 0) continue;
				obj[t.slice(0, i).trim()] = t.slice(i + 1).trim();
			}
			return obj;
		}
		/** Render an object as `KEY=VALUE` lines (inverse of {@link parseKv}). */
		function kvText(obj) {
			return Object.keys(obj || {}).map((k) => k + "=" + (obj || {})[k]).join("\n");
		}
		/**
		* Fill `{name}` placeholders in a translated string.
		*
		* Copy carries placeholders (never positional concatenation) so each language
		* keeps its own word order — `{n} 条已归档` versus `{n} of them are archived`.
		* An unknown key is left verbatim rather than blanked, so a missing value is
		* visible instead of silently swallowing a word.
		*/
		function format(tpl, vars) {
			return tpl.replace(/\{(\w+)\}/g, (whole, key) => Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
		}
		/** Normalise an unknown thrown value into a display string. */
		function errorText(e) {
			return String(e?.message || e);
		}
		/** Strip a lower-cased query down for case-insensitive matching. */
		function normalizeQuery(query) {
			return query.trim().toLowerCase();
		}
		//#endregion
		//#region src/client/components/SkillsPanel.tsx
		/**
		* Skills tab view, split into two sub-pages — one per axis.
		*
		* Both sub-pages list every skill; they differ only in which axis the row's
		* switch drives:
		*
		* - 「就地管理」 is the **1/2 axis**: whether the skill is injected into the
		*   agent context, stored as a SKILL.md frontmatter marker (the upstream
		*   approach). Available whenever the skill is reachable — it is unmanaged (its
		*   file already sits in a scanned root) or the A link exists. When the link is
		*   gone (B), the row is locked to 2 (disabled).
		* - 「储存库」 is the **A/B axis**: whether a link to the canonical copy sits in
		*   the skill root. Turning A on for an unmanaged skill adopts it into the
		*   store first; turning it off (B) removes the link and leaves the copy in the
		*   store.
		*
		* The axes do not conflict — the link decides reachability, the frontmatter
		* decides injection — they only compose: A ∧ 1 injects, A ∧ 2 does not, B is
		* locked to 2.
		*
		* Pure presentation over {@link useSkills}: it owns no state beyond the active
		* sub-page and never calls the API directly.
		*/
		/** Skills tab. */
		function SkillsPanel({ skills, t }) {
			const { store } = skills;
			const [sub, setSub] = (0, react.useState)("inplace");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.tabs,
					role: "tablist",
					children: ["inplace", "store"].map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": sub === id,
						className: sub === id ? settings_card_module_css_default.tabActive : settings_card_module_css_default.tab,
						onClick: () => {
							setSub(id);
						},
						children: t(id === "inplace" ? "skillsTabInPlace" : "skillsTabStore")
					}, id))
				}), sub === "inplace" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("inPlaceNote")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.hGrow,
								children: t("skillList")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								onClick: skills.reload,
								disabled: skills.refreshing,
								children: t("refresh")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toolbar, {
							skills,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Messages, { skills }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillList, {
							skills,
							sub: "inplace",
							t
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						store !== null && store.migrated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.storeNote,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.noteLines,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: format(t("storeMigrated"), { root: store.root || store.dir }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [format(t("storeCount"), {
									count: store.count,
									enabled: store.enabled
								}), store.failures.length > 0 ? format(t("storeFailures"), { n: store.failures.length }) : ""] })]
							})
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("storePageNote")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImportSection, {
							skills,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.inline,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.hGrow,
								children: t("skillList")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toolbar, {
							skills,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Messages, { skills }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillList, {
							skills,
							sub: "store",
							t
						})
					]
				})]
			});
		}
		/** Search box + enabled filter, shared by both sub-pages. */
		function Toolbar({ skills, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.inline,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: settings_card_module_css_default.inputGrow,
					placeholder: t("phSearchSkill"),
					value: skills.query,
					onChange: (e) => {
						skills.setQuery(e.target.value);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: settings_card_module_css_default.filterSelect,
					value: skills.enabledFilter,
					onChange: (e) => {
						skills.setEnabledFilter(e.target.value);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "all",
							children: t("filterAll")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "enabled",
							children: t("filterEnabled")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "disabled",
							children: t("filterDisabled")
						})
					]
				})]
			});
		}
		/** Errors and transient action feedback. */
		function Messages({ skills }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [skills.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: skills.message }) : null, skills.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: skills.error }) : null] });
		}
		/** Scan-a-directory import; lives on the store sub-page (importing is adoption). */
		function ImportSection({ skills, t }) {
			const scan = skills.scan;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.inline,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.hGrow,
						children: t("importSkill")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.inline,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: settings_card_module_css_default.inputGrow,
							placeholder: t("phImportDir"),
							value: scan.dir,
							onChange: (e) => {
								skills.setScanDir(e.target.value);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							onClick: skills.chooseDir,
							children: t("chooseFolder")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: scan.busy,
							onClick: skills.doScan,
							children: scan.busy ? t("scanning") : t("scanDir")
						})
					]
				}),
				scan.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: scan.error }) : null,
				scan.items.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.scanList,
					children: [scan.items.map((it) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: settings_card_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: !!scan.selected[it.sourcePath],
							onChange: () => {
								skills.toggleSelect(it.sourcePath);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.main,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.name,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: settings_card_module_css_default.nameText,
									children: [it.name, it.kind === "bundle" ? t("suffixDir") : t("suffixFile")]
								})
							}), it.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.desc,
								children: it.description
							}) : null]
						})]
					}, it.sourcePath)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						disabled: scan.busy,
						onClick: skills.doImport,
						children: format(t("importSelected"), { n: Object.keys(scan.selected).length })
					})]
				}) : null,
				scan.note ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.note,
					children: scan.note
				}) : null
			] });
		}
		/** Grouped list of every skill, with the shared loading / empty states. */
		function SkillList({ skills, sub, t }) {
			if (skills.loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t });
			if (skills.groups.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: skills.query !== "" ? t("emptySkillMatch") : t("emptySkills") });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: skills.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.groupH,
				children: [
					group.label,
					" (",
					group.items.length,
					")"
				]
			}), group.items.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillRow, {
				skill,
				skills,
				sub,
				t
			}, skill.path))] }, group.level)) });
		}
		/** One row; the switch drives whichever axis the active sub-page owns. */
		function SkillRow({ skill, skills, sub, t }) {
			const isBusy = skills.busyPath === skill.path;
			const isOpen = skills.detailPath === skill.path;
			const lockedOff = sub === "inplace" && skill.managed && !skill.linked;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.row,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.main,
						style: { cursor: "pointer" },
						onClick: () => {
							skills.view(skill);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.name,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: settings_card_module_css_default.nameText,
								children: [skill.name, skill.enabled ? "" : t("suffixNotEnabled")]
							})
						}), skill.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.desc,
							children: skill.description
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: sourceLabel(skill.source) }),
					sub === "inplace" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
						checked: !lockedOff && skill.enabled,
						disabled: isBusy || lockedOff,
						onChange: () => {
							skills.toggle(skill);
						},
						label: lockedOff ? t("switchLocked") : skill.enabled ? t("switchEnable") : t("switchDisable")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
						checked: skill.managed && skill.linked,
						disabled: isBusy || !skill.managed,
						onChange: () => {
							skills.toggleLink(skill);
						},
						label: !skill.managed ? t("linkNone") : skill.linked ? t("linkOn") : t("linkOff")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						onClick: () => {
							skills.view(skill);
						},
						children: isOpen ? t("collapse") : t("details")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						variant: "danger",
						disabled: isBusy,
						onClick: () => {
							skills.remove(skill);
						},
						children: skills.confirmPath === skill.path ? t("confirmDelete") : t("delete")
					})
				]
			}), isOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillDetail, {
				detail: skills.detail,
				path: skill.path,
				fallback: skill.description,
				t
			}) : null] });
		}
		/** Expanded SKILL.md preview for one row. */
		function SkillDetail({ detail, path, fallback, t }) {
			const d = detail && detail.path === path ? detail.data : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: d === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") }) : d && d.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: d.error }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.name,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.nameText,
							children: d.description || fallback
						})
					}),
					d.whenToUse ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.desc,
						children: [
							t("detailWhenToUse"),
							": ",
							d.whenToUse
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: settings_card_module_css_default.pre,
						children: d.content || ""
					})
				] })
			});
		}
		//#endregion
		//#region src/client/utils/constants.ts
		/** Fresh editor state — a new object per call so callers never share it. */
		function emptyMcpForm() {
			return {
				name: "",
				transport: "stdio",
				command: "",
				args: "",
				env: "",
				cwd: "",
				url: "",
				headers: "",
				mode: "form",
				json: ""
			};
		}
		/** The four management surfaces, in tab order. */
		const TABS = [
			"skills",
			"mcp",
			"cli",
			"guide"
		];
		/** Tab captions as locale keys (bilingual through the plugin's dictionary). */
		const TAB_LABELS = {
			skills: "tabSkills",
			mcp: "tabMcp",
			cli: "tabCli",
			guide: "tabGuide"
		};
		/** MCP server runtime status → locale key. */
		const MCP_STATUS_LABEL = {
			connecting: "stConnecting",
			running: "stRunning",
			failed: "stFailed",
			stopped: "stStopped"
		};
		/**
		* The two states of a local CLI's announcement switch.
		*
		* A CLI is installed and run by the system — this plugin can neither start nor
		* stop it. The switch therefore controls exactly one thing: whether the CLI is
		* listed in the announcement handed to every agent (公告), or left out of it
		* (隐藏). Distinct from the plugin's own 「向 AI 公告」 switch, which announces
		* the plugin's capabilities rather than one tool.
		*/
		const CLI_ANNOUNCE = {
			on: "cliAdvertised",
			off: "cliHidden"
		};
		/** Locale key for a CLI's announcement flag; absent or unrecognized → 隐藏. */
		function cliAnnounceLabel(advertised) {
			return advertised ? CLI_ANNOUNCE.on : CLI_ANNOUNCE.off;
		}
		/**
		* The two states of an MCP server's availability switch.
		*
		* Same vocabulary as {@link CLI_ANNOUNCE}: 激活 means the definition lives in
		* ~/.dsh/S-M-C/mcp.json and is really connected; 归档 means it was moved to
		* ~/.dsh/S-M-C/mcp-archive.json, so it is never connected and never announced.
		* The definition itself is preserved either way — archiving is not deleting.
		*/
		const MCP_ACTIVE = {
			active: "activate",
			archived: "archive"
		};
		/** Locale key for an MCP row's switch; a non-active row reads 归档. */
		function mcpActiveLabel(enabled) {
			return enabled ? MCP_ACTIVE.active : MCP_ACTIVE.archived;
		}
		//#endregion
		//#region src/client/components/McpPanel.tsx
		/**
		* MCP tab view, split into two sub-pages.
		*
		* 「管理」 is the list: one switch per row (激活 / 归档) plus delete — editing an
		* existing definition is deliberately not offered yet, so the row stays a
		* single decision. 「新建」 is the form / JSON editor that creates a definition.
		*
		* Presentation over {@link UseMcp}: the editor's mode toggle and the connect
		* test both live in the hook, so this file stays declarative.
		*/
		/** MCP tab. */
		function McpPanel({ mcp, t }) {
			const { form, patchForm } = mcp;
			const [sub, setSub] = (0, react.useState)("manage");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.tabs,
					role: "tablist",
					children: ["manage", "create"].map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": sub === id,
						className: sub === id ? settings_card_module_css_default.tabActive : settings_card_module_css_default.tab,
						onClick: () => {
							setSub(id);
						},
						children: t(id === "manage" ? "mcpTabManage" : "mcpTabCreate")
					}, id))
				}), sub === "manage" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: settings_card_module_css_default.hGrow,
									children: t("panelMcp")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: settings_card_module_css_default.inputGrow,
									placeholder: t("phSearchServer"),
									value: mcp.query,
									onChange: (e) => {
										mcp.setQuery(e.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									onClick: mcp.reload,
									disabled: mcp.refreshing,
									children: t("refresh")
								})
							]
						}),
						mcp.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: mcp.message }) : null,
						mcp.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: mcp.error }) : null,
						mcp.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t }) : mcp.servers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: mcp.total === 0 ? t("emptyMcp") : t("emptyMcpMatch") }) : mcp.servers.map((s) => {
							const statusKey = MCP_STATUS_LABEL[s.status];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.main,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: settings_card_module_css_default.name,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: settings_card_module_css_default.nameText,
														children: [s.name, s.archived ? t("suffixArchived") : ""]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: settings_card_module_css_default.status,
														children: s.archived ? t("stNotConnected") : statusKey ? t(statusKey) : s.status
													}),
													s.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: t("badgeArchive") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: t("badgeActive") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: settings_card_module_css_default.desc,
												children: [s.transport, s.transport === "stdio" ? " · " + (s.command || "") : " · " + (s.url || "")]
											}),
											s.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: s.error }) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: s.enabled,
										onChange: () => {
											mcp.toggle(s);
										},
										label: t(mcpActiveLabel(s.enabled))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										variant: "danger",
										onClick: () => {
											mcp.remove(s);
										},
										children: mcp.confirmName === s.name ? t("confirmDelete") : t("delete")
									})
								]
							}, s.name);
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.h,
							children: t("newServer")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: form.mode === "form" ? "active" : "default",
								onClick: () => {
									patchForm({ mode: "form" });
								},
								children: t("modeForm")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: form.mode === "json" ? "active" : "default",
								onClick: () => {
									patchForm({ mode: "json" });
								},
								children: t("modeJson")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.form,
							children: form.mode === "form" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldName"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: settings_card_module_css_default.input,
										value: form.name,
										placeholder: t("phServerName"),
										onChange: (e) => {
											patchForm({ name: e.target.value });
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldTransport"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: settings_card_module_css_default.input,
										value: form.transport,
										onChange: (e) => {
											patchForm({ transport: e.target.value });
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "stdio",
											children: "stdio"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "streamable-http",
											children: "streamable-http"
										})]
									})
								}),
								form.transport === "stdio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldCommand"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: settings_card_module_css_default.input,
											value: form.command,
											placeholder: "npx",
											onChange: (e) => {
												patchForm({ command: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldArgs"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: settings_card_module_css_default.input,
											rows: 2,
											value: form.args,
											placeholder: "-y\n@modelcontextprotocol/server-github",
											onChange: (e) => {
												patchForm({ args: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldEnv"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: settings_card_module_css_default.input,
											rows: 2,
											value: form.env,
											onChange: (e) => {
												patchForm({ env: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldCwd"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: settings_card_module_css_default.input,
											value: form.cwd,
											onChange: (e) => {
												patchForm({ cwd: e.target.value });
											}
										})
									})
								] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldUrl"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: settings_card_module_css_default.input,
										value: form.url,
										placeholder: "http://localhost:3000/mcp",
										onChange: (e) => {
											patchForm({ url: e.target.value });
										}
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldHeaders"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: settings_card_module_css_default.input,
										rows: 2,
										value: form.headers,
										onChange: (e) => {
											patchForm({ headers: e.target.value });
										}
									})
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: settings_card_module_css_default.inline,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										variant: "primary",
										disabled: mcp.busy === "save",
										onClick: () => {
											mcp.save();
											setSub("manage");
										},
										children: mcp.busy === "save" ? t("saving") : t("save")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										disabled: mcp.busy === "test",
										onClick: mcp.test,
										children: mcp.busy === "test" ? t("testing") : t("testConnect")
									})]
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: settings_card_module_css_default.inputMono,
								rows: 12,
								value: form.json,
								placeholder: "{\n  \"name\": \"github\",\n  \"transport\": \"stdio\",\n  \"command\": \"npx\",\n  \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"],\n  \"enabled\": true\n}",
								onChange: (e) => {
									patchForm({ json: e.target.value });
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "primary",
								disabled: mcp.busy === "save",
								onClick: () => {
									mcp.save();
									setSub("manage");
								},
								children: mcp.busy === "save" ? t("saving") : t("save")
							})] })
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/components/CliPanel.tsx
		/**
		* CLI tab view. Presentation over {@link useCli}; the probe result pane is
		* folded in as a small local sub-component since it is only used here.
		*/
		/** CLI tab. */
		function CliPanel({ cli, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: settings_card_module_css_default.hGrow,
									children: t("panelCli")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: settings_card_module_css_default.inputGrow,
									placeholder: t("phSearchCli"),
									value: cli.query,
									onChange: (e) => {
										cli.setQuery(e.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									onClick: cli.reload,
									disabled: cli.refreshing,
									children: t("refresh")
								})
							]
						}),
						cli.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: cli.message }) : null,
						cli.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: cli.error }) : null,
						cli.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t }) : cli.entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: cli.total === 0 ? t("emptyCli") : t("emptyCliMatch") }) : cli.entries.map((entry) => {
							const isOpen = cli.detail !== null && cli.detail.name === entry.name;
							const isRegistry = entry.source === "registry";
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.main,
										style: { cursor: "pointer" },
										onClick: () => {
											cli.view(entry.name);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: settings_card_module_css_default.name,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: settings_card_module_css_default.nameText,
												children: [entry.name, entry.enabled ? "" : t("suffixHidden")]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: settings_card_module_css_default.status,
												children: entry.exists ? t("stInstalled") : t("stNotFound")
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: settings_card_module_css_default.desc,
											children: [
												t(entry.source === "skill" ? "cliSkillSource" : "sourceSystem"),
												" · ",
												entry.path || entry.command
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: entry.enabled,
										onChange: () => {
											cli.toggle(entry);
										},
										label: t(cliAnnounceLabel(entry.enabled))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										onClick: () => {
											cli.view(entry.name);
										},
										children: isOpen ? t("collapse") : t("probe")
									}),
									isRegistry ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										variant: "danger",
										onClick: () => {
											cli.remove(entry);
										},
										children: cli.confirmName === entry.name ? t("confirmDelete") : t("delete")
									}) : null
								]
							}), isOpen && cli.detail ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CliDetailPane, {
								detail: cli.detail,
								t
							}) : null] }, entry.name);
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.h,
						children: t("registerCli")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.inline,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: settings_card_module_css_default.inputGrow,
								placeholder: t("phCliName"),
								value: cli.form.name,
								onChange: (e) => {
									cli.setForm((prev) => ({
										...prev,
										name: e.target.value
									}));
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: settings_card_module_css_default.inputGrow,
								placeholder: t("phCliCall"),
								value: cli.form.command,
								onChange: (e) => {
									cli.setForm((prev) => ({
										...prev,
										command: e.target.value
									}));
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "primary",
								onClick: cli.addEntry,
								children: t("add")
							})
						]
					})]
				})]
			});
		}
		/** Expanded probe result for one CLI row. */
		function CliDetailPane({ detail, t }) {
			if (detail.busy) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("probing") })
			});
			if (detail.error) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: detail.error })
			});
			const { state, subcommands } = detail;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowExists"),
						value: state?.exists === false ? t("stNotFound") : t("stInstalled")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowPath"),
						value: state?.path
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowVersion"),
						value: state?.version
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowNeedUpdate"),
						value: state?.needUpdate === true ? t("yesUpdateRecommended") : state?.needUpdate === false ? t("no") : void 0
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowApiKey"),
						value: state?.apiKey?.status ? state.apiKey.status === "configured" ? t("configured") : state.apiKey.status : void 0
					}),
					state?.apiKey?.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowKeyError"),
						value: state.apiKey.error
					}) : null,
					subcommands && subcommands.subcommands.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.inline,
						style: {
							flexWrap: "wrap",
							gap: 6
						},
						children: subcommands.subcommands.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: c }, c))
					}) : null
				] })
			});
		}
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
			/** The A/B axis: create or remove the link to a stored skill's canonical copy. */
			skillLinked: "/api/dsh-s-m-c-center/skills/linked",
			/** Release one stored skill back to the dsh user skills root (store row action). */
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
		//#region src/client/api.ts
		/**
		* Browser-side client for the `/api/dsh-s-m-c-center` route family.
		*
		* The only data path the tabs use: plain `fetch`, same origin, JSON in and
		* out. Every call funnels through {@link call} so the two failure modes a
		* route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
		* — surface the same way, and a failure never arrives as a silent `undefined`.
		*/
		/** Raised for any route call that did not come back as `ok`. */
		var SkillsMcpApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "SkillsMcpApiError";
			}
		};
		/** Turn a response into its payload, or throw the reason it failed. */
		async function unwrap(response) {
			let body;
			try {
				body = await response.json();
			} catch {
				throw new SkillsMcpApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			if (response.ok) return body;
			const reported = body?.error;
			throw new SkillsMcpApiError(typeof reported === "string" ? reported : `HTTP ${response.status}`);
		}
		/**
		* One round trip.
		*
		* Routes split into reads (GET, no body) and actions (POST, JSON body); the
		* action routes that take no arguments still send `{}`, so the content-type
		* header always describes what actually went out.
		*/
		async function call(method, path, payload) {
			return unwrap(await fetch(path, payload === void 0 ? { method } : {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			}));
		}
		/** Append `?cwd=` when a workspace path is known (several routes are scoped). */
		function withCwd(path, cwd) {
			return cwd ? `${path}?cwd=${encodeURIComponent(cwd)}` : path;
		}
		/** `?name=…` plus an optional `&cwd=` for the CLI routes. */
		function withName(path, name, cwd) {
			return path + (`?name=${encodeURIComponent(name)}` + (cwd ? `&cwd=${encodeURIComponent(cwd)}` : ""));
		}
		/** The browser half's only data entry point. */
		var SkillsMcpApi = class {
			async listSkills(cwd) {
				return (await call("GET", withCwd(SMC_API.skills, cwd))).items;
			}
			async readSkill(path) {
				return (await call("POST", SMC_API.skillRead, { path })).skill;
			}
			async toggleSkill(path, enabled) {
				await call("POST", SMC_API.skillToggle, {
					path,
					enabled
				});
			}
			/** The A/B axis: create (adopting first if needed) or remove the link. */
			async setSkillLinked(path, linked) {
				await call("POST", SMC_API.skillLinked, {
					path,
					linked
				});
			}
			async deleteSkill(path, kind) {
				await call("POST", SMC_API.skillDelete, {
					path,
					kind
				});
			}
			async scanSkills(dir) {
				return (await call("POST", SMC_API.skillScan, { dir })).items;
			}
			async importSkills(items) {
				return (await call("POST", SMC_API.skillImport, { items })).results;
			}
			async storeStatus() {
				return (await call("GET", SMC_API.skillStore)).store;
			}
			/** Undo the one-shot migration: every stored skill returns to its origin. */
			async rollbackStore() {
				return (await call("POST", SMC_API.skillRollback, {})).result;
			}
			/** Run the one-shot migration again — the undo for {@link rollbackStore}. */
			async reMigrateStore() {
				return (await call("POST", SMC_API.skillRemigrate, {})).result;
			}
			async listMcp() {
				return (await call("GET", SMC_API.mcp)).servers;
			}
			async saveMcp(server) {
				await call("POST", SMC_API.mcpSave, { server });
			}
			/** Activate (true) or archive (false) one definition. */
			async setMcpEnabled(name, enabled) {
				await call("POST", SMC_API.mcpEnabled, {
					name,
					enabled
				});
			}
			async deleteMcp(name) {
				await call("POST", SMC_API.mcpDelete, { name });
			}
			/** Restore the whole archive at once; returns how many came back. */
			async restoreAllMcp() {
				return (await call("POST", SMC_API.mcpRestoreAll, {})).restored;
			}
			async testMcp(server) {
				return (await call("POST", SMC_API.mcpTest, { server })).test;
			}
			async listCli(cwd) {
				return (await call("GET", withCwd(SMC_API.cli, cwd))).items;
			}
			async cliState(name, cwd) {
				return (await call("GET", withName(SMC_API.cliState, name, cwd))).state;
			}
			async cliSubcommands(name, cwd) {
				return (await call("GET", withName(SMC_API.cliSubcommands, name, cwd))).subcommands;
			}
			async saveCli(entry) {
				await call("POST", SMC_API.cliSave, { entry });
			}
			async setCliEnabled(name, enabled) {
				await call("POST", SMC_API.cliEnabled, {
					name,
					enabled
				});
			}
			async deleteCli(name) {
				await call("POST", SMC_API.cliDelete, { name });
			}
			/** Both probe halves in one round trip (state + subcommands). */
			async probeCli(name, cwd) {
				const body = await call("POST", SMC_API.cliProbe, {
					name,
					cwd
				});
				return {
					state: body.state,
					subcommands: body.subcommands
				};
			}
			async getSettings() {
				return (await call("GET", SMC_API.settings)).settings;
			}
			async saveSettings(settings) {
				return (await call("POST", SMC_API.settingsSave, { settings })).settings;
			}
		};
		//#endregion
		//#region src/client/hooks/useApi.ts
		/**
		* The single owner of the HTTP client instance.
		*
		* Every data-access hook imports the client from here, so exactly one
		* SkillsMcpApi object exists per browser bundle (the old module created it in
		* the component file, which mixed transport concerns into the view layer).
		*/
		/** Stateless fetch client over the /api/dsh-s-m-c-center routes. */
		const api = new SkillsMcpApi();
		//#endregion
		//#region src/client/components/GuidePanel.tsx
		/**
		* Guide tab. Two halves, in this order:
		*
		* 1. How the plugin works — one top-level heading per tool family (skills /
		*    MCP servers / local CLI tools) plus a "where the data lives" section, each
		*    explained by second-level topics. The copy that used to sit on the three
		*    management tabs lives here, so those tabs stay purely operational.
		* 2. Uninstall preparation — the escape hatch itself: give back skills ("撤销
		*    迁移" / "迁移"), inject every archived MCP server back, and list the files
		*    that must be removed by hand.
		*
		* The two heading levels are visually distinct on purpose (`.docH1` for the
		* families, `.groupH` for the topics inside them).
		*
		* Presentation over the skills/mcp hooks the shell already owns: this panel
		* triggers the shared API and asks the shell to bump its refresh counter, so
		* the other tabs stay in step without extra fetching.
		*/
		/** A second-level topic: heading plus its paragraph. */
		function Topic({ h, p }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.groupH,
				children: h
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.descWrap,
				children: p
			})] });
		}
		/** Guide tab. */
		function GuidePanel({ skills, mcp, refresh, t }) {
			const [busy, setBusy] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const store = skills.store;
			const storeRoot = store?.root || "~/.dsh/S-M-C";
			const storeCount = store?.count ?? 0;
			const archivedCount = mcp.servers.filter((s) => s.archived).length;
			const canRollback = storeCount > 0;
			const canMigrate = storeCount === 0 && skills.userUnmanaged > 0;
			const canRestoreMcp = archivedCount > 0;
			const nothingToDo = !canRollback && !canMigrate && !canRestoreMcp;
			const run = (which, action) => {
				setBusy(which);
				setMessage("");
				action().catch((e) => {
					setMessage(errorText(e));
				}).finally(() => {
					setBusy("");
					refresh();
				});
			};
			const doRollback = () => run("rollback", async () => {
				const op = await api.rollbackStore();
				setMessage(op.failures.length === 0 ? format(t("msgRollbackOk"), { moved: op.moved }) : format(t("msgRollbackPartial"), {
					moved: op.moved,
					failed: op.failures.length
				}));
			});
			const doMigrate = () => run("migrate", async () => {
				const op = await api.reMigrateStore();
				setMessage(format(t("msgMigrateDone"), { moved: op.moved }));
			});
			const doRestore = () => run("restore", async () => {
				const restored = await api.restoreAllMcp();
				setMessage(format(t("msgRestoreDone"), { restored }));
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.hGrow,
							children: t("panelGuide")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("guideIntro")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideSkillsH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideStoreH"),
							p: t("guideStoreP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideEnableH"),
							p: t("guideEnableP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideMcpH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideConnectH"),
							p: t("guideConnectP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideArchiveH"),
							p: t("guideArchiveP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideCliH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideDiscoverH"),
							p: t("guideDiscoverP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideAnnounceH"),
							p: t("guideAnnounceP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideDataH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("guideDataP")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("panelUninstall")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallIntro")
						}),
						message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: message }) : null,
						nothingToDo ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: t("uninstallNothing") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.groupH,
								children: t("uninstallSkillsTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: t("uninstallSkillsNote")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.inline,
								children: [canRollback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "danger",
									disabled: busy !== "",
									onClick: doRollback,
									children: busy === "rollback" ? t("rollingBack") : t("rollback")
								}) : null, canMigrate ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "success",
									disabled: busy !== "",
									onClick: doMigrate,
									children: busy === "migrate" ? t("migratingSkills") : t("migrateSkills")
								}) : null]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.groupH,
								children: t("uninstallMcpTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: t("uninstallMcpNote")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.inline,
								children: canRestoreMcp ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "primary",
									disabled: busy !== "",
									onClick: doRestore,
									children: busy === "restore" ? t("restoringMcp") : t("restoreAllMcp")
								}) : null
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.groupH,
							children: t("uninstallFilesTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallFilesNote")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.pathList,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.pathMain,
								children: [storeRoot, store === null ? "" : "/"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.pathSub,
								children: t("uninstallFilesList")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallSettingsPath")
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/hooks/useAsyncList.ts
		/**
		* Generic "fetch a list on mount / on dependency change" hook.
		*
		* All three panels previously hand-rolled the same shape: a `{loading, items,
		* error}` record, a `load()` that resets it, and a useEffect keyed on the
		* current cwd plus a refresh counter. This factors that out once.
		*
		* Two loading notions are kept apart on purpose. A refetch that follows a local
		* action (toggling a switch, deleting a row) must not blank the panel: the list
		* stays on screen and is simply replaced once the fresh payload lands. Only the
		* very first fetch — where there is genuinely nothing to show — reports
		* `loading`, so the panels' loading placeholder never appears mid-session.
		*/
		/**
		* Fetch a list whenever a dependency changes (or `reload()` is called).
		*
		* @param fetcher - Returns the list. Must be stable or declared inline; it is
		*   read through a ref so an inline closure does not retrigger the effect.
		* @param deps - Values whose change should refetch (cwd, refresh counter, …).
		*/
		function useAsyncList(fetcher, deps) {
			const [state, setState] = (0, react.useState)({
				loading: true,
				refreshing: true,
				items: [],
				error: ""
			});
			const fetcherRef = (0, react.useRef)(fetcher);
			fetcherRef.current = fetcher;
			const run = (0, react.useCallback)(() => {
				setState((prev) => ({
					...prev,
					refreshing: true,
					error: ""
				}));
				fetcherRef.current().then((items) => {
					setState({
						loading: false,
						refreshing: false,
						items,
						error: ""
					});
				}).catch((e) => {
					setState((prev) => ({
						loading: false,
						refreshing: false,
						items: prev.items,
						error: errorText(e)
					}));
				});
			}, []);
			(0, react.useEffect)(() => {
				run();
			}, deps);
			const setItems = (0, react.useCallback)((next) => {
				setState((prev) => ({
					...prev,
					items: typeof next === "function" ? next(prev.items) : next
				}));
			}, []);
			return {
				...state,
				reload: run,
				setItems
			};
		}
		//#endregion
		//#region src/client/hooks/useSkills.ts
		/**
		* Skills tab state: the skill list, the detail pane, the scan/import flow and
		* the toolbar filters.
		*
		* The view layer receives ready-to-render values (`filtered`, `groups`) plus
		* the action callbacks; it never touches the API client or the raw fetch shape.
		*/
		/** Group captions as locale keys; the panel resolves them with `t`. */
		const LEVEL_ORDER = [["project", "levelProject"], ["user", "levelUser"]];
		/** Skills tab controller. */
		function useSkills(options) {
			const { cwd, refreshKey, pickDirectory, t } = options;
			const list = useAsyncList(() => api.listSkills(cwd), [cwd, refreshKey]);
			const [query, setQuery] = (0, react.useState)("");
			const [enabledFilter, setEnabledFilter] = (0, react.useState)("all");
			const [busyPath, setBusyPath] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const [confirmPath, setConfirmPath] = (0, react.useState)(null);
			const [detailPath, setDetailPath] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [store, setStore] = (0, react.useState)(null);
			const [scan, setScan] = (0, react.useState)({
				dir: "",
				busy: false,
				items: [],
				selected: {},
				error: "",
				note: ""
			});
			const reloadStore = (0, react.useCallback)(() => {
				api.storeStatus().then(setStore).catch(() => {
					setStore(null);
				});
			}, []);
			const reloadList = list.reload;
			const reloadAll = (0, react.useCallback)(() => {
				reloadList();
				reloadStore();
			}, [reloadList, reloadStore]);
			(0, react.useEffect)(() => {
				reloadStore();
			}, [refreshKey, reloadStore]);
			const toggle = (0, react.useCallback)((skill) => {
				setBusyPath(skill.path);
				setMessage("");
				api.toggleSkill(skill.path, !skill.enabled).then(() => {
					setBusyPath("");
					reloadAll();
				}).catch((e) => {
					setBusyPath("");
					setMessage(errorText(e));
				});
			}, [reloadAll]);
			const toggleLink = (0, react.useCallback)((skill) => {
				setBusyPath(skill.path);
				setMessage("");
				api.setSkillLinked(skill.path, !skill.linked).then(() => {
					setBusyPath("");
					reloadAll();
				}).catch((e) => {
					setBusyPath("");
					setMessage(errorText(e));
				});
			}, [reloadAll]);
			const remove = (0, react.useCallback)((skill) => {
				if (confirmPath !== skill.path) {
					setConfirmPath(skill.path);
					return;
				}
				setConfirmPath(null);
				setBusyPath(skill.path);
				setMessage("");
				api.deleteSkill(skill.path, skill.kind).then(() => {
					setBusyPath("");
					reloadAll();
				}).catch((e) => {
					setBusyPath("");
					setMessage(errorText(e));
				});
			}, [confirmPath, reloadAll]);
			const view = (0, react.useCallback)((skill) => {
				if (detailPath === skill.path) {
					setDetailPath(null);
					setDetail(null);
					return;
				}
				setDetailPath(skill.path);
				setDetail(null);
				api.readSkill(skill.path).then((data) => {
					setDetail({
						path: skill.path,
						data
					});
				}).catch((e) => {
					setDetail({
						path: skill.path,
						data: { error: errorText(e) }
					});
				});
			}, [detailPath]);
			const setScanDir = (0, react.useCallback)((dir) => {
				setScan((prev) => ({
					...prev,
					dir,
					error: ""
				}));
			}, []);
			const chooseDir = (0, react.useCallback)(() => {
				pickDirectory().then((path) => {
					if (path) setScan((prev) => ({
						...prev,
						dir: path,
						error: ""
					}));
				}).catch((e) => {
					setScan((prev) => ({
						...prev,
						error: errorText(e)
					}));
				});
			}, [pickDirectory]);
			const doScan = (0, react.useCallback)(() => {
				setScan((prev) => {
					const dir = prev.dir.trim();
					if (!dir) return {
						...prev,
						error: t("msgEnterDir")
					};
					api.scanSkills(dir).then((items) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							items,
							selected: {},
							note: items.length === 0 ? t("msgNoImportable") : ""
						}));
					}).catch((e) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							items: [],
							error: errorText(e)
						}));
					});
					return {
						...prev,
						busy: true,
						items: [],
						error: "",
						note: ""
					};
				});
			}, [t]);
			const toggleSelect = (0, react.useCallback)((sourcePath) => {
				setScan((prev) => {
					const selected = { ...prev.selected };
					if (selected[sourcePath]) delete selected[sourcePath];
					else selected[sourcePath] = true;
					return {
						...prev,
						selected
					};
				});
			}, []);
			const doImport = (0, react.useCallback)(() => {
				setScan((prev) => {
					const chosen = prev.items.filter((it) => prev.selected[it.sourcePath]);
					if (chosen.length === 0) return {
						...prev,
						error: t("msgSelectFirst")
					};
					api.importSkills(chosen.map((it) => ({
						sourcePath: it.sourcePath,
						kind: it.kind
					}))).then((results) => {
						const imported = results.filter((x) => x.ok).length;
						setScan((cur) => ({
							...cur,
							busy: false,
							selected: {},
							note: format(t("msgImported"), { n: imported })
						}));
						reloadAll();
					}).catch((e) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							error: errorText(e)
						}));
					});
					return {
						...prev,
						busy: true,
						error: ""
					};
				});
			}, [reloadAll, t]);
			const adoptOne = (0, react.useCallback)((skill) => {
				setBusyPath(skill.path);
				setMessage("");
				const sourcePath = skill.kind === "bundle" ? skill.path.replace(/[\\/]+SKILL\.md$/i, "") : skill.path;
				api.importSkills([{
					sourcePath,
					kind: skill.kind
				}]).then((results) => {
					setBusyPath("");
					const first = results[0];
					setMessage(first?.ok ? format(t("msgAdopted"), { name: skill.name }) : errorText(first?.reason ?? "adopt failed"));
					reloadAll();
				}).catch((e) => {
					setBusyPath("");
					setMessage(errorText(e));
				});
			}, [reloadAll, t]);
			const filtered = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((it) => {
					if (q !== "" && !it.name.toLowerCase().includes(q)) return false;
					if (enabledFilter === "enabled" && !it.enabled) return false;
					if (enabledFilter === "disabled" && it.enabled) return false;
					return true;
				});
			}, [
				list.items,
				query,
				enabledFilter
			]);
			const groups = (0, react.useMemo)(() => {
				const byLevel = {};
				for (const it of filtered) (byLevel[it.level] = byLevel[it.level] || []).push(it);
				return LEVEL_ORDER.map(([level, label]) => ({
					level,
					label: t(label),
					items: byLevel[level] || []
				})).filter((g) => g.items.length > 0);
			}, [filtered, t]);
			const userUnmanaged = (0, react.useMemo)(() => list.items.filter((it) => it.level === "user" && !it.managed).length, [list.items]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				filtered,
				groups,
				total: list.items.length,
				userUnmanaged,
				reload: reloadAll,
				query,
				setQuery,
				enabledFilter,
				setEnabledFilter,
				busyPath,
				message,
				toggle,
				toggleLink,
				adoptOne,
				remove,
				confirmPath,
				detailPath,
				detail,
				view,
				store,
				scan,
				setScanDir,
				chooseDir,
				doScan,
				toggleSelect,
				doImport
			};
		}
		//#endregion
		//#region src/client/hooks/useMcp.ts
		/**
		* MCP tab state: the server list, the create/edit editor (form + JSON modes)
		* and the connect-test action.
		*/
		/** MCP tab controller. */
		function useMcp(options) {
			const { refreshKey, t } = options;
			const list = useAsyncList(() => api.listMcp(), [refreshKey]);
			const [form, setForm] = (0, react.useState)(emptyMcpForm);
			const [busy, setBusy] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const [confirmName, setConfirmName] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const patchForm = (0, react.useCallback)((p) => {
				setForm((prev) => ({
					...prev,
					...p
				}));
			}, []);
			const buildServer = (0, react.useCallback)(() => {
				if (form.mode === "json") try {
					return JSON.parse(form.json);
				} catch (e) {
					setMessage(format(t("msgJsonFailed"), { error: errorText(e) }));
					return null;
				}
				const server = {
					name: form.name.trim(),
					transport: form.transport,
					enabled: true
				};
				if (form.transport === "stdio") {
					server.command = form.command.trim();
					server.args = form.args.split(/\n/).map((l) => l.trim()).filter((l) => l !== "");
					server.cwd = form.cwd.trim();
					server.env = parseKv(form.env);
				} else {
					server.url = form.url.trim();
					server.headers = parseKv(form.headers);
				}
				return server;
			}, [form, t]);
			const save = (0, react.useCallback)(() => {
				const server = buildServer();
				if (!server) return;
				setBusy("save");
				setMessage("");
				api.saveMcp(server).then(() => {
					setBusy("");
					setMessage(format(t("msgSaved"), { name: server.name }));
					setForm(emptyMcpForm());
					list.reload();
				}).catch((e) => {
					setBusy("");
					setMessage(errorText(e));
				});
			}, [
				buildServer,
				list,
				t
			]);
			const test = (0, react.useCallback)(() => {
				const server = buildServer();
				if (!server) return;
				setBusy("test");
				setMessage("");
				api.testMcp(server).then((r) => {
					setBusy("");
					setMessage(r.ok ? t("msgConnectOk") : format(t("msgConnectFailed"), { error: r.error || "unknown error" }));
				}).catch((e) => {
					setBusy("");
					setMessage(errorText(e));
				});
			}, [buildServer, t]);
			const toggle = (0, react.useCallback)((s) => {
				const next = !s.enabled;
				setMessage("");
				const flip = (enabled) => (items) => items.map((it) => it.name === s.name ? {
					...it,
					enabled
				} : it);
				list.setItems(flip(next));
				api.setMcpEnabled(s.name, next).then(() => {
					setMessage(format(next ? t("msgActivated") : t("msgArchived"), { name: s.name }));
					list.reload();
				}).catch((e) => {
					list.setItems(flip(s.enabled));
					setMessage(errorText(e));
				});
			}, [list, t]);
			const remove = (0, react.useCallback)((s) => {
				if (confirmName !== s.name) {
					setConfirmName(s.name);
					return;
				}
				setConfirmName(null);
				setMessage("");
				api.deleteMcp(s.name).then(() => {
					list.reload();
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [confirmName, list]);
			const edit = (0, react.useCallback)((s) => {
				setForm({
					name: s.name,
					transport: s.transport || "stdio",
					command: s.command || "",
					args: (s.args || []).join("\n"),
					env: kvText(s.env),
					cwd: s.cwd || "",
					url: s.url || "",
					headers: kvText(s.headers),
					mode: "form",
					json: JSON.stringify(s, null, 2)
				});
				setConfirmName(null);
			}, []);
			const servers = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((s) => q === "" || s.name.toLowerCase().includes(q));
			}, [list.items, query]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				servers,
				total: list.items.length,
				reload: list.reload,
				query,
				setQuery,
				message,
				form,
				patchForm,
				busy,
				save,
				test,
				toggle,
				remove,
				edit,
				confirmName
			};
		}
		//#endregion
		//#region src/client/hooks/useCli.ts
		/**
		* CLI tab state: the discovered/registered CLI list, the on-demand probe
		* (existence / version / subcommands) and the registry add/remove flow.
		*/
		/** CLI tab controller. */
		function useCli(options) {
			const { cwd, refreshKey, t } = options;
			const list = useAsyncList(() => api.listCli(cwd), [cwd, refreshKey]);
			const [form, setForm] = (0, react.useState)({
				name: "",
				command: ""
			});
			const [detail, setDetail] = (0, react.useState)(null);
			const [message, setMessage] = (0, react.useState)("");
			const [confirmName, setConfirmName] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const probe = (0, react.useCallback)((name) => {
				setDetail((prev) => ({
					name,
					busy: true,
					error: "",
					...prev && prev.name === name ? prev : {}
				}));
				api.probeCli(name, cwd).then((r) => {
					setDetail({
						name,
						state: r.state,
						subcommands: r.subcommands,
						busy: false,
						error: ""
					});
				}).catch((e) => {
					setDetail({
						name,
						busy: false,
						error: errorText(e)
					});
				});
			}, [cwd]);
			const view = (0, react.useCallback)((name) => {
				if (detail && detail.name === name) {
					setDetail(null);
					return;
				}
				probe(name);
			}, [detail, probe]);
			const toggle = (0, react.useCallback)((entry) => {
				setMessage("");
				const flip = (enabled) => (items) => items.map((it) => it.name === entry.name ? {
					...it,
					enabled
				} : it);
				list.setItems(flip(!entry.enabled));
				api.setCliEnabled(entry.name, !entry.enabled).then(() => {
					list.reload();
				}).catch((e) => {
					list.setItems(flip(entry.enabled));
					setMessage(errorText(e));
				});
			}, [list]);
			const remove = (0, react.useCallback)((entry) => {
				if (entry.source !== "registry") return;
				if (confirmName !== entry.name) {
					setConfirmName(entry.name);
					return;
				}
				setConfirmName(null);
				setMessage("");
				api.deleteCli(entry.name).then(() => {
					list.reload();
					setDetail(null);
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [confirmName, list]);
			const addEntry = (0, react.useCallback)(() => {
				const name = form.name.trim();
				const command = form.command.trim() || name;
				if (!name) {
					setMessage(t("msgEnterCliName"));
					return;
				}
				setMessage("");
				api.saveCli({
					name,
					command,
					enabled: true
				}).then(() => {
					setForm({
						name: "",
						command: ""
					});
					list.reload();
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [
				form,
				list,
				t
			]);
			const entries = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((it) => q === "" || it.name.toLowerCase().includes(q) || (it.skill || "").toLowerCase().includes(q));
			}, [list.items, query]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				entries,
				total: list.items.length,
				reload: list.reload,
				query,
				setQuery,
				message,
				detail,
				view,
				toggle,
				remove,
				confirmName,
				form,
				setForm,
				addEntry
			};
		}
		//#endregion
		//#region src/client/hooks/useManagerSettings.ts
		/**
		* Own-settings state: this plugin's `dsh-s-m-c-center` namespace block in
		* ~/.dsh/settings.yaml.
		*
		* The write path is optimistic-free on purpose: the Host round-trips the
		* persisted record, and the Host side re-applies the system-prompt
		* announcement synchronously, so the returned value is the new truth.
		*/
		/** Read + persist the plugin's own settings block. */
		function useManagerSettings() {
			const [state, setState] = (0, react.useState)({
				loading: true,
				value: null,
				error: "",
				saving: false
			});
			(0, react.useEffect)(() => {
				let alive = true;
				api.getSettings().then((value) => {
					if (alive) setState((prev) => ({
						...prev,
						loading: false,
						value
					}));
				}).catch((e) => {
					if (alive) setState((prev) => ({
						...prev,
						loading: false,
						error: errorText(e)
					}));
				});
				return () => {
					alive = false;
				};
			}, []);
			const { value, saving } = state;
			const toggleAnnounce = (0, react.useCallback)(() => {
				if (!value || saving) return;
				setState((prev) => ({
					...prev,
					saving: true,
					error: ""
				}));
				api.saveSettings({ announceToAgent: !value.announceToAgent }).then((next) => {
					setState({
						loading: false,
						value: next,
						error: "",
						saving: false
					});
				}).catch((e) => {
					setState((prev) => ({
						...prev,
						saving: false,
						error: errorText(e)
					}));
				});
			}, [value, saving]);
			return {
				...state,
				toggleAnnounce
			};
		}
		//#endregion
		//#region src/client/components/ManagerShell.tsx
		/**
		* Top-level manager shell: the announce-to-agent switch, the tab bar and the
		* active panel.
		*
		* The shell owns only navigation state (active tab, cross-tab refresh counter).
		* All data state lives in the per-tab hooks, so switching tabs is cheap and the
		* panels stay independent.
		*/
		/** Skills / MCP / CLI manager root. */
		function ManagerShell({ cwd, enabled, pickDirectory, t }) {
			const [tab, setTab] = (0, react.useState)("skills");
			const [refreshKey, setRefreshKey] = (0, react.useState)(0);
			const bump = (0, react.useCallback)(() => {
				setRefreshKey((k) => k + 1);
			}, []);
			const settings = useManagerSettings();
			const skills = useSkills({
				cwd,
				refreshKey,
				pickDirectory,
				t
			});
			const mcp = useMcp({
				refreshKey,
				t
			});
			const cli = useCli({
				cwd,
				refreshKey,
				t
			});
			const announceOn = settings.value?.announceToAgent ?? false;
			const announceUnavailable = settings.loading || settings.saving || settings.value === null;
			const [notesOpen, setNotesOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.manager,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.section,
						style: { marginBottom: 12 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.inline,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: settings_card_module_css_default.hGrow,
										children: t("announceTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										onClick: () => {
											setNotesOpen((v) => !v);
										},
										children: notesOpen ? t("collapse") : t("expand")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: announceOn,
										disabled: announceUnavailable,
										onChange: settings.toggleAnnounce,
										label: settings.loading ? t("announceReading") : announceOn ? t("announceOnState") : t("announceOffState")
									})
								]
							}),
							notesOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.noteLines,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("announceOnNote") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("announceOffNote") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.noteFoot,
										children: [
											t("persistA"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "dsh-s-m-c-center" }),
											" ",
											t("persistB"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "~/.dsh/settings.yaml" }),
											t("persistC")
										]
									})
								]
							}) : null,
							settings.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: settings.error }) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.tabs,
						role: "tablist",
						children: TABS.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === id,
							className: tab === id ? settings_card_module_css_default.tabActive : settings_card_module_css_default.tab,
							onClick: () => {
								setTab(id);
							},
							children: t(TAB_LABELS[id])
						}, id))
					}),
					enabled ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.disabledBanner,
						role: "status",
						children: t("pluginDisabled")
					}),
					tab === "skills" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsPanel, {
						skills,
						t
					}) : null,
					tab === "mcp" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(McpPanel, {
						mcp,
						t
					}) : null,
					tab === "cli" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CliPanel, {
						cli,
						t
					}) : null,
					tab === "guide" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GuidePanel, {
						skills,
						mcp,
						refresh: bump,
						t
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		/**
		* Render the settings section content.
		* @param props - locale copy, the global useWorkspaces hook, and the picker helper.
		* @returns the section page.
		*/
		function SkillsMcpSection(props) {
			const { t } = props;
			const cwd = props.useWorkspaces((s) => s.items[0]?.path ?? "");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.sectionPage,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: settings_card_module_css_default.pageHeading,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.pageIntro,
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagerShell, {
						cwd,
						enabled: true,
						pickDirectory: props.pickDirectory,
						t
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "dsh-s-m-c-center";
		/** Required services (fiber inject waiting — the runtime must be up first).
		* `settings.section` itself is declared by the settings shell, so mounting
		* only waits on the services this page actually reads. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.directoryPicker"
		];
		/**
		* Mount the settings page.
		* @param ctx - client root context (slots, locale, remote).
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-s-m-c-center: dictionaries");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skills-mcp",
				order: 20,
				label: () => ctx.locale.bind(NS)("title"),
				locale: NS,
				inject: () => ({ pickDirectory: async () => {
					const result = await ctx.remote.directoryPicker.pick();
					if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`);
					return result.value;
				} })
			}, SkillsMcpSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map