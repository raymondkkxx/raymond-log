#!/usr/bin/env bash

# Terminal title
echo -ne "\033]0;GitHub SSH Automated Setup\007"

echo "======================================================"
echo "          GitHub SSH Key Automated Setup"
echo "======================================================"
echo ""

# 1. Check openssh-client
if ! command -v ssh-keygen >/dev/null 2>&1; then
    echo "[INFO] Installing openssh-client..."
    sudo apt-get update && sudo apt-get install -y openssh-client
fi

# 2. Get GitHub Account Email
read -r -p "Enter your GitHub email address: " GIT_EMAIL
if [ -z "$GIT_EMAIL" ]; then
    echo "[ERROR] Email address cannot be empty."
    exit 1
fi

SSH_DIR="$HOME/.ssh"
KEY_PATH="$SSH_DIR/id_ed25519"

# 3. Create SSH Directory with Correct Permissions
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# 4. Generate Ed25519 Key Pair
if [ -f "$KEY_PATH" ]; then
    echo "[INFO] Existing SSH key found at $KEY_PATH."
else
    echo "[INFO] Generating new Ed25519 key pair..."
    ssh-keygen -t ed25519 -C "$GIT_EMAIL" -f "$KEY_PATH" -N ""
    chmod 600 "$KEY_PATH"
    chmod 644 "${KEY_PATH}.pub"
    echo "[OK] SSH key generated."
fi

# 5. Configure SSH Client Config
CONFIG_FILE="$SSH_DIR/config"
if [ ! -f "$CONFIG_FILE" ] || ! grep -q "Host github.com" "$CONFIG_FILE" 2>/dev/null; then
    cat <<EOF >> "$CONFIG_FILE"

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking accept-new
EOF
    chmod 600 "$CONFIG_FILE"
    echo "[OK] ~/.ssh/config configured."
fi

# 6. Display Public Key
echo ""
echo "======================================================"
echo " [ACTION REQUIRED] Add this public key to GitHub:"
echo " 1. Open: https://github.com/settings/keys"
echo " 2. Click 'New SSH key', set a title (e.g. Ubuntu-Server)"
echo " 3. Copy the string below and paste it into 'Key':"
echo "======================================================"
echo ""
cat "${KEY_PATH}.pub"
echo ""
echo "======================================================"
echo ""

# 7. Verification Test
read -n 1 -s -r -p "After saving the key on GitHub, press any key to test connection..."
echo ""
echo "[INFO] Verifying authentication with GitHub..."
ssh -T git@github.com 2>&1 | grep -i "successfully authenticated" >/dev/null
if [ $? -eq 0 ]; then
    echo "[SUCCESS] GitHub SSH connection verified successfully!"
else
    echo "[NOTICE] If you saw 'Hi <username>! You've successfully authenticated', it is working."
    echo "Otherwise, check if the public key was correctly saved on GitHub."
fi
