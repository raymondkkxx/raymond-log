import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getRow, runQuery } from './db.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'raymond_log_secret_key_2026_safe'
export const INVITE_CODE = '20040818'
export const TOKEN_EXPIRY = '180d' // 180 天长期有效

// 签发 JWT
export const signToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

// 校验中间件 (Express)
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌，请先登录' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '登录状态已失效或已过期，请重新登录' })
    }
    req.user = user
    next()
  })
}

// 注册新用户
export const registerUser = async (username, password, inviteCode) => {
  if (inviteCode !== INVITE_CODE) {
    throw new Error('邀请码无效，请向站长获取正确的专属邀请码')
  }

  const cleanUsername = username?.trim()
  if (!cleanUsername || cleanUsername.length < 2) {
    throw new Error('用户名长度至少需要 2 个字符')
  }

  if (!password || password.length < 4) {
    throw new Error('密码长度至少需要 4 位')
  }

  const existing = await getRow('SELECT id FROM users WHERE username = ?', [cleanUsername])
  if (existing) {
    throw new Error('该用户名已被注册，请尝试其他用户名')
  }

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)

  const result = await runQuery(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [cleanUsername, passwordHash]
  )

  const newUser = { id: result.id, username: cleanUsername }
  const token = signToken(newUser)
  return { user: newUser, token }
}

// 登录验证
export const loginUser = async (username, password) => {
  const cleanUsername = username?.trim()
  const user = await getRow('SELECT * FROM users WHERE username = ?', [cleanUsername])
  if (!user) {
    throw new Error('用户名或密码错误')
  }

  const validPassword = await bcrypt.compare(password, user.password_hash)
  if (!validPassword) {
    throw new Error('用户名或密码错误')
  }

  const token = signToken(user)
  return { user: { id: user.id, username: user.username }, token }
}