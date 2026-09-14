<div align="center">
  🌏 <b>中文</b> · <a href="./README.md">English</a>
</div>

<div align="center">
  <b style="font-size: 1.15em;">一个 DeepSeek Harness (DSH) Web 插件：在同一个设置页里管理「技能 + MCP + CLI」三类 agent 工具，并附一个卸载前准备页。</b><br /><br />
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/releases"><img alt="release" src="https://img.shields.io/github/package-json/v/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=release&amp;color=fe7d37&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=stars&amp;color=f0a01e&amp;labelColor=555" /></a>
  <a href="https://github.com/YpipaQ/dsh-s-m-c-center/forks"><img alt="forks" src="https://img.shields.io/github/forks/YpipaQ/dsh-s-m-c-center?style=flat-square&amp;label=forks&amp;color=2b8df5&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="npm" src="https://img.shields.io/npm/v/dsh-s-m-c-center?style=flat-square&amp;label=npm&amp;color=cb3837&amp;labelColor=555" /></a>
  <a href="https://www.npmjs.com/package/dsh-s-m-c-center"><img alt="总下载量" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2F2026-08-26%3A2030-01-01%2Fdsh-s-m-c-center&amp;query=%24.downloads&amp;label=%E6%80%BB%E4%B8%8B%E8%BD%BD%E9%87%8F&amp;style=flat-square&amp;color=2ea44f&amp;labelColor=555" /></a>
  <a href="./LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="dsh" src="https://img.shields.io/badge/dsh-%3E%3D0.1.2--alpha.2-4d6bfe?style=flat-square&amp;labelColor=555" /></a>
  <a href="./package.json"><img alt="node" src="https://img.shields.io/node/v/dsh-s-m-c-center?style=flat-square&amp;labelColor=555" /></a>
</div>

# dsh-s-m-c-center

> **工具管理** —— 一个自包含的 DSH Web 插件，在设置页新增一个一级页面，统一管理 agent 的**三类工具**：**技能（Skills）/ MCP 服务器 / 本地 CLI 工具**；另有一个卸载前准备页，负责把它们干净地还回去。
>
> 仅通过 profile bundle patch + 包安装挂载 —— **不改任何 DeepSeek Harness 源码**。

## ✨ 它是什么

一个设置页（「Web UI 插件 → **工具管理**」），管理 agent 的三类工具，外加一个卸载前准备页 —— 想卸载时能把它们干净地还回去：

| 页签 | 管理 | 底层 |
|---|---|---|
| **Skills 技能** | 浏览 / 启用 / 不启用 / 删除 / 导入技能（项目级 + 用户级） | 用户级走 `~/.dsh/S-M-C/skills` 正本 + 目录联接；项目级改写 `SKILL.md` 前言 |
| **MCP 服务** | 新建 / 编辑 / 测试 / 激活 / 归档 / 删除 MCP 服务器 | 真实 `@deepseek-ai/dsh-mcp-client` 连接（`mcp__<server>__<tool>`）；归档移入 `S-M-C/mcp-archive.json` |
| **CLI 工具** | 发现 / 探测本地 CLI 工具；登记系统 CLI | skill 内嵌 `scripts/run-cli` + `S-M-C/cli.json` |
| **卸载准备** | 撤销技能迁移 ↔ 重新迁移；MCP 归档一键全部注回；列出卸载前需手动删除的文件 | 迁移双向可逆（红 / 绿条件按钮）；MCP 注入按设计不撤回 |

> 完整说明见 [`docs/功能介绍.md`](./docs/功能介绍.md)。

## 💡 功能

