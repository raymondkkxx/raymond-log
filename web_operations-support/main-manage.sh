#!/usr/bin/env bash

# ==============================================================================
# Service Management Script for raymond-log
# Supports interactive menu, CLI arguments, and execution from parent directory
# ==============================================================================

set -e

# Resolve the real path of this script (handles symlinks properly)
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# Detect project root directory (checks current folder or parent folder)
if [ -f "${SCRIPT_DIR}/server/server.js" ]; then
    PROJECT_ROOT="${SCRIPT_DIR}"
elif [ -f "${SCRIPT_DIR}/../server/server.js" ]; then
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
    # Fallback default: parent directory
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

# Application configuration
APP_NAME="raymond-log"
APP_ENTRY="server/server.js"

# Switch working directory to project root
cd "${PROJECT_ROOT}"

# Helper function: verify PM2 installation
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo "[ERROR] PM2 is not installed or not found in system PATH."
        echo "[INFO] Run setup or install manually: sudo npm install -g pm2"
        exit 1
    fi
}

# Helper function: verify entry file existence
check_entry() {
    if [ ! -f "${APP_ENTRY}" ]; then
        echo "[ERROR] Application entry file '${APP_ENTRY}' not found in: ${PROJECT_ROOT}"
        exit 1
    fi
}

# Action: Start application
start_app() {
    check_pm2
    check_entry
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        echo "[INFO] Application '${APP_NAME}' is already managed by PM2. Restarting..."
        pm2 restart "${APP_NAME}"
    else
        echo "[INFO] Starting '${APP_NAME}' using entry file '${APP_ENTRY}'..."
        pm2 start "${APP_ENTRY}" --name "${APP_NAME}"
    fi
    pm2 save
    echo "[INFO] Application started and state persisted."
}

# Action: Stop application
stop_app() {
    check_pm2
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        echo "[INFO] Stopping application '${APP_NAME}'..."
        pm2 stop "${APP_NAME}"
        pm2 save
        echo "[INFO] Application '${APP_NAME}' stopped."
    else
        echo "[WARN] Application '${APP_NAME}' is not currently running."
    fi
}

# Action: Hard restart application
restart_app() {
    check_pm2
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        echo "[INFO] Restarting application '${APP_NAME}'..."
        pm2 restart "${APP_NAME}"
        pm2 save
        echo "[INFO] Application '${APP_NAME}' restarted."
    else
        echo "[INFO] Application '${APP_NAME}' not found in PM2. Launching new instance..."
        start_app
    fi
}

# Action: Zero-downtime graceful reload
reload_app() {
    check_pm2
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        echo "[INFO] Reloading application '${APP_NAME}' with zero downtime..."
        pm2 reload "${APP_NAME}"
        pm2 save
        echo "[INFO] Application '${APP_NAME}' successfully reloaded."
    else
        echo "[INFO] Application '${APP_NAME}' not running. Launching new instance..."
        start_app
    fi
}

# Action: Display status & health
status_app() {
    check_pm2
    echo "=========================================================="
    echo " Project Root : ${PROJECT_ROOT}"
    echo " App Name     : ${APP_NAME}"
    echo " Entry Point  : ${APP_ENTRY}"
    echo "=========================================================="
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        pm2 describe "${APP_NAME}"
    else
        echo "[INFO] Process '${APP_NAME}' is not active. Current PM2 list:"
        pm2 list
    fi
}

# Action: Stream real-time logs
logs_app() {
    check_pm2
    echo "[INFO] Streaming logs for '${APP_NAME}' (Press Ctrl+C to return)..."
    pm2 logs "${APP_NAME}" --lines 100
}

# Action: Terminal monitoring dashboard
monitor_app() {
    check_pm2
    pm2 monit
}

# Action: Initial environment setup & link creation
setup_env() {
    echo "=========================================================="
    echo " Initializing environment for ${PROJECT_ROOT}..."
    echo "=========================================================="

    if ! command -v pm2 &> /dev/null; then
        echo "[INFO] Installing PM2 globally..."
        sudo npm install -g pm2
    else
        echo "[INFO] PM2 is already installed."
    fi

    if [ -f "package.json" ]; then
        echo "[INFO] Installing npm dependencies..."
        npm install
    fi

    echo "[INFO] Creating shortcut in parent directory..."
    ln -sf "${SCRIPT_DIR}/main-manage.sh" "${PROJECT_ROOT}/manage.sh"
    echo "[INFO] Shortcut created: ${PROJECT_ROOT}/manage.sh"

    echo "[INFO] Configuring system startup hook..."
    pm2 startup || true

    echo "[INFO] Setup completed."
}

# Interactive Menu
interactive_menu() {
    while true; do
        echo ""
        echo "=========================================================="
        echo "       Raymond-Log Service Management Center             "
        echo "       Root: ${PROJECT_ROOT}"
        echo "=========================================================="
        echo "  1) Start application        (start)"
        echo "  2) Stop application         (stop)"
        echo "  3) Restart application      (restart)"
        echo "  4) Graceful reload          (reload)"
        echo "  5) Show status & health     (status)"
        echo "  6) View real-time logs      (logs)"
        echo "  7) Resource monitor UI      (mon)"
        echo "  8) Setup environment        (setup)"
        echo "  0) Exit"
        echo "=========================================================="
        read -r -p "Enter command or number [0-8]: " user_choice

        case "${user_choice}" in
            1|start)
                start_app
                ;;
            2|stop)
                stop_app
                ;;
            3|restart)
                restart_app
                ;;
            4|reload)
                reload_app
                ;;
            5|status)
                status_app
                ;;
            6|logs)
                logs_app
                ;;
            7|mon|monitor)
                monitor_app
                ;;
            8|setup)
                setup_env
                ;;
            0|q|quit|exit)
                echo "Exiting management console. Goodbye!"
                exit 0
                ;;
            "")
                # Pressing Enter directly does nothing
                ;;
            *)
                echo "[ERROR] Unknown option: '${user_choice}'. Please enter 0-8 or a valid command name."
                ;;
        esac
    done
}

# Main Execution Entry
if [ -z "$1" ]; then
    # No argument provided: open interactive menu
    interactive_menu
else
    # Argument provided: execute directly
    case "$1" in
        start)   start_app ;;
        stop)    stop_app ;;
        restart) restart_app ;;
        reload)  reload_app ;;
        status)  status_app ;;
        logs)    logs_app ;;
        mon|monitor) monitor_app ;;
        setup)   setup_env ;;
        *)
            echo "Usage: $0 {start|stop|restart|reload|status|logs|mon|setup}"
            exit 1
            ;;
    esac
fi