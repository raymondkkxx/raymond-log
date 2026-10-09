import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { CLIENT_ID } from '../lib/api'

interface UseSocketSyncOptions<T> {
  namespace: 'deadlines' | 'impossible_list'
  onRemoteSync: (data: T) => void
  onReconnect?: () => void
}

export function useSocketSync<T>({
  namespace,
  onRemoteSync,
  onReconnect,
}: UseSocketSyncOptions<T>) {
  const { token, isLoggedIn } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const onRemoteSyncRef = useRef(onRemoteSync)
  onRemoteSyncRef.current = onRemoteSync

  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    // 未登录的访客模式不建立 WebSocket
    if (!isLoggedIn || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // 开发环境直连 3300 端口，生产环境连接当前站点域名
    const isDev = typeof window !== 'undefined' && (window.location.port === '5173' || (import.meta as any).env?.DEV)
    const socketUrl = isDev ? 'http://localhost:3300' : window.location.origin
    
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log(`%c⚡ [Socket] 成功连接至服务器 3300 房间 (${namespace})`, 'color: #10b981; font-weight: bold;')
      if (onReconnectRef.current) {
        onReconnectRef.current()
      }
    })

    socket.on('connect_error', (err) => {
      console.warn(`%c⚠️ [Socket] 连接异常: ${err.message}`, 'color: #f59e0b;')
    })

    // 接收来自服务器向该用户专属房间推送的广播
    socket.on('server_sync', (payload: { namespace: string; data: T; sourceClientId?: string }) => {
      // 过滤当前设备自身发出的回声
      if (payload.sourceClientId === CLIENT_ID) return

      if (payload.namespace === namespace) {
        console.log(`%c📥 [Socket] 收到另一端推送的实时更新 (${namespace})!`, 'color: #3b82f6; font-weight: bold;')
        onRemoteSyncRef.current(payload.data)
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isLoggedIn, token, namespace])

  // 主动向服务端发射数据变更
  const emitLocalChange = (data: T) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('client_update', {
        namespace,
        data,
        clientId: CLIENT_ID,
      })
    }
  }

  return { emitLocalChange }
}