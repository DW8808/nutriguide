#!/bin/bash
set -e

chmod +x "$0" 2>/dev/null
cd "$(dirname "$0")"

echo ""
echo "🌿 NutriGuide 營養系統 — 自動安裝程式"
echo "========================================"
echo ""

# ── 補齊 PATH（bash 腳本不會自動載入 .zshrc）────────────────
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

# 載入 nvm（若已裝）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# 載入 Homebrew shell 環境（M 系列晶片路徑）
[ -f "/opt/homebrew/bin/brew" ] && eval "$(/opt/homebrew/bin/brew shellenv)"
# Intel Mac 路徑
[ -f "/usr/local/bin/brew" ]    && eval "$(/usr/local/bin/brew shellenv)"

# ── 安裝 Node.js（若未找到）─────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "📦 未偵測到 Node.js，正在自動安裝..."

  if command -v brew &>/dev/null; then
    brew install node
  else
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
  fi
fi

# ── 確認 node 和 npm 都能用 ──────────────────────────────────
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo ""
  echo "❌ 找不到 node 或 npm。"
  echo "   請手動前往 https://nodejs.org 下載 LTS 版安裝後，再重新執行此腳本。"
  echo ""
  read -r _
  exit 1
fi

echo "✅ Node.js $(node --version)  /  npm $(npm --version)"

# ── 安裝套件 ─────────────────────────────────────────────────
echo ""
echo "📦 安裝套件中..."
npm install

# ── 產生圖示 ─────────────────────────────────────────────────
echo ""
echo "🎨 產生圖示..."
node scripts/gen-icon-png.cjs

# ── 建置應用程式 ─────────────────────────────────────────────
echo ""
echo "🔨 建置 NutriGuide（約 5-10 分鐘，請耐心等候）..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run electron:build

# ── 完成 ─────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "✅ 建置完成！正在開啟安裝資料夾..."
echo "========================================"
echo ""
echo "請在開啟的資料夾中找到 .dmg 檔案，雙擊安裝即可。"
echo ""

open "$(pwd)/release/"

echo "按 Enter 關閉此視窗..."
read -r _
