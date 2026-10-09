#!/usr/bin/env bash

# ==============================================================================
#      无人值守定时 Git 自动推送脚本 (适配 Crontab / 宝塔计划任务)
#      运行模式: 完全非交互 (静默运行并写入日志)
# ==============================================================================

# 1. 补齐系统环境变量（防止 Cron 运行时找不到 git 命令）
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 2. 动态向上追溯两级目录解析项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"

# 日志输出文件（保存在项目根目录下，便于宝塔面板随时查看）
LOG_FILE="$PROJECT_ROOT/auto_push.log"

echo "------------------------------------------------------------------" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行自动同步任务" >> "$LOG_FILE"

# 3. 校验项目根目录与 .git 仓库有效性
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] 未找到有效的 Git 仓库: $PROJECT_ROOT" >> "$LOG_FILE"
    exit 1
fi

cd "$PROJECT_ROOT" || {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] 无法进入目标目录: $PROJECT_ROOT" >> "$LOG_FILE"
    exit 1
}

# 4. 获取当前本地分支名称
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH="main"
fi

# 5. 检查本地是否有新文件或改动
set +e
HAS_CHANGES="$(git status --porcelain 2>/dev/null)"
set -e

if [ -n "$HAS_CHANGES" ]; then
    git add -A :/ >> "$LOG_FILE" 2>&1
    COMMIT_MSG="Auto sync: $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] 本地改动已自动提交: $COMMIT_MSG" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] 工作区干净，没有新文件改动需要提交" >> "$LOG_FILE"
fi

# 6. 依次静默推送到有效远程仓库 (优先检测 gitee 与 origin)
REMOTES_TO_PUSH=()
if git remote | grep -qw "gitee"; then
    REMOTES_TO_PUSH+=("gitee")
fi
if git remote | grep -qw "origin"; then
    REMOTES_TO_PUSH+=("origin")
fi

if [ ${#REMOTES_TO_PUSH[@]} -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] 未检测到名为 gitee 或 origin 的远程仓库" >> "$LOG_FILE"
    exit 0
fi

for REMOTE in "${REMOTES_TO_PUSH[@]}"; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在推送到远端 -> $REMOTE/$CURRENT_BRANCH..." >> "$LOG_FILE"
    set +e
    git push "$REMOTE" "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    PUSH_CODE=$?
    set -e

    if [ $PUSH_CODE -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] 已成功同步至 $REMOTE/$CURRENT_BRANCH" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] 推送到 $REMOTE 失败，退出码: $PUSH_CODE" >> "$LOG_FILE"
    fi
done

# 7. 日志文件自动截断（保留最新 500 行，防止日志文件长期膨胀）
if [ -f "$LOG_FILE" ]; then
    tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 定时同步任务执行结束" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
