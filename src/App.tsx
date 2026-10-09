import React, { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { Navbar } from './components/Navbar'
import { AuthModal } from './components/AuthModal'
import DeadlinePage from './components/DeadlinePage'
import ImpossibleListPage from './components/ImpossibleListPage'

const TAB_STORAGE_KEY = 'raymond_log_preferred_tab'

// 精准识别 iOS 设备 (iPhone, iPad, iPod) 及其他移动端
function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(ua)
  return isIOS || isAndroid || /mobile/i.test(ua)
}

function getInitialTab(): 'deadline' | 'impossible' {
  if (typeof window === 'undefined') return 'deadline'

  // 1. 优先读取当前设备的历史偏好（手机和电脑各自独立记忆）
  const saved = localStorage.getItem(TAB_STORAGE_KEY)
  if (saved === 'impossible' || saved === 'deadline') {
    return saved
  }

  // 2. 首次打开且无记忆：iOS/手机端直接默认进入 Impossible List，电脑端默认进入 Deadline
  return isMobileDevice() ? 'impossible' : 'deadline'
}

function MainLayout() {
  const [activeTab, setActiveTab] = useState<'deadline' | 'impossible'>(getInitialTab)

  // 当用户在顶部导航栏切换时，自动固化为该设备的启动默认页
  const handleTabChange = (tab: 'deadline' | 'impossible') => {
    setActiveTab(tab)
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 selection:bg-blue-500/20">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="w-full">
        {/* 保活切换：确保页面切换时不丢失各自的滚动高度与输入状态 */}
        <div style={{ display: activeTab === 'deadline' ? 'block' : 'none' }}>
          <DeadlinePage />
        </div>
        <div style={{ display: activeTab === 'impossible' ? 'block' : 'none' }}>
          <ImpossibleListPage />
        </div>
      </main>
      <AuthModal />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  )
}