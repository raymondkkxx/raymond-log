#!/usr/bin/env bash

# ======================================================
#       Git 一键多平台自动同步工具 (GitHub / Gitee)
# ======================================================

set -e

# 1. 解析默认目录与项目名称
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd || echo "$SCRIPT_DIR")"
DEFAULT_PROJ="$(basename "$DEFAULT_DIR")"

echo "======================================================"
echo "      Git 一键多平台自动同步工具 (GitHub / Gitee)"
echo "======================================================"
echo ""

# 2. 检查 Git 是否安装
if ! command -v git >/dev/null 2>&1; then
    echo "[ERROR] Git 未安装或未加入系统环境变量 PATH。"
    echo "执行异常终止。"
    exit 1
fi

# 3. 工作区路径配置
echo "[1/6] 路径配置"
echo "默认工作根目录 : $DEFAULT_DIR"
read -r -p "输入工作目录路径 [回车使用默认]: " TARGET_DIR
TARGET_DIR="${TARGET_DIR:-$DEFAULT_DIR}"

echo "默认项目文件夹 : $DEFAULT_PROJ"
read -r -p "输入项目文件夹名 [回车使用默认]: " TARGET_PROJ
TARGET_PROJ="${TARGET_PROJ:-$DEFAULT_PROJ}"

# 智能路径解析
FULL_PATH="$TARGET_DIR/$TARGET_PROJ"
if [ ! -d "$FULL_PATH" ]; then
    CUR_FOLDER="$(basename "$TARGET_DIR")"
    if [ "$CUR_FOLDER" = "$TARGET_PROJ" ]; then
        FULL_PATH="$TARGET_DIR"
    elif [ -d "$TARGET_DIR/.git" ]; then
        FULL_PATH="$TARGET_DIR"
    fi
fi

if [ ! -d "$FULL_PATH" ]; then
    echo "[ERROR] 未找到目标项目目录: $FULL_PATH"
    echo "执行异常终止。"
    exit 1
fi

cd "$FULL_PATH" || {
    echo "[ERROR] 无法进入目标目录: $FULL_PATH"
    echo "执行异常终止。"
    exit 1
}

# 验证 Git 仓库
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[ERROR] 当前目录不是有效的 Git 仓库: $FULL_PATH"
    echo "执行异常终止。"
    exit 1
fi

git config core.quotepath false
echo ""
echo "当前工作目录  : $FULL_PATH"
echo "======================================================"
echo ""

# 4. 平台交互选择
echo "[2/6] 目标平台选择"
echo "  1) 仅同步到 GitHub"
echo "  2) 仅同步到 Gitee (码云)"
echo "  3) 同时同步到 GitHub 和 Gitee"
read -r -p "请输入选项 [1/2/3, 默认 1]: " PLATFORM_CHOICE
PLATFORM_CHOICE="${PLATFORM_CHOICE:-1}"

SELECTED_TARGETS=()
case "$PLATFORM_CHOICE" in
    1)
        SELECTED_TARGETS=("github")
        ;;
    2)
        SELECTED_TARGETS=("gitee")
        ;;
    3)
        SELECTED_TARGETS=("github" "gitee")
        ;;
    *)
        echo "[WARNING] 输入无效，默认选择 GitHub。"
        SELECTED_TARGETS=("github")
        ;;
esac

# 辅助函数：解析或关联远端名称（使用全局变量 CUR_REMOTE 传值，防止终端输出被误捕获）
CUR_REMOTE=""
resolve_or_create_remote() {
    local platform="$1"
    CUR_REMOTE=""

    # 1. 检查是否存在同名 remote (如 gitee 或 github)
    if git remote | grep -qw "$platform"; then
        CUR_REMOTE="$platform"
    # 2. 检查 origin 是否匹配该平台
    elif git remote | grep -qw "origin"; then
        local origin_url
        origin_url="$(git remote get-url origin 2>/dev/null || true)"
        if [[ "$origin_url" =~ $platform ]]; then
            CUR_REMOTE="origin"
        fi
    fi

    # 3. 未绑定时引导手动输入 URL
    if [ -z "$CUR_REMOTE" ]; then
        echo ""
        echo "[提示] 当前项目尚未绑定 $platform 远程仓库。"
        read -r -p "请输入 $platform 的仓库地址 (URL) [直接回车跳过此平台]: " NEW_URL
        if [ -n "$NEW_URL" ]; then
            git remote add "$platform" "$NEW_URL"
            CUR_REMOTE="$platform"
            echo "[OK] 已成功添加远程仓库: $platform ($NEW_URL)"
        else
            echo "[INFO] 已跳过 $platform 的同步。"
            return 1
        fi
    fi
    return 0
}

