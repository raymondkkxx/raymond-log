#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Git Standard Branch Creation Tool\007"

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
    echo "[ERROR] Git command not found."
    script_fail
}

err_no_dir() {
    echo "[ERROR] Target directory not found: $1"
    script_fail
}

err_access_dir() {
    echo "[ERROR] Unable to access target directory: $1"
    script_fail
}

err_not_git() {
    echo "[ERROR] The directory is not a valid Git repository: $1"
    script_fail
}

err_branch_create() {
    echo "[ERROR] Git failed to create or checkout branch '$1'."
    script_fail
}

err_parent_exists() {
    echo ""
    echo "[ERROR] Conflicting parent branch '$1' exists locally!"
    echo "Git cannot create '${2}xxx' while branch '$1' exists."
    echo "Please run: git branch -D $1"
    script_fail
}

echo "======================================================"
echo "       Git Standard Development Branch Creator"
echo "======================================================"
echo ""

# 1. Verify Git Installation
if ! command -v git >/dev/null 2>&1; then
    err_no_git
fi

# 2. Resolve Default Target Directory (Two levels up from script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_PROJ="$(basename "$DEFAULT_DIR")"

# 3. Target Workspace Configuration
echo "[1/5] Target Workspace Configuration"
echo "Default directory : $DEFAULT_DIR"
read -r -p "Enter base directory path [Press ENTER for default]: " TARGET_DIR
TARGET_DIR="${TARGET_DIR:-$DEFAULT_DIR}"
TARGET_DIR="${TARGET_DIR//\"/}"
TARGET_DIR="${TARGET_DIR/#\~/$HOME}"

echo "Default project   : $DEFAULT_PROJ"
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

# 4. Display Current Version Information
echo ""
echo "======================================================"
CURR_BRANCH="$(git branch --show-current 2>/dev/null)"
if [ -z "$CURR_BRANCH" ]; then
    CURR_BRANCH="(Detached HEAD)"
fi
echo "Active Project : $FULL_PATH"
echo "Current Branch : $CURR_BRANCH"
echo -n "Base Commit    : "
git log -1 --pretty=format:"  Commit: %h - %s (by %an, %ar)"
echo ""
echo "======================================================"
echo ""

# 5. Standard Branch Naming
echo "[2/5] Select Standard Branch Type:"
echo "   [1] feature/  (New features or business requirements)"
echo "   [2] bugfix/   (Standard defect / bug fixing)"
echo "   [3] hotfix/   (Critical urgent production patch)"
echo "   [4] refactor/ (Code refactoring / architecture optimization)"
echo "   [5] test/     (Test automation / experimental branch)"
echo "   [6] Custom    (No prefix / fully manual name)"
read -r -p "Select prefix option [1-6] (Default: 1): " TYPE_CHOICE
TYPE_CHOICE="${TYPE_CHOICE:-1}"

PREFIX="feature/"
PARENT_PREFIX="feature"

case "$TYPE_CHOICE" in
    2)
        PREFIX="bugfix/"
        PARENT_PREFIX="bugfix"
        ;;
    3)
        PREFIX="hotfix/"
        PARENT_PREFIX="hotfix"
        ;;
    4)
        PREFIX="refactor/"
        PARENT_PREFIX="refactor"
        ;;
    5)
        PREFIX="test/"
        PARENT_PREFIX="test"
        ;;
    6)
        PREFIX=""
        PARENT_PREFIX=""
        ;;
    *)
        PREFIX="feature/"
        PARENT_PREFIX="feature"
        ;;
esac

# Check for conflicting parent branch name (e.g. branch 'test' blocking 'test/xxx')
if [ -n "$PARENT_PREFIX" ]; then
    if git show-ref --verify --quiet "refs/heads/$PARENT_PREFIX"; then
        err_parent_exists "$PARENT_PREFIX" "$PREFIX"
    fi
fi

