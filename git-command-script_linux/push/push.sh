#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Git One-Click Sync and Push Tool\007"

# --- Error Handlers & Exit Functions ---
finish() {
    echo ""
    read -n 1 -s -r -p "Press any key to continue . . ."
    echo ""
    exit "${1:-0}"
}

script_fail() {
    echo ""
    echo "Execution terminated with errors."
    finish 1
}

err_no_git() {
    echo "[ERROR] Git is not installed or not added to system PATH."
    script_fail
}

err_no_dir() {
    echo "[ERROR] Target directory not found: $1"
    script_fail
}

err_access_dir() {
    echo "[ERROR] Failed to access directory: $1"
    script_fail
}

err_not_git() {
    echo "[ERROR] The directory is not a valid Git repository: $1"
    script_fail
}

err_no_origin() {
    echo "[ERROR] No remote 'origin' configured in this repository."
    echo "Please link a remote repository first: git remote add origin [URL]"
    script_fail
}

err_detached_head() {
    echo "[ERROR] Detached HEAD state detected and not resolved."
    echo "Please checkout a valid branch before running this script."
    script_fail
}

err_commit_fail() {
    echo "[ERROR] Git commit failed! Please check your git user.name and user.email settings."
    script_fail
}

err_push_fail() {
    local platform="$1"
    echo ""
    echo "======================================================"
    echo "[FAILED] Push to $platform failed! Troubleshooting checklist:"
    echo "1. Verify network connection and firewall settings to $platform."
    echo "2. Check your $platform SSH keys or authentication credentials."
    echo "3. Ensure remote branch has no conflicting unmerged commits."
    echo "4. Verify write/push permissions to this repository on $platform."
    echo "======================================================"
    script_fail
}

# 1. Resolve Default Path and Project Name (Two levels up from script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_PROJ="$(basename "$DEFAULT_DIR")"

echo "======================================================"
echo "           Git Auto Sync and Push Tool"
echo "======================================================"
echo ""

# 2. Verify Git Installation
if ! command -v git >/dev/null 2>&1; then
    err_no_git
fi

# 3. Workspace Configuration
echo "[1/6] Workspace Configuration"
echo "Default Directory : $DEFAULT_DIR"
read -r -p "Enter base directory path [Press ENTER for default]: " TARGET_DIR
TARGET_DIR="${TARGET_DIR:-$DEFAULT_DIR}"
TARGET_DIR="${TARGET_DIR//\"/}"
TARGET_DIR="${TARGET_DIR/#\~/$HOME}"

echo "Default Project   : $DEFAULT_PROJ"
read -r -p "Enter project folder name [Press ENTER for default]: " TARGET_PROJ
TARGET_PROJ="${TARGET_PROJ:-$DEFAULT_PROJ}"
TARGET_PROJ="${TARGET_PROJ//\"/}"

FULL_PATH="$TARGET_DIR/$TARGET_PROJ"
if [ ! -d "$FULL_PATH" ]; then
    CUR_FOLDER="$(basename "$TARGET_DIR")"
    if [ "${CUR_FOLDER,,}" = "${TARGET_PROJ,,}" ]; then
        FULL_PATH="$TARGET_DIR"
    elif [ -d "$TARGET_DIR/.git" ]; then
        FULL_PATH="$TARGET_DIR"
    fi
fi

if [ ! -d "$FULL_PATH" ]; then
    err_no_dir "$FULL_PATH"
fi

cd "$FULL_PATH" 2>/dev/null || err_access_dir "$FULL_PATH"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    err_not_git "$FULL_PATH"
fi

# Verify Remote Origin (Compatible with Git 1.8+)
REMOTE_ORIGIN_URL="$(git remote get-url origin 2>/dev/null || git config --get remote.origin.url 2>/dev/null)"
if [ -z "$REMOTE_ORIGIN_URL" ]; then
    err_no_origin
fi

PLATFORM_NAME="Git Remote Server"
case "$REMOTE_ORIGIN_URL" in
    *github.com*|*github*)
        PLATFORM_NAME="GitHub"
        ;;
    *gitee.com*|*gitee*)
        PLATFORM_NAME="Gitee"
        ;;
    *gitlab.com*|*gitlab*)
        PLATFORM_NAME="GitLab"
        ;;
    *codeup.aliyun.com*)
        PLATFORM_NAME="Aliyun Codeup"
        ;;
    *)
        PLATFORM_NAME="Custom Git Remote"
        ;;
esac

git config core.quotepath false
echo ""
echo "Active Directory  : $FULL_PATH"
echo "Remote Platform   : $PLATFORM_NAME"
echo "Remote URL        : $REMOTE_ORIGIN_URL"
echo "======================================================"
echo ""

# 4. Multi-compatible Branch Detection & Auto-Recovery
echo "[2/6] Branch Detection"

