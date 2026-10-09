import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isAuthModalOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = authMode === 'login' ? { username, password } : { username, password, inviteCode }

    try {
      const res = await apiRequest<{ token: string; user: { username: string } }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      login(res.token, res.user.username)
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal()
      }}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-neutral-900 border border-white/15 p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login')
                setError(null)
              }}
              className={`text-sm font-bold pb-1 transition-colors cursor-pointer border-b-2 ${
                authMode === 'login'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register')
                setError(null)
              }}
              className={`text-sm font-bold pb-1 transition-colors cursor-pointer border-b-2 ${
                authMode === 'register'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              注册
            </button>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="text-neutral-400 hover:text-white p-1 rounded-full cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs text-neutral-400 mb-1 font-medium">用户名</label>
            <input
              type="text"
              required
              placeholder="输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700/80 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1 font-medium">密码</label>
            <input
              type="password"
              required
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700/80 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {authMode === 'register' && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-medium">
                邀请码 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="20040818"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700/80 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[10px] text-neutral-400 mt-1">本站仅限受邀访问，请输入正确的 8 位邀请码。</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 py-2.5 text-sm font-semibold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? '请稍候...' : authMode === 'login' ? '登 录' : '注 册 并 登 录'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}