VALID_REMOTES=()
for target in "${SELECTED_TARGETS[@]}"; do
    if resolve_or_create_remote "$target"; then
        VALID_REMOTES+=("$CUR_REMOTE")
    fi
done

if [ ${#VALID_REMOTES[@]} -eq 0 ]; then
    echo "[ERROR] 未指定任何有效的远程仓库，操作终止。"
    exit 1
fi

# 5. 分支检测
echo ""
echo "[3/6] 分支检测"
LOCAL_BRANCH="$(git branch --show-current 2>/dev/null || true)"

if [ -z "$LOCAL_BRANCH" ]; then
    echo "[ERROR] 检测到游离 HEAD 状态 (Detached HEAD)！"
    echo "请在运行此脚本前 checkout 切换到一个有效分支。"
    exit 1
fi

TARGET_BRANCH="$LOCAL_BRANCH"

echo ""
echo "======================================================"
echo "[同步目标汇总]"
echo "  当前本地分支 : $LOCAL_BRANCH"
for r in "${VALID_REMOTES[@]}"; do
    R_URL="$(git remote get-url "$r")"
    echo "  目标远程分支 : $r/$TARGET_BRANCH ($R_URL)"
done
echo "======================================================"
echo ""

# 6. 暂存所有修改
echo "[4/6] 暂存项目修改文件..."
git add -A :/

echo "------------------ 待提交文件清单 ------------------"
git status --short
echo "--------------------------------------------------"

# 7. 提交变更
echo ""
echo "[5/6] 提交变更..."
set +e
HAS_CHANGES="$(git status --porcelain 2>/dev/null)"
set -e

if [ -z "$HAS_CHANGES" ]; then
    echo "[INFO] 工作区干净，没有新改动需要提交。"
else
    read -r -p "输入 Commit 提交信息 [回车默认 'Update files']: " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-Update files}"

    if ! git commit -m "$COMMIT_MSG"; then
        echo "[ERROR] Git commit 提交失败！"
        exit 1
    fi
    echo "[OK] 本地提交成功。"
fi

# 8. 依次执行 Pull 与 Push
echo ""
echo "[6/6] 正在推送至指定平台..."

for REMOTE_NAME in "${VALID_REMOTES[@]}"; do
    echo ""
    echo ">>> 正在处理远程仓库: $REMOTE_NAME ($REMOTE_NAME/$TARGET_BRANCH)"
    
    # 尝试拉取
    set +e
    git pull "$REMOTE_NAME" "$TARGET_BRANCH" --no-rebase
    PULL_STATUS=$?
    set -e

    if [ $PULL_STATUS -ne 0 ]; then
        echo "[WARNING] 从 $REMOTE_NAME/$TARGET_BRANCH 拉取失败（可能是全新分支或有冲突）。"
        read -r -p "是否尝试继续推送至该平台？[Y/N, 默认 Y]: " CONT_PUSH
        CONT_PUSH="${CONT_PUSH:-Y}"
        if [[ "$CONT_PUSH" =~ ^[Nn]$ ]]; then
            echo "[INFO] 已跳过 $REMOTE_NAME 的推送。"
            continue
        fi
    fi

    # 尝试推送
    set +e
    git push -u "$REMOTE_NAME" "$LOCAL_BRANCH:$TARGET_BRANCH"
    PUSH_STATUS=$?
    set -e

    if [ $PUSH_STATUS -ne 0 ]; then
        echo "[ERROR] 推送至 $REMOTE_NAME 失败！请检查认证权限或提交冲突。"
    else
        echo "[SUCCESS] 已成功同步至 $REMOTE_NAME/$TARGET_BRANCH！"
    fi
done

echo ""
echo "======================================================"
echo "                所有选定同步流程执行完毕"
echo "======================================================"
echo ""