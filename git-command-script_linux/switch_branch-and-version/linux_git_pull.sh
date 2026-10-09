#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Git Remote Branch & Version Switch Tool\007"

# --- 退出处理函数 ---
finish() {
    echo ""
    read -n 1 -s -r -p "Press any key to continue . . ."
    echo ""
    exit "${1:-0}"
}

echo "======================================================"
echo "       Git Remote Branch & Version Switch Tool"
echo "======================================================"
echo ""

# 1. 解析上两级默认路径与项目名
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_PROJ="$(basename "$DEFAULT_DIR")"

read -r -p "Enter base directory path [Press ENTER for $DEFAULT_DIR]: " TARGET_DIR
TARGET_DIR="${TARGET_DIR:-$DEFAULT_DIR}"
TARGET_DIR="${TARGET_DIR//\"/}"
TARGET_DIR="${TARGET_DIR/#\~/$HOME}"

read -r -p "Enter project folder name [Press ENTER for $DEFAULT_PROJ]: " TARGET_PROJ
TARGET_PROJ="${TARGET_PROJ:-$DEFAULT_PROJ}"
TARGET_PROJ="${TARGET_PROJ//\"/}"

# 智能防嵌套路径识别
FULL_PATH="$TARGET_DIR/$TARGET_PROJ"
if [ ! -d "$FULL_PATH" ]; then
    CUR_FOLDER="$(basename "$TARGET_DIR")"
    if [ "${CUR_FOLDER,,}" = "${TARGET_PROJ,,}" ]; then
        FULL_PATH="$TARGET_DIR"
    elif [ -d "$TARGET_DIR/.git" ]; then
        FULL_PATH="$TARGET_DIR"
    fi
fi

echo ""
echo "Target project path: $FULL_PATH"
echo ""

# 校验目录与 Git 工作区
if [ ! -d "$FULL_PATH" ]; then
    echo "[ERROR] Directory not found: $FULL_PATH"
    finish 1
fi

cd "$FULL_PATH" 2>/dev/null || {
    echo "[ERROR] Failed to access target directory."
    finish 1
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[ERROR] The directory is not a valid Git repository!"
    finish 1
fi

# 2. 拉取远端最新分支与元数据
echo "------------------------------------------------------"
echo "[1/4] Fetching remote branches and commit metadata..."
echo "------------------------------------------------------"
if ! git fetch --all --prune --tags; then
    echo "[WARNING] Failed to fetch from remote. Check your network or credentials."
    echo "Proceeding with local cache..."
fi
echo ""

# 3. 列出并选择远程分支
echo "------------------------------------------------------"
echo "[2/4] Select a remote branch:"
echo "------------------------------------------------------"

branches=()
while IFS= read -r line; do
    b="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    if [ -n "$b" ]; then
        branches+=("$b")
    fi
done < <(git branch -r --no-color 2>/dev/null | grep -v "origin/HEAD")

b_count=${#branches[@]}
if [ "$b_count" -eq 0 ]; then
    echo "[ERROR] No remote branches found!"
    finish 1
fi

for i in "${!branches[@]}"; do
    idx=$((i + 1))
    echo "   [$idx] ${branches[$i]}"
done

while true; do
    read -r -p "Enter branch index [1-$b_count]: " b_choice
    if [[ "$b_choice" =~ ^[0-9]+$ ]] && [ "$b_choice" -ge 1 ] && [ "$b_choice" -le "$b_count" ]; then
        SELECTED_BRANCH="${branches[$((b_choice - 1))]}"
        break
    else
        echo "[INFO] Invalid input. Please enter a valid number."
    fi
done

echo ""
echo "Selected branch: $SELECTED_BRANCH"
echo ""

# 4. 列出并选择 Commit 版本 (最新 20 条)
echo "------------------------------------------------------"
echo "[3/4] Select a commit version (showing latest 20):"
echo "------------------------------------------------------"

commit_hashes=()
commit_infos=()

while IFS= read -r line; do
    if [ -n "$line" ]; then
        hash="${line%% *}"
        info="${line#* }"
        commit_hashes+=("$hash")
        commit_infos+=("$info")
    fi
done < <(git log "$SELECTED_BRANCH" -n 20 --pretty=format:"%h %ad [%an] %s" --date=short 2>/dev/null)

c_count=${#commit_hashes[@]}
if [ "$c_count" -eq 0 ]; then
    echo "[ERROR] No commit history found on this branch!"
    finish 1
fi

for i in "${!commit_hashes[@]}"; do
    idx=$((i + 1))
    echo "   [$idx] ${commit_hashes[$i]} - ${commit_infos[$i]}"
done

while true; do
    read -r -p "Enter commit index [1-$c_count]: " c_choice
    if [[ "$c_choice" =~ ^[0-9]+$ ]] && [ "$c_choice" -ge 1 ] && [ "$c_choice" -le "$c_count" ]; then
        SELECTED_HASH="${commit_hashes[$((c_choice - 1))]}"
        SELECTED_INFO="${commit_infos[$((c_choice - 1))]}"
        break
    else
        echo "[INFO] Invalid input. Please enter a valid number."
    fi
done

echo ""
echo "Selected commit: $SELECTED_HASH ($SELECTED_INFO)"
echo ""

# 5. 强制同步工作区到选定版本
echo "------------------------------------------------------"
echo "[4/4] Synchronizing workspace to target commit..."
echo "Warning: Untracked files and local uncommitted changes will be wiped."
echo "------------------------------------------------------"

if ! git checkout -f "$SELECTED_HASH"; then
    echo "[ERROR] Checkout failed!"
    finish 1
fi

git reset --hard "$SELECTED_HASH"
git clean -fd

echo ""
echo "======================================================"
echo "Success! Workspace fully synchronized to:"
echo "======================================================"
git log -1 --stat
echo "======================================================"

finish 0