#!/usr/bin/env bash
# dsh-s-m-c-center — 一键安装脚本（macOS / Linux / Git Bash）
# 用法：
#   bash scripts/install.sh                 # 默认安装当前包目录
#   bash scripts/install.sh <source>        # 指定来源（本地目录 / tgz / npm 名）
#   bash scripts/install.sh --profile web   # 指定 profile（缺省 web）
#   bash scripts/install.sh --restart       # 装完尝试重启 dsh-web（pm2）
#   bash scripts/install.sh --dry-run       # 只打印即将执行的操作
#
# 硬约束：作为普通包安装，不要用 junction（junction 会让依赖无法向上解析、
# 包名与 cordis.patch.yml 不一致）。本包装了 dsh.bundle.patch（cordis.patch.yml）。
set -euo pipefail

PKG="dsh-s-m-c-center"
PROFILE="web"
RESTART=0
DRYRUN=0
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --restart) RESTART=1; shift ;;
    --dry-run) DRYRUN=1; shift ;;
    -h|--help) echo "usage: bash scripts/install.sh [<source>] [--profile web] [--restart] [--dry-run]"; exit 0 ;;
    *) SOURCE="$1"; shift ;;
  esac
done

: "${DSH_HOME:=$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"

if ! command -v node >/dev/null 2>&1; then echo "[error] 未找到 node（DSH 需要 Node.js >= 20）"; exit 1; fi
if [[ ! -d "$PROFILE_DIR" ]]; then echo "[error] 找不到 profile 目录：$PROFILE_DIR（请先安装并运行过一次 dsh web）"; exit 1; fi

if [[ -z "$SOURCE" ]]; then
  # 本包目录（scripts/ 的上一级）
  SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
fi

DSH_CMD="${DSH_CMD:-}"
if [[ -z "$DSH_CMD" ]]; then
  if command -v dsh >/dev/null 2>&1; then DSH_CMD="dsh"
  elif command -v npx >/dev/null 2>&1; then DSH_CMD="npx"
  else echo "[error] 未找到 dsh 或 npx。请安装 DSH 或用 DSH_CMD 指定 dsh。" ; exit 1; fi
fi

if [[ "$DRYRUN" -eq 1 ]]; then
  echo "[dry-run] 将在 profile '$PROFILE'（$PROFILE_DIR）执行："
  echo "[dry-run]   $DSH_CMD plugin --profile $PROFILE add $SOURCE"
  echo "[dry-run] 然后校验 dsh.profile.bundles 包含 $PKG"
  if [[ "$RESTART" -eq 1 ]]; then echo "[dry-run] 然后重启 dsh-web"; fi
  exit 0
fi

echo "[install] 目标：$DSH_CMD plugin --profile $PROFILE add $SOURCE"
echo "[install] 普通包安装，勿用 junction。"
if [[ "$DSH_CMD" == "npx" ]]; then
  npx -y --package @deepseek-ai/dsh dsh plugin --profile "$PROFILE" add "$SOURCE"
else
  "$DSH_CMD" plugin --profile "$PROFILE" add "$SOURCE"
fi

# 校验 bundle 已注册
if [[ -f "$PROFILE_DIR/package.json" ]] && grep -q "$PKG" "$PROFILE_DIR/package.json"; then
  echo "[install] bundle 已注册：$PKG（下次启动自动挂载）"
else
  echo "[warn] $PKG 未出现在 node_modules/dsh.profile.bundles 中——挂载未注册，请检查来源。"
  exit 1
fi
echo "[install] 安装完成：$PKG"

if [[ "$RESTART" -eq 1 ]]; then
  if command -v pm2 >/dev/null 2>&1; then echo "[install] 重启 dsh-web（pm2）..."; pm2 restart dsh-web || echo "[warn] pm2 restart 失败，请手动重启 DSH"; fi
else
  echo "[install] 下一步：重启 DSH 并硬刷新浏览器（Ctrl+Shift+R / Cmd+Shift+R）。"
fi
