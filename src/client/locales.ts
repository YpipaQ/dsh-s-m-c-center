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
  | 'tabGuide'
  | 'panelMcp'
  | 'panelCli'
  | 'panelUninstall'
  | 'panelGuide'
  | 'guideIntro'
  | 'guideSkillsH'
  | 'guideStoreH'
  | 'guideStoreP'
  | 'guideEnableH'
  | 'guideEnableP'
  | 'guideMcpH'
  | 'guideConnectH'
  | 'guideConnectP'
  | 'guideArchiveH'
  | 'guideArchiveP'
  | 'guideCliH'
  | 'guideDiscoverH'
  | 'guideDiscoverP'
  | 'guideAnnounceH'
  | 'guideAnnounceP'
  | 'guideDataH'
  | 'guideDataP'
  | 'sourceSystem'
  | 'skillList'
  | 'groupNative'
  | 'groupStored'
  | 'groupRegistered'
  | 'registerSkill'
  | 'refreshRegistry'
  | 'registerSelected'
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
  | 'storeCount'
  | 'storeUntracked'
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
  | 'suffixUnlinked'
  | 'suffixUntracked'
  | 'suffixOversize'
  | 'suffixDir'
  | 'suffixFile'
  | 'badgeArchive'
  | 'badgeActive'
  | 'badgeSkill'
  // the two-state controls
  | 'cliAdvertised'
  | 'cliHidden'
  | 'cliSkillSource'
  | 'mcpTabManage'
  | 'mcpTabCreate'
  | 'activate'
  | 'archive'
  | 'announceOn'
  | 'announceOff'
  | 'btnLink'
  | 'btnUnlink'
  | 'btnMigrate'
  | 'btnUnmigrate'
  | 'btnUnregister'
  | 'btnVerify'
  | 'btnDeleteLink'
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
  | 'phRegisterDir'
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
  | 'msgRegistered'
  | 'msgVerifyTracked'
  | 'msgVerifyUntracked'
  | 'msgRefreshOk'
  | 'msgRefreshMissing'
  // conversation contexts (phase two)
  | 'contextTitle'
  | 'contextNote'
  | 'emptyContexts'
  | 'contextSessionItem'
  | 'contextNoCandidates'
  | 'msgContextApplied'
  | 'msgContextLive'
  | 'msgContextSaved'

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
  | 'helpToggle'
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
  tabGuide: '使用说明',
  panelMcp: 'MCP 服务器',
  panelCli: '本地 CLI 工具',
  panelUninstall: '卸载准备',
  panelGuide: '使用说明',
  guideIntro: '本插件把 agent 的三类工具（技能 / MCP / CLI）收在一个设置页里。下面按类别说明各自是怎么工作的；最下方是卸载前的准备。',
  guideSkillsH: '技能（Skills）',
  guideStoreH: '储存库与目录联接',
  guideStoreP: '用户级技能的正本统一放在储存库的 skills/ 目录；各个 skills 目录里看到的是指向正本的目录联接。你不用管联接——界面上只有「启用 / 不启用」。',
  guideEnableH: '启用 / 不启用',
  guideEnableP: '启用 = 在对应 skills 目录注入联接，AI 立刻能用；不启用 = 移除联接，AI 完全看不到。两种情况都不改写 SKILL.md。项目级技能就地管理，仍按前言里的开关。',
  guideMcpH: 'MCP 服务器',
  guideConnectH: '真实连接',
  guideConnectP: '激活的服务器经 @deepseek-ai/dsh-mcp-client 真正连接，工具注册为 mcp__<server>__<tool>——不是只写了一份配置。连接失败会在那一行显示原因。',
  guideArchiveH: '激活 / 归档',
  guideArchiveP: '归档 = 把定义移到 mcp-archive.json：不连接、不公告，但完整保留；点「激活」随时移回 mcp.json 并重新连接。编辑一条已归档的服务器再保存，等同于激活它。',
  guideCliH: '本地 CLI 工具',
  guideDiscoverH: '发现与体检',
  guideDiscoverP: '自动发现 skill 内嵌的 CLI（scripts/run-cli）与登记的系统 CLI（gh / git 等），探测是否安装、版本、是否需更新、API-Key 状态，并列出子命令。',
  guideAnnounceH: '公告 / 隐藏',
  guideAnnounceP: '开关只决定「是否把这个 CLI 写进给 AI 的公告」——CLI 由系统安装，插件无法启停它。随 skills 安装的 CLI（标「技能 CLI」）建议保持隐藏：它们主要供所属 skill 自己调用，公告出去只会撑大系统提示。',
  guideDataH: '数据放在哪里',
  guideDataP: '插件的全部数据都在统一储存库（默认 ~/.dsh/S-M-C，可用 DSH_STORE_ROOT 改位）：skills/ 放技能正本、mcp.json 放激活的服务器、mcp-archive.json 放归档的、cli.json 放 CLI 登记表。密码与环境变量为明文，文件权限 0600 需自行保证。',
  sourceSystem: '系统 CLI',
  skillList: '技能列表',
  groupNative: '原生',
  groupStored: '储存库',
  groupRegistered: '已登记',
  registerSkill: '登记外部技能（正本留在原地，仅写入登记表）',
  refreshRegistry: '溯源刷新',
  registerSelected: '登记选中 ({n})',
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
  storeCount: '共 {count} 个，已联接 {linked} 个。',
  storeUntracked: '{n} 条联接无账本记录',
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
  suffixUnlinked: ' （未联接）',
  suffixUntracked: ' （⚠ 无记录联接）',
  suffixOversize: ' （超过 10G 上限）',
  suffixDir: ' (目录)',
  suffixFile: ' (文件)',
  badgeArchive: '归档库',
  badgeActive: '已启用',
  badgeSkill: 'Skill',

  cliAdvertised: '公告',
  cliHidden: '隐藏',
  cliSkillSource: '技能 CLI',
  mcpTabManage: '管理',
  mcpTabCreate: '新建',
  activate: '激活',
  archive: '归档',
  announceOn: '公告中',
  announceOff: '已隐藏',
  btnLink: '联接',
  btnUnlink: '断开联接',
  btnMigrate: '迁移入库',
  btnUnmigrate: '撤销迁移',
  btnUnregister: '取消登记',
  btnVerify: '验证',
  btnDeleteLink: '删除联接',

  filterAll: '全部',
  filterEnabled: '公告中',
  filterDisabled: '已隐藏',
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
  phRegisterDir: '目录路径（向下两层扫描 SKILL.md，单技能上限 10G）',
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
  msgNoImportable: '未发现可登记的技能',
  msgSelectFirst: '请先勾选要登记的技能',
  msgRegistered: '已登记 {n} 个技能',
  msgVerifyTracked: '联接有效（有账本记录）→ ',
  msgVerifyUntracked: '联接有效（无账本记录）→ ',
  msgRefreshOk: '溯源刷新完成：{n} 条记录均存在',
  msgRefreshMissing: '溯源刷新：{n} 条记录的目录已不存在 → ',

  contextTitle: '会话技能（上下文级）',
  contextNote: '每个对话独立选择注入哪些技能，默认全不选。对话里的 agent 也可以自己开关（写入同一份配置）。此列表只显示已有选择记录的会话。',
  emptyContexts: '还没有会话保存过技能选择——在对话里让 agent 用 skill_select 启用即可',
  contextSessionItem: '会话 {id}…（{n} 个已选）',
  contextNoCandidates: '没有可勾选的技能（先在下方登记或迁移入库）',
  msgContextApplied: '已保存，本会话共选 {n} 个技能（{state}）',
  msgContextLive: '已即时生效',
  msgContextSaved: '会话未运行，下次启动生效',

  detailWhenToUse: '何时使用',
  helpToggle: '/help 帮助文本',
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
  tabGuide: 'Guide',
  panelMcp: 'MCP servers',
  panelCli: 'Local CLI tools',
  panelUninstall: 'Uninstall preparation',
  panelGuide: 'Guide',
  guideIntro: 'The plugin gathers the agent’s three tool families (skills, MCP servers, local CLI tools) into one settings page. Below is how each of them works; the last section covers uninstalling.',
  guideSkillsH: 'Skills',
  guideStoreH: 'The store and its links',
  guideStoreP: 'The canonical copy of every user-level skill lives under skills/ in the store; what each skills directory shows is a junction pointing at it. You never manage the links — the UI only offers enable / disable.',
  guideEnableH: 'Enable / disable',
  guideEnableP: 'Enabling injects a junction into the matching skills directory and the AI can use the skill right away; disabling removes it and the AI sees nothing. Neither rewrites SKILL.md. Project-level skills stay in place and still switch through their frontmatter.',
  guideMcpH: 'MCP servers',
  guideConnectH: 'Real connections',
  guideConnectP: 'Enabled servers are really connected through @deepseek-ai/dsh-mcp-client and register their tools as mcp__<server>__<tool> — not merely a config entry. A failed connection shows its reason on the row.',
  guideArchiveH: 'Enable / archive',
  guideArchiveP: 'Archiving moves a definition to mcp-archive.json: not connected, not announced, but kept whole; “enable” moves it back to mcp.json and reconnects it. Editing an archived server and saving has the same effect as enabling it.',
  guideCliH: 'Local CLI tools',
  guideDiscoverH: 'Discovery and health check',
  guideDiscoverP: 'Finds the CLIs a skill embeds (scripts/run-cli) plus registered system CLIs (gh, git …), probing whether each is installed, its version, whether an update is due, its API-key state, and its subcommands.',
  guideAnnounceH: 'Announce / hide',
  guideAnnounceP: 'The switch only decides whether the CLI is written into the agent announcement — the plugin cannot start or stop a CLI the system installs. Skill-provided CLIs (labelled “Skill CLI”) are best left hidden: their own skill calls them, and announcing them only pads the system prompt.',
  guideDataH: 'Where the data lives',
  guideDataP: 'Everything this plugin stores lives in one place — by default ~/.dsh/S-M-C (relocate with DSH_STORE_ROOT): skills/ holds the canonical skill copies, mcp.json the enabled servers, mcp-archive.json the archived ones, cli.json the CLI registry. Secrets and env vars are plain text; file permissions (0600) are up to you.',
  sourceSystem: 'System CLI',
  skillList: 'Skills',
  groupNative: 'Native',
  groupStored: 'Stored',
  groupRegistered: 'Registered',
  registerSkill: 'Register external skills (copies stay put; only the ledger is written)',
  refreshRegistry: 'Refresh traceability',
  registerSelected: 'Register selected ({n})',
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
  storeCount: '{count} in total, {linked} linked.',
  storeUntracked: '{n} link(s) without a ledger record',
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
  suffixUnlinked: ' (unlinked)',
  suffixUntracked: ' (⚠ untracked link)',
  suffixOversize: ' (over the 10 GB cap)',
  suffixDir: ' (dir)',
  suffixFile: ' (file)',
  badgeArchive: 'Archive',
  badgeActive: 'Enabled',
  badgeSkill: 'Skill',

  cliAdvertised: 'Advertised',
  cliHidden: 'Hidden',
  cliSkillSource: 'Skill CLI',
  mcpTabManage: 'Manage',
  mcpTabCreate: 'Create',
  activate: 'Enable',
  archive: 'Archive',
  announceOn: 'Announced',
  announceOff: 'Hidden',
  btnLink: 'Link',
  btnUnlink: 'Unlink',
  btnMigrate: 'Move to store',
  btnUnmigrate: 'Undo migration',
  btnUnregister: 'Unregister',
  btnVerify: 'Verify',
  btnDeleteLink: 'Delete link',

  filterAll: 'All',
  filterEnabled: 'Announced',
  filterDisabled: 'Hidden',
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
  phRegisterDir: 'Directory path (scans two levels down for SKILL.md, 10 GB cap per skill)',
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
  msgNoImportable: 'No registrable skills found',
  msgSelectFirst: 'Select the skills to register first',
  msgRegistered: 'Registered {n} skills',
  msgVerifyTracked: 'Link is valid (tracked in the ledger) → ',
  msgVerifyUntracked: 'Link is valid (no ledger record) → ',
  msgRefreshOk: 'Traceability refresh done: all {n} records exist',
  msgRefreshMissing: 'Traceability refresh: {n} record(s) missing → ',

  contextTitle: 'Conversation skills (context level)',
  contextNote: 'Each conversation picks which skills are injected, all unselected by default. The agent can flip its own skills in-conversation (same config file). This list shows conversations that already hold a selection.',
  emptyContexts: 'No conversation has a selection yet — ask the agent to enable one via skill_select',
  contextSessionItem: 'Session {id}… ({n} selected)',
  contextNoCandidates: 'Nothing to tick (register or migrate skills first)',
  msgContextApplied: 'Saved; {n} skill(s) selected for this conversation ({state})',
  msgContextLive: 'applied live',
  msgContextSaved: 'session idle; takes effect on next start',

  detailWhenToUse: 'When to use',
  helpToggle: '/help text',
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
