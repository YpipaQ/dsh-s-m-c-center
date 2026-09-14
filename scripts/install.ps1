## =============================================================================
# dsh-s-m-c-center — 一键安装脚本（Windows PowerShell 5.1+ / pwsh）
#
# 通过 DSH 官方插件命令把本插件当作“普通包”安装进 profile 并自动挂载：
#   dsh plugin --profile web add <来源>
#
# 遵循本仓库硬约束：**作为普通包安装，不要用 junction**（junction 会让依赖
# 无法向上解析、包名与 cordis.patch.yml 不一致）。本包装了 dsh.bundle.patch
# （cordis.patch.yml），CLI 的 bundle 协调会自动把它加入 profile 的
# dsh.profile.bundles，下次启动即挂载。
#
# 用法（任选其一）：
#   # 默认安装当前包目录
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#   # 指定来源（本地目录 / 构建 tgz / npm 包名）
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -Source <path-or-name>
#   # 装完自动重启 / 只预演
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -Restart
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -DryRun
#
# 参数：
#   -Source     安装来源（绝对路径/本地 tgz/npm 名）；缺省 = 本包目录（$PSScriptRoot\..）
#   -Profile    目标 profile 名（缺省 web）
#   -Restart    装完后尝试 `pm2 restart dsh-web`（无 pm2 时仅提示）
#   -DryRun     只打印将要执行的操作，不写任何文件
#   -Help       打印本帮助
#
# 环境变量（可省略）：DSH_HOME（默认 %USERPROFILE%\.dsh）、DSH_CMD（默认 dsh）
# =============================================================================
param(
  [string]$Source = '',
  [string]$Profile = 'web',
  [string]$Provide = '',
  [switch]$Restart,
  [switch]$DryRun,
  [switch]$Help
)

$PKG = 'dsh-s-m-c-center'
if ($Help) {
  Write-Host @'
dsh-s-m-c-center 一键安装脚本（PowerShell）

用法：
  powershell -ExecutionPolicy Bypass -File scripts/install.ps1 [-Source <path|tgz|npm名>] [-Profile web] [-Restart] [-DryRun]
  Source 缺省为当前包目录。示例：
    -Source "$PWD\dsh-s-m-c-center-0.1.4.tgz"
    -Source dsh-s-m-c-center   # 已发布到 npm/注册表时按名字装
'@
  exit 0
}

function Say([string]$m)  { Write-Host "[install] $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "[warn] $m" -ForegroundColor Yellow }
function Die([string]$m)  { Write-Host "[error] $m" -ForegroundColor Red; exit 1 }

# DSH_HOME：DSH_HOME 环境变量 > %USERPROFILE% > $HOME
if ($env:DSH_HOME) { $DSH_HOME = $env:DSH_HOME }
elseif ($env:USERPROFILE) { $DSH_HOME = Join-Path $env:USERPROFILE '.dsh' }
else { $DSH_HOME = Join-Path $HOME '.dsh' }
$PROFILE_DIR = Join-Path $DSH_HOME "profiles\$Profile"
$PKG_JSON = Join-Path $PROFILE_DIR 'package.json'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Die '未找到 node（DSH 运行需要 Node.js >= 20），请先安装并加入 PATH。'
}
if (-not (Test-Path $PROFILE_DIR)) {
  Die "找不到 profile 目录：$PROFILE_DIR（请先安装并运行过一次 dsh web）"
}

# 确定安装来源：缺省用当前包目录；也允许显式传 tgz/npm 名
if ([string]::IsNullOrWhiteSpace($Source)) {
  $Source = Split-Path $PSScriptRoot -Parent   # 本包目录
}

# 组装 dsh CLI：优先 PATH 上的 dsh，缺省 npx 拉官方包
function Get-DshCli {
  if ($env:DSH_CMD) { return $env:DSH_CMD }
  if (Get-Command dsh -ErrorAction SilentlyContinue) { return 'dsh' }
  if (Get-Command npx -ErrorAction SilentlyContinue) { return 'npx' }
  return $null
}
$CLI = Get-DshCli
if (-not $CLI) { Die '未找到 dsh 或 npx。请先安装 DSH，或用 DSH_CMD 指定 dsh 路径。' }

if ($CLI -eq 'dsh') { $cliArgs = @('plugin', '--profile', $Profile, 'add', $Source) }
else { $cliArgs = @('-y', '--package', '@deepseek-ai/dsh', 'dsh', 'plugin', '--profile', $Profile, 'add', $Source) }

if ($DryRun) {
  Say "[dry-run] 将在 profile '$Profile'（$PROFILE_DIR）执行："
  Say "[dry-run]   $CLI plugin --profile $Profile add $Source"
  Say '[dry-run] 然后校验 dsh.profile.bundles 包含 dsh-s-m-c-center'
  if ($Restart) { Say '[dry-run] 然后 pm2 restart dsh-web' } else { Say '[dry-run] 然后提示手动重启 DSH 并硬刷新' }
  exit 0
}

Say "目标：$CLI plugin --profile $Profile add $Source（profile: $PROFILE_DIR）"
Say '注意：普通包安装，勿用 junction。'
$addOut = & $CLI @cliArgs 2>&1
$addCode = $LASTEXITCODE
$addOut | ForEach-Object { $_ }
if ($addCode -ne 0) { Die "dsh plugin add 失败（退出码 $addCode）。请检查来源/网络/pnpm 配置。" }

# 校验 bundle 已注册（挂载生效的判据）
$pkgJson = Get-Content -Raw $PKG_JSON | ConvertFrom-Json
$bundles = @($pkgJson.dsh.profile.bundles)
if ($bundles -notcontains $PKG) {
  Warn 'dsh-s-m-c-center 未出现在 dsh.profile.bundles 中——挂载未注册。'
  Warn '可能原因：来源不是本插件包 / pnpm 拦截。请检查后重试。'
  exit 1
}
Say "bundle 已注册：dsh.profile.bundles 包含 $PKG（下次启动自动挂载）"
Say "安装完成：$PKG"

if ($Restart) {
  if (Get-Command pm2 -ErrorAction SilentlyContinue) { Say '重启 dsh-web（pm2）...'; pm2 restart dsh-web; if ($LASTEXITCODE -ne 0) { Warn 'pm2 restart 失败，请手动重启 DSH' } }
  else { Warn '未找到 pm2，请手动重启 DSH（如：pnpm dsh web）' }
} else {
  Say '下一步：重启 DSH 并硬刷新浏览器（Ctrl+Shift+R / Cmd+Shift+R）使新副本生效。'
}
