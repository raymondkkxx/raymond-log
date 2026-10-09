import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAll } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BACKUP_DIR = path.join(__dirname, '../backups')
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// 执行指定用户的快照备份
export const backupUserData = async (userId) => {
  try {
    const rows = await getAll('SELECT namespace, data_json FROM user_data WHERE user_id = ?', [userId])
    if (!rows || rows.length === 0) return

    const backupData = {}
    rows.forEach((r) => {
      try {
        backupData[r.namespace] = JSON.parse(r.data_json)
      } catch {
        backupData[r.namespace] = r.data_json
      }
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    const filePath = path.join(BACKUP_DIR, `user_${userId}_${dateStr}.json`)
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
  } catch (err) {
    console.error(`用户 ${userId} 冷备失败:`, err)
  }
}

// 执行全量用户定时冷备
export const backupAllUsers = async () => {
  try {
    const users = await getAll('SELECT id FROM users')
    for (const u of users) {
      await backupUserData(u.id)
    }
    console.log(`[${new Date().toLocaleTimeString()}] ✅ 全量冷备完成，已归档至 ${BACKUP_DIR}`)
  } catch (err) {
    console.error('全量冷备执行异常:', err)
  }
}

// 启动定时器：每 24 小时自动触发一次快照备份
export const initBackupScheduler = () => {
  // 每 24 小时备份一次
  setInterval(backupAllUsers, 24 * 60 * 60 * 1000)
}