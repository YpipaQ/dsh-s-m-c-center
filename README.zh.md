<div align="center">
  🌏 <b>中文</b> · <a href="./README.md">English</a>
</div>

<div align="center">
  <b style="font-size: 1.15em;">一个 DeepSeek Harness (DSH) Web 插件：在同一个设置页里管理「技能 + MCP + CLI」三类 agent 工具，并让每个对话按需注入自己的技能。</b><br /><br />
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/releases"><img alt="release" src="https://img.shields.io/github/package-json/v/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=release&amp;color=fe7d37&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=stars&amp;color=f0a01e&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/forks"><img alt="forks" src="https://img.shields.io/github/forks/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=forks&amp;color=2b8df5&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="npm" src="https://img.shields.io/npm/v/dsh-s-m-c-center?style=flat-square&amp;label=npm&amp;color=cb3837&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="总下载量" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2F2026-08-26%3A2030-01-01%2Fdsh-s-m-c-center&amp;query=%24.downloads&amp;label=%E6%80%BB%E4%B8%8B%E8%BD%BD%E9%87%8F&amp;style=flat-square&amp;color=2ea44f&amp;labelColor=555" /></a>
  <a href="./LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="dsh" src="https://img.shields.io/badge/dsh-%3E%3D0.1.2--alpha.2-4d6bfe?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="node" src="https://img.shields.io/node/v/dsh-s-m-c-center?style=flat-square&amp;labelColor=555" /></a>
</div>

> [!NOTE]
> **0.1.2 起技能目录由本插件接管（影子目录）**：目录成员严格跟随会话的注入选择；目录变化只发一条替换帧，不再每步追加；容器目录（只有 DESCRIPTION.md）可注入、可加载。已经过三轮外部实测（16/16 通过）。

# 三合一工具台 · dsh-s-m-c-center

> 中文名：**三合一工具台** ｜ 界面入口：「Web UI 插件 → 工具管理」 ｜ 别名：工具管理、工具中心、技能管理、MCP 服务器管理、CLI 工具管理、Skills / MCP / CLI 管理器

> 一个自包含的 DSH Web 插件：在设置页新增一个一级页面，统一管理 agent 的**三类工具**（技能 / MCP 服务器 / 本地 CLI），并新增一层**按对话生效的技能注入**；另有一个使用说明页，讲清三者各自的工作方式，并在最下方负责把它们干净地还回去。
>
> 仅通过 profile bundle patch + 包安装挂载 —— **不改任何 DeepSeek Harness 源码**。

## ✨ 它是什么

| 页签 | 管理 | 底层 |
|---|---|---|
| **Skills 技能** | 浏览 / 启用 / 不启用 / 删除 / 导入技能；**「会话默认」**决定新对话起始注入哪些技能 | 用户级走 `~/.dsh/S-M-C/skills` 正本 + 目录联接；项目级改写 `SKILL.md` 前言 |
| **MCP 服务** | 新建 / 编辑 / 测试 / 激活 / 归档 / 删除 MCP 服务器 | 真实 `@deepseek-ai/dsh-mcp-client` 连接（`mcp__<server>__<tool>`）；归档移入 `S-M-C/mcp-archive.json` |
| **CLI 工具** | 发现 / 探测本地 CLI 工具；登记系统 CLI | skill 内嵌 `scripts/run-cli` + `S-M-C/cli.json` |
| **使用说明** | 三类工具各自的工作方式，以及卸载前的准备 | 说明集中在此页；卸载准备在最下方 |

> 完整说明见 [`docs/功能介绍.md`](./docs/功能介绍.md)、[`docs/架构.md`](./docs/架构.md)。

## 💡 功能