- **技能**：按项目级 / 用户级与来源分组（`.dsh/skills`、`.agents/skills`、`~/.dsh/skills`、`~/.agents/skills`）。用户级技能迁入**统一储存库** `~/.dsh/S-M-C/skills`，启用 = 在 skills 目录注入目录联接，不启用 = 移除联接（`SKILL.md` 一字不改）；项目级技能就地管理，仍用前言开关。两步确认物理删除；详情（description / whenToUse / 正文）；从任意目录扫描导入（原生目录选择器或手写路径），导入即入统一储存库并启用。
- **MCP**：分「管理 / 新建」两个子页——管理页一台服务器一个 **激活 / 归档** 开关（外加删除），新建页提供表单或 JSON 编辑，保存前可**测试连接**（一次性真实探测）；**激活 / 归档**真实连接 / 断开并注册 `mcp__<server>__<tool>` 工具（归档的定义移到 `S-M-C/mcp-archive.json`，不连接、不公告，但完整保留可随时移回）；实时状态（连接中 / 运行中 / 失败 / 已停止）。
- **CLI**：自动发现 skill 包装的 CLI（其 `scripts/run-cli.*` / `cli-state.*`，即 tencent-news 模式）；探测是否安装 / 版本 / 需更新 / API-Key 状态（解析 `cli-state` JSON）并列出子命令（解析 `help`）；`S-M-C/cli.json` 登记系统 CLI（`gh`、`git`、`tencent-news-cli` …），提供 **公告 / 隐藏** 开关（**默认隐藏**——它只决定是否把这个 CLI 写进给 AI 的公告，插件无法启停系统装的 CLI）与删除；每行标出来源与位置（`技能 CLI · <路径>` / `系统 CLI · <路径>`）。
- **卸载准备**：卸载插件前的总撤退口。「撤销迁移」（红）把储存库技能移回原始位置；储存库空着而 skills 目录还有技能时，同一按钮自动变为绿色的「迁移」，随时把技能再收进储存库——**双向可逆**；「MCP 全部注入」把归档服务器一次性移回 `mcp.json` 并重新连接；页面同时明确列出卸载后需手动删除的储存库目录与配置块。
- **界面**：全量文案 zh / en 双语（各 160 键，英文环境零中文）；「向 AI 公告」的长说明折叠进标题行，默认收起、点击展开；删除等破坏性操作为两步确认。

## 📷 界面预览

<div align="center">
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-skills.png" alt="Skills 技能" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-mcp.png" alt="MCP 服务" width="49%" />
  <br />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-cli.png" alt="CLI 工具" width="49%" />
  <img src="https://raw.githubusercontent.com/YpipaQ/dsh-s-m-c-center/main/docs/shots/shot-uninstall.png" alt="卸载准备" width="49%" />
</div>
<p align="center"><i>四个页签：技能（统一储存库 + 联接）、MCP（真实连接）、CLI（发现 / 探测 / 登记）、卸载准备（双向可逆的迁移与手动清理清单）。个人路径已打码。</i></p>

## 🏗️ 架构

**挂载与双面结构** —— 插件只是一个 npm 包 + 一行 profile bundle patch，dsh 源码零改动：

<div align="center">
  <img src="./docs/arch-overview.svg" alt="挂载与双面架构" width="88%" />
