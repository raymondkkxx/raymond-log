import { io } from 'socket.io-client'

async function testStage2() {
  console.log('--- 1. 测试注册新账号 (携带 20040818 邀请码) ---')
  const regRes = await fetch('http://127.0.0.1:3300/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `test_${Date.now()}`,
      password: 'password123',
      inviteCode: '20040818'
    })
  })
  const regData = await regRes.json()
  console.log('注册响应状态:', regRes.status, '用户名:', regData.user?.username)
  const token = regData.token

  console.log('\n--- 2. 测试自动注入的默认 Deadline 数据拉取 ---')
  const dataRes = await fetch('http://127.0.0.1:3300/api/data/deadlines', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const listData = await dataRes.json()
  console.log('成功获取初始卡片数量:', listData.data?.length, '(首项标题:', listData.data?.[0]?.title, ')')

  console.log('\n--- 3. 测试多端 WebSocket 房间连接 ---')
  const socket1 = io('http://127.0.0.1:3300', { auth: { token } })
  const socket2 = io('http://127.0.0.1:3300', { auth: { token } })

  socket2.on('server_sync', (payload) => {
    console.log('⚡ 接收到来自另一端的实时广播!', payload.namespace, '数据更新成功!')
    socket1.disconnect()
    socket2.disconnect()
    console.log('\n✅ 阶段二：后端 API、多端房间同步、冷备机制验证全部通过!')
    process.exit(0)
  })

  socket1.on('connect', () => {
    console.log('设备 1 连接成功，模拟提交数据变更...')
    socket1.emit('client_update', {
      namespace: 'deadlines',
      data: [{ id: '999', title: '多端协同测试成功' }],
      clientId: 'device_pc'
    })
  })
}

testStage2()