- **技能**：按项目级 / 用户级与来源分组（`.dsh/skills`、`.agents/skills`、`~/.dsh/skills`、`~/.agents/skills`）。用户级技能迁入**统一储存库** `~/.dsh/S-M-C/skills`，「启用」= 在技能根目录注入目录联接，「不启用」= 移除联接（`SKILL.md` 一字不改）；项目级技能就地管理，仍用前言开关。删除为两步确认的物理删除，且**只删储存库里的正本**（见下）。点开可看详情（description / whenToUse / 正文）；支持从任意目录扫描导入。
- **会话默认与按对话注入**：`会话默认` 是新对话的起始技能；每个对话还能有自己的差异（关掉某个、追加某个）。对话里的 agent 可以自己开关（写入该对话自己的配置），侧边栏还有一个「会话技能」小窗供你随时手动调整——两处列表都只列**已联接**的技能。详见下一节。
- **MCP**：分「管理 / 新建」两个子页——管理页一台服务器一个 **激活 / 归档** 开关（外加删除），新建页提供表单或 JSON 编辑，保存前可**测试连接**（一次性真实探测）；**激活 / 归档**真实连接 / 断开并注册 `mcp__<server>__<tool>` 工具；实时状态（连接中 / 运行中 / 失败 / 已停止）。
- **CLI**：自动发现 skill 包装的 CLI（`scripts/run-cli.*` / `cli-state.*`），并登记系统 CLI（`gh`、`git` …，存于 `S-M-C/cli.json`）。每条都会探测：是否安装 / 版本 / 是否需更新 / API-Key 状态 / 子命令，并在行上标出来源与位置。**公告 / 隐藏**开关只决定是否把这个 CLI 写进给 AI 的公告（插件无法启停系统装的 CLI，因此默认隐藏）。
- **使用说明**：按三类讲清工作方式，最下方是卸载前的总撤退口。「撤销迁移」把储存库技能移回原始位置；储存库空着时同一按钮变为绿色的「迁移」，**双向可逆**；「MCP 全部注入」把归档服务器一次性移回并重连；页面同时列出卸载后需手动删除的目录与配置块。
- **界面**：全量文案 zh / en 双语（各 198 键，英文环境零中文）；破坏性操作两步确认，且点开别处即复位。

## 🧠 两条通道：联接 vs 注入

| | **启用（联接）** | **注入（会话选择）** |
|---|---|---|
| 载体 | `~/.dsh/skills/<slug>` 目录联接 | 会话技能表 `~/.dsh/S-M-C/contexts.json` 里每个对话一行 |
| 作用范围 | **全局**：所有对话、所有工作区、含子智能体 | **仅本对话** |
| 谁维护 | 技能页的「启用 / 不启用」 | 「会话默认」开关、小窗、以及模型自己的 `skill_select` |
| 谁看得见 | dsh 原生文件系统扫描 | 本插件的会话注入 |

**会话选择的存储方式**：文件里存的是**与默认的差异**（`overrides: { on, off }`），有效集合 = `默认 ∪ on \ off`。这样改了默认，未单独配置过的对话立刻跟着变；而你在某个对话里手动关掉的技能不会被默认拉回来。

## 📷 界面预览

<div align="center">
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-skills.png" alt="Skills 技能" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-mcp.png" alt="MCP 服务" width="49%" />
  <br />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-cli.png" alt="CLI 工具" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-guide.png" alt="使用说明" width="49%" />
</div>
<p align="center"><i>四个页签：技能（统一储存库 + 联接 + 会话默认）、MCP（真实连接）、CLI（发现 / 探测 / 登记）、使用说明。个人路径已打码。</i></p>

## 🤖 交给 agent 的两个工具

| 工具 | 作用 |
|---|---|
| `skill_select` | 为**本对话**启用 / 停用某个技能；写入该对话自己的差异并立即生效。接受所有已联接的条目——容器目录同样可以（其 DESCRIPTION.md 即可加载的正文）。 |
| `skill_query` | **只读**查询本工作区可见的技能清单（名称 / 描述 / 分组 / 是否已联接 / 本对话是否已注入），调用时动态计算，可关键词与分组过滤。 |

此外，「使用说明」页可开启**向 AI 公告**：把插件能力与三类工具的现状写进每个 agent 的系统提示。技能目录也由本插件生成（影子目录）：目录里会多出一行 `smc-skill-index` —— **索引技能**，加载它即可拿到本工作区的完整技能列表（格式与目录层一致）；未注入的技能不能加载（提示 "not enabled in this conversation"）；`/技能名` 手势不受影响。

## 🏗️ 架构

**挂载与双面结构** —— 插件只是一个 npm 包 + 一行 profile bundle patch，dsh 源码零改动：

<div align="center">
  <img src="./docs/arch-overview.svg" alt="挂载与双面架构" width="88%" />