</div>
<p align="center"><i>Host 半区注册路由、公告 agent、真连 MCP；Client 半区只提供设置页，两者通过 <code>/api/dsh-skills-mcp/*</code> 通信。</i></p>

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

> **环境要求**：DeepSeek Harness **`>= 0.1.2-alpha.2`**（`@deepseek-ai/*` 全部统一发版）。
> 现状：**`0.1.5-rc.2` 上完整实测**；`0.1.2-alpha.2` 起所用 API 已逐一核对存在且签名一致。

> **必须按普通包安装 —— 切勿 junction 链接。** junction 会让依赖（`schemastery` / `react` 等）无法向上解析，并导致包名与 `cordis.patch.yml` 不一致；两者都会让 DSH 启动失败。

> **npm 发布说明**：本包（`dsh-s-m-c-center`）**尚未发布到 npm** —— 因作者个人原因，发布顺延至 9 月 17 日之后。
> 在此之前，请使用下方的源码或打包产物方式安装。

```sh
# 从 npm 安装：https://www.npmjs.com/package/dsh-s-m-c-center
# 注：本包尚未在 npm 上发布（作者个人原因，顺延至 9/17 之后），请用下方源码或 tarball 安装
dsh plugin --profile web add dsh-s-m-c-center
# 或：npm install dsh-s-m-c-center

# 从源码（本仓库 / 克隆后）
dsh plugin --profile web add <本文件夹绝对路径>

# 或安装打包产物
dsh plugin --profile web add <path>/dsh-s-m-c-center-<version>.tgz

# 或使用一键脚本
bash scripts/install.sh                                        # macOS / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts/install.ps1   # Windows
```

安装后**重启 DSH 并硬刷新浏览器**（Cmd/Ctrl+Shift+R），进入「设置 → Web UI 插件 → **工具管理**」即可。

> **更新无需重启**：装好之后，后续升级这个插件**理论上不需要重启 DSH** —— 覆盖文件后直接硬刷新浏览器即可。
> （只有改动涉及 Host 侧路由或后端逻辑时才需要重启一次 DSH 进程；纯界面上的改动刷新即生效。）

## ⚙️ 配置

```yaml
# 本插件自己的设置命名空间（dsh settings）
dsh-s-m-c-center:
  enabled: true        # 总开关（路由、MCP 连接、CLI 探测）
  announceToAgent: true # 向每个 agent 的系统提示说明本插件
```

运行时状态：

- **统一外挂储存库**：本插件的数据全部收在 `~/.dsh/S-M-C/`（**S**kills / **M**CP / **C**LI）—— `skills/`、`mcp.json`、`mcp-archive.json`、`cli.json`。旧位置在首次启动时自动迁入；整个库可用 `DSH_STORE_ROOT` 挪到别处（插件会自动重建目录联接）。
- MCP：激活的 `S-M-C/mcp.json`，归档的 `S-M-C/mcp-archive.json`（凭证 / headers 明文保存 —— 请保持这两个文件 `0600`）。
- CLI 注册表：`S-M-C/cli.json`。

## 🗂️ 仓库结构

```
dsh-s-m-c-center/
├── src/                # TypeScript 源码（宿主 + 客户端两半区）
│   ├── index.ts        # 宿主入口（插件加载、设置命名空间、agent 公告）
│   ├── skills.ts       # 技能文件系统引擎
│   ├── mcp.ts          # MCP 配置存储 + 真连接管理器
│   ├── cli.ts          # CLI 发现 / 探测 / 注册表 + cli-state 解析
│   ├── routes.ts       # /api/dsh-skills-mcp 路由族
│   ├── protocol.ts     # 共享类型 + API 路径
│   └── client/         # 浏览器半区（入口、SettingsCard、manager、api、locales、css）
├── lib/                # 构建产物（宿主：index.js；客户端：client.js；types/*）
├── cordis.patch.yml    # DSH bundle patch（包名必须与 package.json 一致）
├── dsh.plugin.json     # DSH 插件清单（id / version / main / client.main）
├── package.json        # npm 包（dsh.bundle.patch + dsh.client）
├── LICENSE             # MIT
├── README.md / README.zh.md
├── docs/
│   ├── 功能介绍.md      # 完整功能说明
│   ├── development.md  # 开发说明（构建、测试、储存库布局）
│   ├── arch-*.svg      # 架构图（本文档引用）
│   ├── social-preview.png  # 仓库社交预览图（在仓库设置里上传）
│   └── shots/          # 界面截图（本文档引用）
└── scripts/install.*   # 一键安装进 DSH profile
```

## 🛠️ 开发

见 [`docs/development.md`](./docs/development.md)：双半区构建（`tsdown` 重建 `lib/index.js` + `lib/client.js`）、类型检查与测试套件。

## 📄 许可

[MIT](./LICENSE)。

---

*English: [`README.md`](./README.md).*
