import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'

import { initDatabase, getRow, runQuery } from './db.js'
import {
  JWT_SECRET,
  authenticateToken,
  registerUser,
  loginUser,
} from './auth.js'
import { DEFAULT_DEADLINES, DEFAULT_IMPOSSIBLE_LIST } from './defaultTemplates.js'
import { initBackupScheduler, backupUserData } from './backup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3300
const app = express()
const server = http.createServer(app)

// 确保上传与备份目录存在
const UPLOADS_DIR = path.join(__dirname, '../uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

app.use(cors())
app.use(express.json({ limit: '20mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

// 图片持久化上传中间件
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webp'
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `img_${uniqueSuffix}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
})

// 初始化 Socket.io 长连接
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Socket.io JWT 鉴权中间件
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token
  if (!token) return next(new Error('Authentication error: Missing token'))

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'))
    socket.user = decoded
    next()
  })
})

io.on('connection', (socket) => {
  const userId = socket.user.id
  const roomName = `user_${userId}`
  socket.join(roomName)
  console.log(`[Socket] 🟢 设备已连入专属房间: ${roomName} (用户: ${socket.user.username})`)

  // 监听客户端通过 WebSocket 发送的增量修改
  socket.on('client_update', async ({ namespace, data, clientId }) => {
    try {
      const dataStr = JSON.stringify(data)
      await runQuery(
        `INSERT INTO user_data (user_id, namespace, data_json, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, namespace) DO UPDATE SET
           data_json = excluded.data_json,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, namespace, dataStr]
      )

      console.log(`[Socket] 📡 收到来自设备 ${clientId || '匿名'} 的更新，向房间 ${roomName} 广播 (${namespace})`)

      // 广播给同房间的其他设备
      socket.to(roomName).emit('server_sync', {
        namespace,
        data,
        sourceClientId: clientId || null,
      })
    } catch (err) {
      console.error('[Socket] 同步写入数据库失败:', err)
    }
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] ⚪ 设备断开长连接: ${roomName}`)
  })
})

// ================= RESTful API 路由 =================

// 1. 注册新账号
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, inviteCode } = req.body
    const result = await registerUser(username, password, inviteCode)

    // 新用户首次注册自动注入默认示范数据模板
    await runQuery(
      `INSERT INTO user_data (user_id, namespace, data_json) VALUES (?, 'deadlines', ?), (?, 'impossible_list', ?)`,
      [
        result.user.id,
        JSON.stringify(DEFAULT_DEADLINES),
        result.user.id,
        JSON.stringify(DEFAULT_IMPOSSIBLE_LIST),
      ]
    )

    console.log(`[Auth] 🆕 新用户注册成功: ${result.user.username}`)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// 2. 账号登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const result = await loginUser(username, password)
    console.log(`[Auth] 🔑 用户登录成功: ${result.user.username}`)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// 3. 图片外链化持久上传
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未接收到有效图片文件' })
  }
  const relativeUrl = `/uploads/${req.file.filename}`
  console.log(`[Upload] 📸 图片已持久化保存至磁盘: ${relativeUrl}`)
  res.json({ url: relativeUrl })
})

// 4. 拉取数据 (GET)
app.get('/api/data/:namespace', authenticateToken, async (req, res) => {
  try {
    const { namespace } = req.params
    const row = await getRow(
      'SELECT data_json FROM user_data WHERE user_id = ? AND namespace = ?',
      [req.user.id, namespace]
    )

    if (row && row.data_json) {
      return res.json({ data: JSON.parse(row.data_json) })
    }

    const fallback = namespace === 'deadlines' ? DEFAULT_DEADLINES : DEFAULT_IMPOSSIBLE_LIST
    await runQuery(
      'INSERT OR IGNORE INTO user_data (user_id, namespace, data_json) VALUES (?, ?, ?)',
      [req.user.id, namespace, JSON.stringify(fallback)]
    )
    res.json({ data: fallback })
  } catch (err) {
    res.status(500).json({ error: '拉取数据异常: ' + err.message })
  }
})

// 5. 保存数据 (POST)
app.post('/api/data/:namespace', authenticateToken, async (req, res) => {
  try {
    const { namespace } = req.params
    const { data, clientId } = req.body

    const dataStr = JSON.stringify(data)
    await runQuery(
      `INSERT INTO user_data (user_id, namespace, data_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, namespace) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, namespace, dataStr]
    )

    const roomName = `user_${req.user.id}`
    console.log(`[HTTP] 📡 收到来自设备 ${clientId || '匿名'} 的保存请求，已广播至 ${roomName} (${namespace})`)

    // 向该用户专属房间推送实时广播
    io.to(roomName).emit('server_sync', {
      namespace,
      data,
      sourceClientId: clientId || null,
    })

    // 触发单用户冷备
    backupUserData(req.user.id)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: '保存数据异常: ' + err.message })
  }
})

// 兼容原版路径
app.get('/api/deadlines', authenticateToken, (req, res) => {
  req.url = '/api/data/deadlines'
  app.handle(req, res)
})
app.post('/api/deadlines', authenticateToken, (req, res) => {
  req.body = { data: req.body.items, clientId: req.body.clientId || null }
  req.url = '/api/data/deadlines'
  app.handle(req, res)
})
app.get('/api/storage/:namespace', authenticateToken, (req, res) => {
  req.url = `/api/data/${req.params.namespace}`
  app.handle(req, res)
})
app.post('/api/storage/:namespace', authenticateToken, (req, res) => {
  req.url = `/api/data/${req.params.namespace}`
  app.handle(req, res)
})

// 6. 生产静态网页托管
const DIST_DIR = path.join(__dirname, '../dist')
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 60px;">
        <h2>raymond log 后端服务正在平稳运行 (端口: ${PORT})</h2>
        <p style="color: #666;">等待前端生产包构建完成。</p>
      </div>
    `)
  })
}

// 启动监听
server.listen(PORT, '0.0.0.0', async () => {
  await initDatabase()
  initBackupScheduler()
  console.log(`
  ==============================================
  🚀 raymond log 服务已就绪
  🌐 监听地址: http://0.0.0.0:${PORT}
  📁 图片存储: ${UPLOADS_DIR}
  💾 备份目录: ${path.join(__dirname, '../backups')}
  ==============================================
  `)
})