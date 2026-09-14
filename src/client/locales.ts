/**
 * Client locale dictionaries for the dsh-s-m-c-center settings card.
 *
 * The whole management surface is translated — nothing in components/ or
 * hooks/ carries inline copy, so an English shell never shows Chinese.
 *
 * Copy that embeds a value (a count, a path, another term) uses `{name}`
 * placeholders rendered through `format()` in utils/format.ts, so each language
 * keeps its own word order.
 */

/** Locale keys this plugin's surface uses. */
export type SkillsMcpKey =
  // card chrome
  | 'title'
  | 'description'
  | 'expand'
  | 'collapse'
  | 'notExposed'
  | 'readOnly'
  | 'unsaved'
  | 'discard'
  | 'save'
  | 'saving'
  | 'saveFailed'
  | 'inherit'
  | 'overridden'
  | 'reset'
  | 'invalid'
  | 'enabled'
  | 'enabledHint'
  | 'announce'
  | 'announceHint'
  | 'on'
  | 'off'
  // tabs + panel headings
  | 'tabSkills'
  | 'tabMcp'
  | 'tabCli'
  | 'tabUninstall'
  | 'panelMcp'
  | 'panelCli'
  | 'panelUninstall'
  | 'sourceSystem'
  | 'skillList'
  | 'importSkill'
  | 'newServer'
  | 'registerCli'
  | 'modeForm'
  | 'modeJson'
  // common actions
  | 'refresh'
  | 'edit'
  | 'delete'
  | 'confirmDelete'
  | 'add'
  | 'testConnect'
  | 'testing'
  | 'loading'
  | 'chooseFolder'
  | 'scanDir'
  | 'scanning'
  | 'importSelected'
  | 'rollback'
  | 'rollingBack'
  | 'probe'
  | 'probing'
  | 'details'
  // announce switch
  | 'announceTitle'
  | 'announceReading'
  | 'announceOnState'
  | 'announceOffState'
  | 'announceOnNote'
  | 'announceOffNote'
  | 'persistA'
  | 'persistB'
  | 'persistC'
  // banners
  | 'pluginDisabled'
  | 'storeMigrated'
  | 'storeMigratedTitle'
  | 'storeMigratedNote'
  | 'storeCount'
  | 'storeFailures'
  // statuses / badges / suffixes
  | 'stConnecting'
  | 'stRunning'
  | 'stFailed'
  | 'stStopped'
  | 'stInstalled'
  | 'stNotFound'
  | 'stNotConnected'
  | 'suffixArchived'
  | 'suffixHidden'
  | 'suffixNotEnabled'
  | 'suffixDir'
  | 'suffixFile'
  | 'badgeStore'
  | 'badgeInPlace'
  | 'badgeArchive'
  | 'badgeActive'
  | 'badgeSkill'
  // the two-state controls
  | 'cliAdvertised'
  | 'cliHidden'
  | 'cliSkillSource'
  | 'cliSkillHint'
  | 'mcpTabManage'
  | 'mcpTabCreate'
  | 'activate'
  | 'archive'
  | 'switchEnable'
  | 'switchDisable'
  // filters + grouping
  | 'filterAll'
  | 'filterEnabled'
  | 'filterDisabled'
  | 'levelProject'
  | 'levelUser'
  // empty states
  | 'emptySkills'
  | 'emptySkillMatch'
  | 'emptyMcp'
  | 'emptyMcpMatch'
  | 'emptyCli'
  | 'emptyCliMatch'
  // placeholders
  | 'phSearchSkill'
  | 'phSearchServer'
  | 'phSearchCli'
  | 'phImportDir'
  | 'phCliName'
  | 'phCliCall'
  | 'phServerName'
  // MCP form fields
  | 'fieldName'
  | 'fieldTransport'
  | 'fieldCommand'
  | 'fieldArgs'
  | 'fieldEnv'
  | 'fieldCwd'
  | 'fieldUrl'
  | 'fieldHeaders'
  // explanatory copy
  | 'cliIntro'
  | 'cliRegisterNote'
  | 'mcpArchiveNote'
  | 'mcpStoreNote'
  // CLI probe pane
  | 'rowExists'
  | 'rowPath'
  | 'rowVersion'
  | 'rowNeedUpdate'
  | 'rowApiKey'
  | 'rowKeyError'
  | 'yesUpdateRecommended'
  | 'no'
  | 'configured'
  // hook messages
  | 'msgEnterCliName'
  | 'msgJsonFailed'
  | 'msgSaved'
  | 'msgConnectOk'
  | 'msgConnectFailed'
  | 'msgActivated'
  | 'msgArchived'
  | 'msgRollbackOk'
  | 'msgRollbackPartial'
  | 'msgEnterDir'
  | 'msgNoImportable'
  | 'msgSelectFirst'
  | 'msgImported'

  // uninstall preparation page
  | 'uninstallIntro'
  | 'uninstallSkillsTitle'
  | 'uninstallSkillsNote'
  | 'uninstallMcpTitle'
  | 'uninstallMcpNote'
  | 'uninstallFilesTitle'
  | 'uninstallFilesNote'
  | 'uninstallFilesList'
  | 'uninstallSettingsPath'
  | 'uninstallNothing'
  | 'migrateSkills'
  | 'migratingSkills'
  | 'restoreAllMcp'
  | 'restoringMcp'
  | 'msgMigrateDone'
  | 'msgRestoreDone'
  // skill detail / CLI source prefixes (avoid inline English in zh runs)
  | 'detailWhenToUse'
  | 'cliSkillPrefix'

