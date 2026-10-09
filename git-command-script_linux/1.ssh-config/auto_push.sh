#!/usr/bin/env bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
LOG_FILE="$PROJECT_ROOT/auto_push.log"

echo "------------------------------------------------------------------" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行自动同步任务" >> "$LOG_FILE"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] 未找到有效的 Git 仓库: $PROJECT_ROOT" >> "$LOG_FILE"
    exit 1
fi

cd "$PROJECT_ROOT" || exit 1

# 1. 确保锁定 main 分支
git checkout main >> "$LOG_FILE" 2>&1 || true
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo "main")"

# 2. 检查是否有本地更新并提交
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    git add -A :/ >> "$LOG_FILE" 2>&1
    COMMIT_MSG="Auto sync: $(date '+%Y-%m-%d %H:%M:%S')"
    git -c user.name="raymondkkxx" -c user.email="raymondkkxx@users.noreply.gitee.com" commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] 本地改动已自动提交: $COMMIT_MSG" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] 工作区干净，无新文件改动" >> "$LOG_FILE"
fi

# 3. 动态寻找远程仓库并同步
REMOTES=()
git remote | grep -qw "origin" && REMOTES+=("origin")
git remote | grep -qw "gitee" && REMOTES+=("gitee")

for REMOTE in "${REMOTES[@]}"; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在处理远端 -> $REMOTE/$CURRENT_BRANCH..." >> "$LOG_FILE"
    git pull "$REMOTE" "$CURRENT_BRANCH" --no-rebase --no-edit >> "$LOG_FILE" 2>&1 || true
    
    git push "$REMOTE" "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    if [ $? -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] 已成功同步至 $REMOTE/$CURRENT_BRANCH" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] 推送到 $REMOTE 失败" >> "$LOG_FILE"
    fi
done

# 4. 日志自动截断（保留最新 300 行）
[ -f "$LOG_FILE" ] && tail -n 300 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 定时同步任务执行结束" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
