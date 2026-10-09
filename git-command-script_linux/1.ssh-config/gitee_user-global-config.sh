#!/usr/bin/env bash

# ==============================================================================
# Raymond Blog - Git 自动同步与定时推送向导 (部署于项目两级子目录)
# ==============================================================================

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BLUE="\033[36m"
RESET="\033[0m"

echo -e "${BLUE}====================================================${RESET}"
echo -e "${BLUE}      Raymond Blog - Git 自动同步与定时推送向导      ${RESET}"
echo -e "${BLUE}====================================================${RESET}"

# 1. 动态向上追溯两级目录获取项目根目录
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$CURRENT_DIR/../.." 2>/dev/null && pwd)"

echo -e "当前脚本位置: ${YELLOW}$CURRENT_DIR${RESET}"
echo -e "识别项目根目录: ${GREEN}$PROJECT_ROOT${RESET}\n"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo -e "${RED}[错误] 向上两级目录未检测到 .git 仓库，请确认存放路径！${RESET}"
    exit 1
fi

cd "$PROJECT_ROOT"

# 2. 交互配置 Git 提交者身份
DEFAULT_USER="raymondkkxx"
DEFAULT_EMAIL="raymondkkxx@users.noreply.gitee.com"

echo -e "${YELLOW}>> 步骤 1/4: 配置 Git 提交作者身份${RESET}"
read -rp "请输入 Git 用户名 [默认: $DEFAULT_USER]: " INPUT_USER
GIT_USER="${INPUT_USER:-$DEFAULT_USER}"

read -rp "请输入 Git 提交邮箱 [默认: $DEFAULT_EMAIL]: " INPUT_EMAIL
GIT_EMAIL="${INPUT_EMAIL:-$DEFAULT_EMAIL}"

git config --global user.name "$GIT_USER"
git config --global user.email "$GIT_EMAIL"
git config --global credential.helper store
git config user.name "$GIT_USER"
git config user.email "$GIT_EMAIL"

echo -e "${GREEN}[OK] Git 提交身份已就绪: ${GIT_USER} <${GIT_EMAIL}>${RESET}\n"

# 3. 锁定本地 main 分支（彻底解决 detached HEAD 游离状态）
echo -e "${YELLOW}>> 步骤 2/4: 检查并纠正本地分支${RESET}"
git branch -f main HEAD 2>/dev/null || true
git checkout main 2>/dev/null || true
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo "main")"
echo -e "${GREEN}[OK] 当前工作分支已锁定为: $CURRENT_BRANCH${RESET}\n"

# 4. 在当前目录下生成/更新 auto_push.sh
echo -e "${YELLOW}>> 步骤 3/4: 部署定时推送脚本 auto_push.sh${RESET}"
PUSH_SCRIPT="$CURRENT_DIR/auto_push.sh"

cat << 'PUSH_EOF' > "$PUSH_SCRIPT"
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
PUSH_EOF

chmod +x "$PUSH_SCRIPT"
echo -e "${GREEN}[OK] 定时脚本已部署至: $PUSH_SCRIPT${RESET}\n"

# 5. 执行端到端连通性测试
echo -e "${YELLOW}>> 步骤 4/4: 触发自动推送实测${RESET}"
echo "probe_test_at_$(date '+%Y%m%d_%H%M%S')" > "$PROJECT_ROOT/cron_probe.txt"
"$PUSH_SCRIPT"

if grep -q "SUCCESS" "$PROJECT_ROOT/auto_push.log"; then
    echo -e "\n${GREEN}====================================================${RESET}"
    echo -e "${GREEN}     测试通过！代码已成功提交并推送到 Gitee！        ${RESET}"
    echo -e "${GREEN}====================================================${RESET}"
    echo -e "宝塔计划任务配置参数："
    echo -e "  • 任务类型: ${YELLOW}Shell 脚本${RESET}"
    echo -e "  • 任务名称: ${YELLOW}自动备份博客代码到 Gitee${RESET}"
    echo -e "  • 执行周期: ${YELLOW}每天 (例如 03:00) 或 每 N 小时${RESET}"
    echo -e "  • 执行用户: ${GREEN}root${RESET}"
    echo -e "  • 脚本内容: ${GREEN}$PUSH_SCRIPT${RESET}\n"
else
    echo -e "\n${RED}====================================================${RESET}"
    echo -e "${RED}  推送未完全成功，请查看日志末尾排查：             ${RESET}"
    echo -e "${RED}====================================================${RESET}"
    tail -n 15 "$PROJECT_ROOT/auto_push.log"
fi