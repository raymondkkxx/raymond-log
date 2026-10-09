#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Gitee Remote Switch to SSH Tool\007"

echo "======================================================"
echo "    Gitee Remote Switcher (Two Levels Below Project)"
echo "======================================================"
echo ""

# 1. 解析脚本路径并默认向上定位两级目录作为项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_PROJ_NAME="$(basename "$DEFAULT_PROJECT_DIR")"

# 2. 验证 Git 是否安装
if ! command -v git >/dev/null 2>&1; then
    echo "[ERROR] Git 未安装或未添加到 PATH 环境变量中。"
    exit 1
fi

# 3. 检查 Gitee SSH 密钥连通性
echo "[1/4] 检查服务器与 Gitee 的 SSH 密钥认证..."
AUTH_OUTPUT=$(ssh -T -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new git@gitee.com 2>&1)

if echo "$AUTH_OUTPUT" | grep -i "successfully authenticated" >/dev/null; then
    echo "[OK] Gitee SSH 鉴权成功！"
else
    echo "[WARNING] 未检测到有效的 Gitee SSH 鉴权。"
    echo "SSH 测试输出: $AUTH_OUTPUT"
    echo "提示：若尚未在 Gitee 后台添加本服务器的公钥，请添加后再执行推送。"
    read -r -p "是否仍然继续更新仓库地址为 SSH 格式？(y/N): " FORCE_CONT
    if [[ "$FORCE_CONT" != [yY] && "$FORCE_CONT" != [yY][eE][sS] ]]; then
        echo "操作已终止。"
        exit 1
    fi
fi
echo ""

# 4. 定位目标 Git 仓库目录
echo "[2/4] 确认目标项目根目录"
echo "默认识别路径 : $DEFAULT_PROJECT_DIR"
echo "项目目录名称 : $DEFAULT_PROJ_NAME"
read -r -p "请输入项目根目录路径 [直接按回车使用默认]: " TARGET_DIR
TARGET_DIR="${TARGET_DIR:-$DEFAULT_PROJECT_DIR}"
TARGET_DIR="${TARGET_DIR//\"/}"
TARGET_DIR="${TARGET_DIR/#\~/$HOME}"

if [ ! -d "$TARGET_DIR" ]; then
    echo "[ERROR] 目录不存在: $TARGET_DIR"
    exit 1
fi

cd "$TARGET_DIR" 2>/dev/null || { echo "[ERROR] 无法访问目录: $TARGET_DIR"; exit 1; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[ERROR] 目录 '$TARGET_DIR' 不是有效的 Git 仓库（未找到 .git 目录）。"
    exit 1
fi
echo "[OK] 已成功进入仓库: $(pwd)"
echo ""

# 5. 检查与转换远程 origin 地址
echo "[3/4] 检查当前远程地址 (origin)..."
CURRENT_URL=$(git remote get-url origin 2>/dev/null)

if [ -z "$CURRENT_URL" ]; then
    echo "[WARNING] 当前仓库未配置名为 'origin' 的远程地址。"
    read -r -p "请输入 Gitee 仓库路径 (如 raymondkkxx/raymond-blog): " REPO_INPUT
    REPO_INPUT="${REPO_INPUT//\"/}"
    REPO_INPUT="${REPO_INPUT%.git}"
    TARGET_SSH_URL="git@gitee.com:${REPO_INPUT}.git"
    git remote add origin "$TARGET_SSH_URL"
    echo "[OK] 已添加远程 origin: $TARGET_SSH_URL"
elif [[ "$CURRENT_URL" == git@gitee.com:* ]]; then
    echo "[INFO] 当前仓库 origin 已经是 SSH 协议: $CURRENT_URL"
    TARGET_SSH_URL="$CURRENT_URL"
else
    # 将 HTTPS 地址转换为 SSH 格式
    TARGET_SSH_URL=$(echo "$CURRENT_URL" | sed -E 's#^https?://([^@]+@)?gitee\.com[:/]#git@gitee.com:#')
    [[ "$TARGET_SSH_URL" != *.git ]] && TARGET_SSH_URL="${TARGET_SSH_URL}.git"

    echo "当前地址 (HTTPS) : $CURRENT_URL"
    echo "转换地址 (SSH)   : $TARGET_SSH_URL"
    echo ""
    read -r -p "是否将远程 origin 切换为该 SSH 地址？[Y/n]: " CONFIRM_SWITCH
    CONFIRM_SWITCH="${CONFIRM_SWITCH:-Y}"
    if [[ "${CONFIRM_SWITCH^^}" == "Y" ]]; then
        git remote set-url origin "$TARGET_SSH_URL"
        echo "[OK] 远程地址已成功修改为 SSH 格式。"
    else
        echo "操作已取消。"
        exit 0
    fi
fi
echo ""

# 6. 验证仓库连通与权限
echo "[4/4] 验证仓库读写权限..."
if git ls-remote origin HEAD >/dev/null 2>&1; then
    echo "[SUCCESS] SSH 远程连接验证通过！"
    echo "当前 remote 地址："
    git remote -v
    echo ""
    echo "======================================================"
    echo " 配置成功！后续推送将完全免密。"
    echo "======================================================"
else
    echo "[WARNING] 无法通过 SSH 读取远程仓库，请检查："
    echo "1. Gitee 账号是否对该仓库具有读写权限；"
    echo "2. 服务器公钥是否已正确配置至该 Gitee 账号。"
fi