/** Translator bound to this plugin's namespace (what `PropsLocale` hands out). */
export type Translate = (key: SkillsMcpKey) => string

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<SkillsMcpKey, string> = {
  title: '工具管理',
  description: '管理技能、MCP 服务器与本地 CLI 工具（MCP 为真实连接）。',
  expand: '展开',
  collapse: '收起',
  notExposed: '当前部署未向此客户端提供该插件的设置命名空间。',
  readOnly: '设置文档为只读，无法保存更改。',
  unsaved: '未保存',
  discard: '放弃更改',
  save: '保存',
  saving: '保存中…',
  saveFailed: '保存未成功，请重试。',
  inherit: '继承',
  overridden: '已覆盖',
  reset: '重置',
  invalid: '输入无效',
  enabled: '启用插件',
  enabledHint: '关闭后，路由与 MCP 连接会全部停止。',
  announce: '向 Agent 公告',
  announceHint: '在系统提示中向每个 Agent 说明本插件的存在与能力。',
  on: '开',
  off: '关',

  tabSkills: 'Skills 技能',
  tabMcp: 'MCP 服务',
  tabCli: 'CLI 工具',
  tabUninstall: '卸载准备',
  panelMcp: 'MCP 服务器',
  panelCli: '本地 CLI 工具',
  panelUninstall: '卸载准备',
  sourceSystem: '系统 CLI',
  skillList: '技能列表',
  importSkill: '导入技能',
  newServer: '新建 / 编辑服务器',
  registerCli: '登记系统 CLI',
  modeForm: '表单',
  modeJson: 'JSON',

  refresh: '刷新',
  edit: '编辑',
  delete: '删除',
  confirmDelete: '再次点击确认删除',
  add: '添加',
  testConnect: '测试连接',
  testing: '测试中…',
  loading: '加载中…',
  chooseFolder: '选择文件夹',
  scanDir: '扫描目录',
  scanning: '扫描中…',
  importSelected: '导入选中 ({n})',
  rollback: '撤销迁移',
  rollingBack: '撤销中…',
  probe: '探测',
  probing: '探测中…',
  details: '详情',

  announceTitle: '向 AI 公告',
  announceReading: '读取中…',
  announceOnState: '已开启',
  announceOffState: '已关闭',
  announceOnNote: '开启后，插件会在每个智能体的系统提示中声明自身能力（技能 / MCP / CLI 管理）。',
  announceOffNote: '关闭后，则完全不向 AI 暴露本插件的存在与能力。',
  persistA: '设置持久化到',
  persistB: '命名空间，写在',
  persistC: '；切换即时生效，无需重启。',

  pluginDisabled: '插件已禁用：路由与 MCP 连接、CLI 探测均已停止，重新启用后刷新即可恢复。',
  storeMigrated: '技能已迁入统一储存库：{root}',
  storeMigratedTitle: '储存库是怎么工作的',
  storeMigratedNote: '正本在储存库的 skills/ 下；启用 = 在对应 skills 目录注入联接；不启用 = 移除联接，AI 完全看不到。SKILL.md 不再被改写。',
  storeCount: '共 {count} 个，已启用 {enabled} 个。',
  storeFailures: ' 有 {n} 个未能迁移，已保留在原位置。',

  stConnecting: '连接中',
  stRunning: '运行中',
  stFailed: '失败',
  stStopped: '已停止',
  stInstalled: '已安装',
  stNotFound: '未找到',
  stNotConnected: '未连接',
  suffixArchived: ' （已归档）',
  suffixHidden: ' （已隐藏）',
  suffixNotEnabled: ' （未启用）',
  suffixDir: ' (目录)',
  suffixFile: ' (文件)',
  badgeStore: '储存器',
  badgeInPlace: '就地管理',
  badgeArchive: '归档库',
  badgeActive: '已启用',
  badgeSkill: 'Skill',

  cliAdvertised: '公告',
  cliHidden: '隐藏',
  cliSkillSource: '技能 CLI',
  cliSkillHint: '随 skills 安装的 CLI（标「技能 CLI」）建议保持隐藏——它们主要供所属 skill 内部调用，公告给 AI 只会撑大系统提示。',
  mcpTabManage: '管理',
  mcpTabCreate: '新建',
  activate: '激活',
  archive: '归档',
  switchEnable: '启用',
  switchDisable: '禁用',

  filterAll: '全部',
  filterEnabled: '已启用',
  filterDisabled: '未启用',
  levelProject: '项目级',
  levelUser: '用户级',

  emptySkills: '没有发现技能',
  emptySkillMatch: '没有匹配的技能',
  emptyMcp: '尚未配置任何 MCP 服务器',
  emptyMcpMatch: '没有匹配的服务器',
  emptyCli: '未发现 CLI 工具',
  emptyCliMatch: '没有匹配的 CLI',

  phSearchSkill: '搜索技能名称…',
  phSearchServer: '搜索服务器名称…',
  phSearchCli: '搜索 CLI 名称…',
  phImportDir: '目录路径（含 SKILL.md 的技能目录或平铺 .md）',
  phCliName: 'CLI 命令名，例如 gh',
  phCliCall: '调用名（可留空，默认同命令名）',
  phServerName: '例如 github',

  fieldName: '名称 name',
  fieldTransport: '传输 transport',
  fieldCommand: '命令 command',
  fieldArgs: '参数 args（每行一个）',
  fieldEnv: '环境变量 env（KEY=VALUE 每行一个）',
  fieldCwd: '工作目录 cwd',
  fieldUrl: 'URL',
  fieldHeaders: '请求头 headers（KEY=VALUE 每行一个）',

  cliIntro: '自动发现 skill 内嵌的 CLI（scripts/run-cli）与系统 CLI（gh/git 等）。来源：skill 上的脚本进行状态探测；系统 CLI 记录在 {store}/cli.json。开关只控制「是否把它写进给 AI 的公告」——CLI 由系统安装，插件无法启停它。',
  cliRegisterNote: '登记后插件会探测其存在、版本与子命令，skill 内嵌 CLI 自动出现，无需手动登记。开关只控制「是否写进给 AI 的公告」，默认隐藏。',
  mcpArchiveNote: '其中 {n} 条已归档，保存在 {store}/mcp-archive.json —— 不会被连接、不会向模型公告，但定义完整保留，随时可以点「{activate}」移回 mcp.json。',
  mcpStoreNote: '{store} 是插件的统一储存库：激活的服务器写在这里的 mcp.json，经 @deepseek-ai/dsh-mcp-client 真实连接并把工具注册为 mcp__<server>__<tool>；归档的定义移到同目录的 mcp-archive.json（不连接、不公告）。保存即为激活：编辑一条已归档的服务器再保存，它会直接回到 mcp.json。',

  rowExists: '存在',
  rowPath: '路径',
  rowVersion: '版本',
  rowNeedUpdate: '需要更新',
  rowApiKey: 'API Key',
  rowKeyError: 'Key 错误',
  yesUpdateRecommended: '是（建议 update）',
  no: '否',
  configured: '已配置',

  msgEnterCliName: '请输入 CLI 命令名',
  msgJsonFailed: 'JSON 解析失败：{error}',
  msgSaved: '已保存 {name}',
  msgConnectOk: '连接成功',
  msgConnectFailed: '连接失败：{error}',
  msgActivated: '已激活 {name}',
  msgArchived: '已归档 {name}',
  msgRollbackOk: '已撤销迁移，恢复 {moved} 个技能到原位置',
  msgRollbackPartial: '恢复 {moved} 个技能，{failed} 个失败',
  msgEnterDir: '请输入目录路径',
  msgNoImportable: '未发现可导入的技能',
  msgSelectFirst: '请先勾选要导入的技能',
  msgImported: '已导入 {n} 个技能',

  detailWhenToUse: '何时使用',
  cliSkillPrefix: '技能',

  uninstallIntro: '准备卸载本插件时，先在这里把托管的数据归还回系统默认位置，再手动删除储存库目录。',
  uninstallSkillsTitle: '技能迁移',
  uninstallSkillsNote: '储存库里有技能时，「撤销迁移」把它们移回原始位置、联接一并移除，agent 看到的技能与迁移前完全一致；储存库空着而 skills 目录里还有技能时，按钮变为「迁移」，可随时把技能重新收进储存库。',
  uninstallMcpTitle: 'MCP 注入',
  uninstallMcpNote: '「MCP 全部注入」把归档的服务器一次性移回 mcp.json 并重新连接。此操作无需撤回：不需要的服务器随时可以在「MCP 服务」页单独停用或删除。',
  uninstallFilesTitle: '需要手动删除的文件',
  uninstallFilesNote: '插件卸载不会清理数据。移除插件后，请手动删除整个储存库目录；删除目录即包含以下全部内容：',
  uninstallFilesList: 'skills/（技能正本）、mcp.json（激活的 MCP 服务器）、mcp-archive.json（归档的 MCP 服务器）、cli.json（CLI 登记表）',
  uninstallSettingsPath: '另外，~/.dsh/settings.yaml 中的 dsh-s-m-c-center 配置块可以一并删掉。',
  uninstallNothing: '储存库中没有技能、skills 目录也没有待迁移的技能，归档里也没有 MCP 服务器——无需任何操作。',
  migrateSkills: '迁移',
  migratingSkills: '迁移中…',
  restoreAllMcp: 'MCP 全部注入',
  restoringMcp: '注入中…',
  msgMigrateDone: '已迁移 {moved} 个技能。',
  msgRestoreDone: '已注入 {restored} 个 MCP 服务器。',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<SkillsMcpKey, string> = {
  title: 'Tool Manager',
  description: 'Manage skills, MCP servers and local CLI tools (MCP connects for real).',
  expand: 'Show',
  collapse: 'Hide',
  notExposed: 'This deployment does not expose the plugin settings namespace to this client.',
  readOnly: 'The settings document is read-only; changes cannot be saved.',
  unsaved: 'Unsaved',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The save did not land; please retry.',
  inherit: 'Inherit',
  overridden: 'Overridden',
  reset: 'Reset',
  invalid: 'Invalid',
  enabled: 'Enable plugin',
  enabledHint: 'When off, routes and MCP connections all stop.',
  announce: 'Announce to agent',
  announceHint: 'Describe this plugin and its capabilities in every agent system prompt.',
  on: 'On',
  off: 'Off',

  tabSkills: 'Skills',
  tabMcp: 'MCP servers',
  tabCli: 'CLI tools',
  tabUninstall: 'Uninstall prep',
  panelMcp: 'MCP servers',
  panelCli: 'Local CLI tools',
  panelUninstall: 'Uninstall preparation',
  sourceSystem: 'System CLI',
  skillList: 'Skills',
  importSkill: 'Import skills',
  newServer: 'New / edit server',
  registerCli: 'Register a system CLI',
  modeForm: 'Form',
  modeJson: 'JSON',

  refresh: 'Refresh',
  edit: 'Edit',
  delete: 'Delete',
  confirmDelete: 'Click again to confirm',
  add: 'Add',
  testConnect: 'Test connection',
  testing: 'Testing…',
  loading: 'Loading…',
  chooseFolder: 'Choose folder',
  scanDir: 'Scan directory',
  scanning: 'Scanning…',
  importSelected: 'Import selected ({n})',
  rollback: 'Undo migration',
  rollingBack: 'Undoing…',
  probe: 'Probe',
  probing: 'Probing…',
  details: 'Details',

  announceTitle: 'Announce to AI',
  announceReading: 'Loading…',
  announceOnState: 'On',
  announceOffState: 'Off',
  announceOnNote: 'When on, the plugin declares what it can do (skills / MCP / CLI) in every agent system prompt.',
  announceOffNote: 'When off, the plugin is completely invisible to the AI — neither its presence nor its capabilities.',
  persistA: 'The setting persists under the',
  persistB: ' namespace in',
  persistC: '; switching takes effect immediately, no restart needed.',

  pluginDisabled: 'Plugin disabled: routes, MCP connections and CLI probing have all stopped. Re-enable it and refresh to recover.',
  storeMigrated: 'Skills moved into the unified store: {root}',
  storeMigratedTitle: 'How the store works',
  storeMigratedNote: 'The canonical copy lives under skills/ in the store; enabling injects a junction into the matching skills directory, disabling removes it — the AI then sees nothing. SKILL.md is never rewritten.',
  storeCount: '{count} in total, {enabled} enabled.',
  storeFailures: ' {n} could not be moved and were left in place.',

  stConnecting: 'Connecting',
  stRunning: 'Running',
  stFailed: 'Failed',
  stStopped: 'Stopped',
  stInstalled: 'Installed',
  stNotFound: 'Not found',
  stNotConnected: 'Not connected',
  suffixArchived: ' (archived)',
  suffixHidden: ' (hidden)',
  suffixNotEnabled: ' (disabled)',
  suffixDir: ' (dir)',
  suffixFile: ' (file)',
  badgeStore: 'Store',
  badgeInPlace: 'In place',
  badgeArchive: 'Archive',
  badgeActive: 'Enabled',
  badgeSkill: 'Skill',

  cliAdvertised: 'Advertised',
  cliHidden: 'Hidden',
  cliSkillSource: 'Skill CLI',
  cliSkillHint: 'Skill-provided CLIs (labelled “Skill CLI”) are best left hidden — their own skill is what calls them, and announcing them only pads the system prompt.',
  mcpTabManage: 'Manage',
  mcpTabCreate: 'Create',
  activate: 'Enable',
  archive: 'Archive',
  switchEnable: 'Enable',
  switchDisable: 'Disable',

  filterAll: 'All',
  filterEnabled: 'Enabled',
  filterDisabled: 'Disabled',
  levelProject: 'Project',
  levelUser: 'User',

  emptySkills: 'No skills found',
  emptySkillMatch: 'No matching skills',
  emptyMcp: 'No MCP servers configured yet',
  emptyMcpMatch: 'No matching servers',
  emptyCli: 'No CLI tools found',
  emptyCliMatch: 'No matching CLIs',

  phSearchSkill: 'Search skill names…',
  phSearchServer: 'Search server names…',
  phSearchCli: 'Search CLI names…',
  phImportDir: 'Directory path (a skill dir with SKILL.md, or flat .md files)',
  phCliName: 'CLI command name, e.g. gh',
  phCliCall: 'Invoked name (optional; defaults to the command name)',
  phServerName: 'e.g. github',

  fieldName: 'Name (name)',
  fieldTransport: 'Transport (transport)',
  fieldCommand: 'Command (command)',
  fieldArgs: 'Args (one per line)',
  fieldEnv: 'Env (KEY=VALUE, one per line)',
  fieldCwd: 'Working directory (cwd)',
  fieldUrl: 'URL',
  fieldHeaders: 'Headers (KEY=VALUE, one per line)',

  cliIntro: 'Auto-discovers the CLIs a skill embeds (scripts/run-cli) plus system CLIs (gh, git …). Skill scripts are probed for state; system CLIs are recorded in {store}/cli.json. The switch only decides whether a CLI is listed in that announcement — the plugin cannot start or stop a CLI the system installs.',
  cliRegisterNote: 'Once registered, the plugin probes whether it exists, its version and its subcommands, Skill-embedded CLIs appear automatically — no need to register them.',
  mcpArchiveNote: '{n} of them are archived in {store}/mcp-archive.json — never connected, never announced to the model, but kept whole: click “{activate}” any time to move one back to mcp.json.',
  mcpStoreNote: '{store} is the plugin’s unified store: enabled servers are written to mcp.json here and really connected through @deepseek-ai/dsh-mcp-client, which registers their tools as mcp__<server>__<tool>; archived definitions move to mcp-archive.json in the same directory (not connected, not announced). Saving means enabling: edit an archived server and save, and it goes straight back to mcp.json.',

  rowExists: 'Exists',
  rowPath: 'Path',
  rowVersion: 'Version',
  rowNeedUpdate: 'Update needed',
  rowApiKey: 'API key',
  rowKeyError: 'Key error',
  yesUpdateRecommended: 'Yes (update recommended)',
  no: 'No',
  configured: 'Configured',

  msgEnterCliName: 'Enter the CLI command name',
  msgJsonFailed: 'JSON parse failed: {error}',
  msgSaved: 'Saved {name}',
  msgConnectOk: 'Connected',
  msgConnectFailed: 'Connection failed: {error}',
  msgActivated: 'Enabled {name}',
  msgArchived: 'Archived {name}',
  msgRollbackOk: 'Migration undone: {moved} skills restored to their original locations',
  msgRollbackPartial: 'Restored {moved} skills, {failed} failed',
  msgEnterDir: 'Enter a directory path',
  msgNoImportable: 'No importable skills found',
  msgSelectFirst: 'Select the skills to import first',
  msgImported: 'Imported {n} skills',

  detailWhenToUse: 'When to use',
  cliSkillPrefix: 'Skill',

  uninstallIntro: 'Before uninstalling this plugin, give its managed data back to the system default locations here, then delete the store directory by hand.',
  uninstallSkillsTitle: 'Skills migration',
  uninstallSkillsNote: 'When the store holds skills, "Undo migration" moves them back to their original locations and removes the links — what the agent sees is exactly what it saw before the migration. When the store is empty but skills still sit in the skills directories, the button turns into "Migrate" to bring them back into the store.',
  uninstallMcpTitle: 'MCP injection',
  uninstallMcpNote: '"Inject all MCP" moves every archived server back into mcp.json in one pass and reconnects it. No undo is provided: a server you no longer need can be archived or deleted individually on the MCP tab at any time.',
  uninstallFilesTitle: 'Files to remove by hand',
  uninstallFilesNote: 'Uninstalling the plugin does not clean up its data. After removal, delete the whole store directory; deleting it covers everything listed below:',
  uninstallFilesList: 'skills/ (canonical skill copies), mcp.json (active MCP servers), mcp-archive.json (archived MCP servers), cli.json (CLI registry)',
  uninstallSettingsPath: 'Also feel free to delete the dsh-s-m-c-center block in ~/.dsh/settings.yaml.',
  uninstallNothing: 'The store holds no skills, no skills await migration, and no MCP servers are archived — nothing to do.',
  migrateSkills: 'Migrate',
  migratingSkills: 'Migrating…',
  restoreAllMcp: 'Inject all MCP',
  restoringMcp: 'Injecting…',
  msgMigrateDone: 'Migrated {moved} skills.',
  msgRestoreDone: 'Injected {restored} MCP servers.',
}