detect_branch() {
    local b
    # 优先方式：全版本 Git 兼容命令
    b="$(git symbolic-ref --short -q HEAD 2>/dev/null)"
    if [ -n "$b" ]; then
        echo "$b"
        return 0
    fi
    # 备用方式：Git 2.22+ 命令
    b="$(git branch --show-current 2>/dev/null)"
    if [ -n "$b" ]; then
        echo "$b"
        return 0
    fi
    return 1
}

LOCAL_BRANCH="$(detect_branch)"

# 如果无法获取分支名称，触发交互式修复
if [ -z "$LOCAL_BRANCH" ]; then
    CURRENT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null)"
    echo ""
    echo "[WARNING] Detached HEAD state detected (HEAD detached at: ${CURRENT_COMMIT:-unknown})!"
    echo "Existing local branches:"
    git branch --list | sed 's/^/  /'
    echo ""
    echo "Options:"
    echo "  1) Switch to an existing branch (Default)"
    echo "  2) Create and switch to a new branch from this commit"
    echo "  3) Abort"
    read -r -p "Choose an action [1/2/3, Default: 1]: " RECOVERY_CHOICE
    RECOVERY_CHOICE="${RECOVERY_CHOICE:-1}"

    case "$RECOVERY_CHOICE" in
        1)
            DEF_RECOVER_BRANCH="master"
            if git show-ref --verify --quiet refs/heads/main; then
                DEF_RECOVER_BRANCH="main"
            fi
            read -r -p "Enter branch to switch to [Default: $DEF_RECOVER_BRANCH]: " TARGET_SW
            TARGET_SW="${TARGET_SW:-$DEF_RECOVER_BRANCH}"
            if git checkout "$TARGET_SW"; then
                LOCAL_BRANCH="$TARGET_SW"
                echo "[OK] Successfully switched to branch: $LOCAL_BRANCH"
            else
                echo "[ERROR] Failed to switch to branch $TARGET_SW."
                script_fail
            fi
            ;;
        2)
            read -r -p "Enter new branch name: " NEW_BRANCH_NAME
            if [ -z "$NEW_BRANCH_NAME" ]; then
                echo "[ERROR] Branch name cannot be empty."
                script_fail
            fi
            if git checkout -b "$NEW_BRANCH_NAME"; then
                LOCAL_BRANCH="$NEW_BRANCH_NAME"
                echo "[OK] Created and switched to branch: $LOCAL_BRANCH"
            else
                echo "[ERROR] Failed to create branch $NEW_BRANCH_NAME."
                script_fail
            fi
            ;;
        *)
            err_detached_head
            ;;
    esac
fi

TARGET_BRANCH="$LOCAL_BRANCH"

echo ""
echo "======================================================"
echo "[BRANCH SYNC INFO]"
echo "  Target Platform      : $PLATFORM_NAME"
echo "  Current Local Branch : $LOCAL_BRANCH"
echo "  Target Remote Branch : origin/$TARGET_BRANCH"
echo "======================================================"
echo ""

# 5. Stage Working Tree
echo "[3/6] Staging Project Changes..."
git add -A :/

echo "------------------ STAGED FILES ------------------"
git status --short
echo "--------------------------------------------------"

# 6. Commit Changes
echo ""
echo "[4/6] Commit Changes..."
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
    echo "[INFO] Working tree clean. No new changes to commit."
else
    read -r -p "Enter commit message [Press ENTER for 'Update files']: " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-Update files}"
    COMMIT_MSG="${COMMIT_MSG//\"/}"

    if ! git commit -m "$COMMIT_MSG"; then
        err_commit_fail
    fi
    echo "[OK] Changes successfully committed."
fi

# 7. Pull Remote Updates
echo ""
echo "[5/6] Pulling Remote Updates from $PLATFORM_NAME (origin/$TARGET_BRANCH)..."
if ! git pull origin "$TARGET_BRANCH" --no-rebase; then
    echo ""
    echo "[WARNING] Failed to pull updates from $PLATFORM_NAME (origin/$TARGET_BRANCH)."
    echo "Possible reasons: Remote branch does not exist yet or merge conflicts occurred."
    read -r -p "Do you still want to proceed with push? [Y/N] [Default: Y]: " CONT_PUSH
    CONT_PUSH="${CONT_PUSH:-Y}"
    if [[ "${CONT_PUSH^^}" == "N" ]]; then
        script_fail
    fi
fi

# 8. Push to Target Platform
echo ""
echo "[6/6] Pushing to $PLATFORM_NAME (origin/$TARGET_BRANCH)..."
echo "Pushing: $LOCAL_BRANCH to $PLATFORM_NAME (origin/$TARGET_BRANCH)"
if ! git push -u origin "$LOCAL_BRANCH:$TARGET_BRANCH"; then
    err_push_fail "$PLATFORM_NAME"
fi

echo ""
echo "======================================================"
echo "[SUCCESS] Repository synced to $PLATFORM_NAME successfully!"
echo "Pushed: $LOCAL_BRANCH to $PLATFORM_NAME (origin/$TARGET_BRANCH)"
echo "======================================================"

finish 0