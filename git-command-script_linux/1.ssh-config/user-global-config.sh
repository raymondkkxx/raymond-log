#!/usr/bin/env bash

# Set Terminal Title
echo -ne "\033]0;Git User Identity Setup\007"

echo "======================================================"
echo "          Git User Identity Configuration"
echo "======================================================"
echo ""

# Verify Git Installation
if ! command -v git >/dev/null 2>&1; then
    echo "[ERROR] Git is not installed or not found in system PATH."
    exit 1
fi

# Detect current configuration
CURRENT_NAME=$(git config --global user.name 2>/dev/null)
CURRENT_EMAIL=$(git config --global user.email 2>/dev/null)

echo "[INFO] Current Global Git Identity:"
if [ -n "$CURRENT_NAME" ]; then
    echo "  user.name  : $CURRENT_NAME"
else
    echo "  user.name  : (Not configured)"
fi

if [ -n "$CURRENT_EMAIL" ]; then
    echo "  user.email : $CURRENT_EMAIL"
else
    echo "  user.email : (Not configured)"
fi
echo "------------------------------------------------------"
echo ""

# Prompt for user.name
while true; do
    if [ -n "$CURRENT_NAME" ]; then
        read -r -p "Enter your Git user name [Press ENTER for '$CURRENT_NAME']: " INPUT_NAME
        INPUT_NAME="${INPUT_NAME:-$CURRENT_NAME}"
    else
        read -r -p "Enter your Git user name (e.g. GitHub username): " INPUT_NAME
    fi
    INPUT_NAME="${INPUT_NAME//\"/}"

    if [ -n "$INPUT_NAME" ]; then
        break
    else
        echo "[WARNING] Name cannot be empty. Please enter a valid name."
    fi
done

# Prompt for user.email
while true; do
    if [ -n "$CURRENT_EMAIL" ]; then
        read -r -p "Enter your Git email [Press ENTER for '$CURRENT_EMAIL']: " INPUT_EMAIL
        INPUT_EMAIL="${INPUT_EMAIL:-$CURRENT_EMAIL}"
    else
        read -r -p "Enter your Git email (e.g. GitHub email): " INPUT_EMAIL
    fi
    INPUT_EMAIL="${INPUT_EMAIL//\"/}"

    if [ -n "$INPUT_EMAIL" ]; then
        break
    else
        echo "[WARNING] Email cannot be empty. Please enter a valid email."
    fi
done

# Choose scope: Global or Local
echo ""
echo "Configuration Scope:"
echo "  1) Global (--global) - Apply to all repositories on this machine [Default]"
echo "  2) Local  (--local)  - Apply only to the current repository"
read -r -p "Select scope [1/2, default: 1]: " SCOPE_CHOICE
SCOPE_CHOICE="${SCOPE_CHOICE:-1}"

if [ "$SCOPE_CHOICE" = "2" ]; then
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "[WARNING] Current directory is not a Git repository. Falling back to global scope."
        SCOPE_FLAG="--global"
    else
        SCOPE_FLAG="--local"
    fi
else
    SCOPE_FLAG="--global"
fi

# Apply configuration
git config $SCOPE_FLAG user.name "$INPUT_NAME"
git config $SCOPE_FLAG user.email "$INPUT_EMAIL"

# Verify updated configuration
VERIFY_NAME=$(git config $SCOPE_FLAG user.name)
VERIFY_EMAIL=$(git config $SCOPE_FLAG user.email)

echo ""
echo "======================================================"
echo "[SUCCESS] Git identity configured successfully!"
echo "Scope      : $SCOPE_FLAG"
echo "user.name  : $VERIFY_NAME"
echo "user.email : $VERIFY_EMAIL"
echo "======================================================"
echo ""

read -n 1 -s -r -p "Press any key to continue . . ."
echo ""