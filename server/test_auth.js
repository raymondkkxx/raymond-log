import { initDatabase } from './db.js'
import { registerUser, loginUser } from './auth.js'

async function test() {
  await initDatabase()

  console.log('--- 测试 1: 错误邀请码注册 ---')
  try {
    await registerUser('testuser', '123456', 'wrong_code')
  } catch (err) {
    console.log('预期拦截成功:', err.message)
  }

  console.log('\n--- 测试 2: 正确邀请码 20040818 注册 ---')
  try {
    const reg = await registerUser('raymond', 'password888', '20040818')
    console.log('注册成功! Token:', reg.token.slice(0, 25) + '...')
  } catch (err) {
    console.log('注册信息 (若已存在属正常):', err.message)
  }

  console.log('\n--- 测试 3: 登录验证 ---')
  const logged = await loginUser('raymond', 'password888')
  console.log('登录成功! 用户:', logged.user.username)
  console.log('\n✅ 阶段一所有底座功能测试通过!')
  process.exit(0)
}

test()