</div>
<p align="center"><i>Host 半区注册路由、公告 agent、真连 MCP；Client 半区只提供设置页，两者通过 <code>/api/dsh-s-m-c-center/*</code> 通信。</i></p>

**储存库布局** —— 插件的数据全部收在 `~/.dsh/S-M-C`，而 dsh 扫描的两个目录刻意留在库外（插件只往里面注入 / 移除联接）：

<div align="center">
  <img src="./docs/arch-store.svg" alt="统一外挂储存库布局" width="88%" />
</div>
<p align="center"><i>技能的「正本」始终在储存库里；<code>~/.dsh/skills</code> 下那个条目只是指向正本的联接。</i></p>

**三个开关在磁盘上的真实动作** —— 不是改配置字段，是真的动文件 / 动连接：

<div align="center">
  <img src="./docs/arch-lifecycle.svg" alt="三个开关的真实动作" width="88%" />
</div>
<p align="center"><i>技能 = 增删联接；MCP 激活 / 归档 = 定义在 <code>mcp.json</code> 与 <code>mcp-archive.json</code> 之间搬家；CLI = 只切可见性。</i></p>

## 🚀 安装

> **环境要求**：DeepSeek Harness **`>= 0.1.2-alpha.2`**（`@deepseek-ai/*` 统一发版）；Node `^22.19.0 || >=24`。
> 现状：**`0.1.6-alpha.1` 与 `0.1.5-rc.2` 上完整实测**；`0.1.2-alpha.2` 起所用 API 已逐一核对存在且签名一致。

> **必须按普通包安装 —— 切勿 junction 链接。** junction 会让依赖（`schemastery` / `react` 等）无法向上解析，并导致包名与 `cordis.patch.yml` 不一致；两者都会让 DSH 启动失败。

```sh
# 从 npm 安装
dsh plugin --profile web add dsh-s-m-c-center
# 或：npm install dsh-s-m-c-center

# 从源码（本仓库 / 克隆后）
dsh plugin --profile web add <本文件夹绝对路径>

# 或安装打包产物
dsh plugin --profile web add <path>/dsh-s-m-c-center-0.1.3.tgz

# 或使用一键脚本
bash scripts/install.sh                                        # macOS / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts/install.ps1   # Windows
```

首次安装后需要**重启 DSH 并硬刷新浏览器**（Cmd/Ctrl+Shift+R），然后进入「设置 → Web UI 插件 → **工具管理**」。

> **升级**：只改界面时，覆盖文件 + 硬刷新即可；改到 Host 侧（路由 / 引擎 / 工具）时需要重启一次 DSH 进程。

## ⚙️ 配置

```yaml
# 本插件自己的设置命名空间（dsh settings）
dsh-s-m-c-center:
  enabled: true        # 总开关（路由、MCP 连接、CLI 探测）
  announceToAgent: true # 向每个 agent 的系统提示说明本插件
```

运行时状态：

- **统一外挂储存库**：`~/.dsh/S-M-C/`（**S**kills / **M**CP / **C**LI）—— `skills/`（正本与 `index.json` 清单）、`skills-links.json`（联接账本）、`skills-registry.json`（登记的外部技能）、`mcp.json`、`mcp-archive.json`、`cli.json`。旧位置在首次启动时自动迁入；整个库可用 `DSH_STORE_ROOT` 挪到别处（插件会重建目录联接）。
- **会话选择**：全机一张表 —— `~/.dsh/S-M-C/contexts.json`，`default` 是会话默认，`sessions.<sessionId>` 是该对话与默认的差异（`on` / `off`）。**不涉及工作区**：键就是会话 id，所以设置页与小窗读的是同一份文档。旧版每个工作区一份文件，首次挂载（表不存在时）会一次性并入。
- MCP：激活的 `S-M-C/mcp.json`，归档的 `S-M-C/mcp-archive.json`（凭证 / headers 明文保存 —— 请保持这两个文件 `0600`）。
- CLI 注册表：`S-M-C/cli.json`。

## 🔒 权限与依赖声明

插件以 DSH 进程权限运行，会用到文件、网络、命令与凭据四类能力 —— 逐项说明用途与边界：

| 能力 | 做什么 | 范围与边界 |
|---|---|---|
| **文件** | 读写储存库 `~/.dsh/S-M-C/**`；在技能根目录创建 / 移除目录联接；读写会话技能表 `~/.dsh/S-M-C/contexts.json`（以及旧布局的 `<workspace>/.dsh/S-M-C/contexts/*.json`，仅由导入读取一次）；读取 `SKILL.md` 与 skill 内嵌脚本 | 只动储存库与 dsh 扫描的四个技能根目录；就地技能只改写前言标记；不读写其它路径 |
| **网络** | 连接用户自己配置的 MCP 服务器（stdio 走子进程，streamable-http 走 HTTP） | 只连用户在管理页填写的服务器地址；插件自身**无**内置外部服务、**无**遥测、不上报任何数据 |
| **命令** | 探测本地 CLI 工具：执行其 `--help` / `--version` 或 `cli-state` 声明的探测命令 | 只执行注册表内、管理页可见的命令；不执行用户未登记的其它命令 |
| **凭据** | 保存 MCP 的 env / headers / API-Key，读取 CLI 的 `cli-state` | 只在本机 `~/.dsh/S-M-C/*.json` 明文读写、不外发；建议将这两个文件权限设为 `0600` |

**外部依赖**：运行时依赖仅 `schemastery`（设置项校验）；`@deepseek-ai/*` 与 `react` 是 peer 依赖，由 DSH 提供；无原生模块，**无** postinstall / prepare 等生命周期脚本。

**失败边界**：目录扫描或路由失败降级为空列表与占位提示；迁移失败只记入 `failures` 并继续，不阻塞 DSH 启动；MCP 连接失败只改变状态显示、不动文件；会话注入失败不会否决会话创建，只在日志里说明原因。任何一项都不会让 DSH 启动失败。

**已知风险**：技能删除是物理删除、不可恢复（且**只删储存库正本**：`native` 技能需先「迁移入库」，`registered` 用「取消登记」，「删除联接」只解联、从不删目标）；MCP 凭证明文保存；技能启用 / 禁用经目录联接生效，手动剪切储存库会让联接失效（需要时用 `DSH_STORE_ROOT` 搬迁，插件会自建联接）。

## 🗂️ 仓库结构

```
dsh-s-m-c-center/
├── src/
│   ├── index.ts            # 宿主组合根（挂载、设置、公告、工具注册）
│   ├── routes.ts           # 路由汇总（按域拼装）
│   ├── setup.ts            # 身份常量 + 面向 agent 的说明文案
│   ├── shared/             # 跨域原语：paths / fs-utils / frontmatter / http / protocol
│   ├── features/           # 垂直切片，每域自持 manager + routes + index 桶
│   │   ├── skills/         #   技能：roots / scanner / linking / links / registry /
│   │   │                   #        adopt / delete / migration / store-index / catalog
│   │   ├── mcp/            #   MCP：document / manager / routes
│   │   ├── cli/            #   CLI：probe / registry / manager / routes
│   │   ├── context/        #   会话注入：engine / apply / tools / routes
│   │   ├── announce/       #   系统提示公告
│   │   └── settings/       #   插件设置命名空间
│   └── client/             # 浏览器半区
│       ├── shell/          #   设置卡片外壳、侧边栏「会话技能」小窗
│       ├── shared/         #   api / ui / locales(zh+en) / format / css module
│       └── features/       #   四个页签各自的面板 + hook
├── lib/                    # 构建产物（宿主 index.js；客户端 client.js；types/*）
├── tests/                  # vitest（13 个文件）
├── cordis.patch.yml        # DSH bundle patch（包名必须与 package.json 一致）
├── dsh.plugin.json         # DSH 插件清单（id / version / main / client.main）
├── package.json            # npm 包（dsh.bundle.patch + dsh.client + compatibility）
├── LICENSE                 # MIT
├── README.md / README.zh.md
├── docs/
│   ├── 功能介绍.md / 架构.md / development.md
│   ├── arch-*.svg          # 架构图（本文档引用）
│   ├── social-preview.png  # 仓库社交预览图
│   └── shots/              # 界面截图（本文档引用）
└── scripts/install.*       # 一键安装进 DSH profile
```

## 🛠️ 开发

见 [`docs/development.md`](./docs/development.md)：双半区构建（`tsdown` 重建 `lib/index.js` + `lib/client.js`）、类型检查（`tsc --noEmit`）与测试套件（`vitest`，13 个文件 / 191 个用例）。

## 📄 许可

[MIT](./LICENSE)。

---

*English: [`README.md`](./README.md).*