while true; do
    echo ""
    echo "[3/5] Branch Identifier / Description:"
    read -r -p "Enter branch description (e.g. auth-token-v2 / test-1): " BRANCH_DESC
    BRANCH_DESC="${BRANCH_DESC:-dev-patch}"
    BRANCH_DESC="${BRANCH_DESC//\"/}"
    BRANCH_DESC="${BRANCH_DESC// /-}"
    NEW_BRANCH="${PREFIX}${BRANCH_DESC}"

    # Check if target branch already exists locally
    if git show-ref --verify --quiet "refs/heads/$NEW_BRANCH"; then
        echo ""
        echo "[WARNING] Branch '$NEW_BRANCH' already exists locally!"
        echo "   [1] Choose another branch name [Default]"
        echo "   [2] Switch directly to existing '$NEW_BRANCH'"
        read -r -p "Select option [1/2] [Default: 1]: " EXIST_CHOICE
        EXIST_CHOICE="${EXIST_CHOICE:-1}"
        if [ "$EXIST_CHOICE" = "2" ]; then
            if ! git checkout "$NEW_BRANCH"; then
                err_branch_create "$NEW_BRANCH"
            fi
            break
        fi
    else
        echo ""
        echo "Creating and switching to branch '$NEW_BRANCH'..."
        if ! git checkout -b "$NEW_BRANCH"; then
            err_branch_create "$NEW_BRANCH"
        fi
        break
    fi
done

# Strict verification: Ensure Git really switched to target branch
ACTUAL_BRANCH="$(git branch --show-current 2>/dev/null)"
if [ "$ACTUAL_BRANCH" != "$NEW_BRANCH" ]; then
    echo ""
    echo "[CRITICAL ERROR] Failed to switch branch! Current branch is still '$ACTUAL_BRANCH'."
    echo "Operation aborted to protect your current branch."
    script_fail
fi

echo ""
echo "======================================================"
echo "[OK] Verified active branch: $ACTUAL_BRANCH"
echo "======================================================"

# 6. Commit Message & Working Tree Handling
echo ""
echo "[4/5] Commit Message Configuration"
DEFAULT_COMMIT="${PREFIX}${BRANCH_DESC}: initialize development branch"
echo "Default Commit Message: \"$DEFAULT_COMMIT\""
read -r -p "Enter commit message [Press ENTER for default]: " COMMIT_MSG
COMMIT_MSG="${COMMIT_MSG:-$DEFAULT_COMMIT}"
COMMIT_MSG="${COMMIT_MSG//\"/}"

if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
    echo ""
    echo "Local working tree is clean. No uncommitted modifications."
else
    echo ""
    echo "[NOTICE] Uncommitted local modifications detected."
    read -r -p "Stage and commit these changes now? [Y/N] [Default: Y]: " DO_COMMIT
    DO_COMMIT="${DO_COMMIT:-Y}"
    if [[ "${DO_COMMIT^^}" == "Y" ]]; then
        echo "Staging all changes..."
        git add -A
        if ! git commit -m "$COMMIT_MSG"; then
            echo "[ERROR] Git commit failed!"
            script_fail
        fi
        echo "[OK] Changes committed to '$NEW_BRANCH'."
    fi
fi

# 7. Remote Synchronization
echo ""
echo "[5/5] Remote Synchronization"
read -r -p "Publish and push '$NEW_BRANCH' to remote origin? [Y/N] [Default: N]: " PUSH_CHOICE
PUSH_CHOICE="${PUSH_CHOICE:-N}"

if [[ "${PUSH_CHOICE^^}" == "Y" ]]; then
    echo "Pushing new branch to origin..."
    if ! git push -u origin "$NEW_BRANCH"; then
        echo ""
        echo "[WARNING] Failed to push to remote origin."
        echo "Check network or authentication permissions."
    else
        echo "[OK] Remote branch created and tracking established."
    fi
fi

echo ""
echo "======================================================"
echo "[SUCCESS] Branch ready for development"
echo "Active Branch : $ACTUAL_BRANCH"
echo -n "Latest Commit : "
git log -1 --oneline
echo "======================================================"

finish 0