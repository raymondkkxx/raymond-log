import React from 'react'
import { useAuth } from '../context/AuthContext'

interface NavbarProps {
  activeTab: 'deadline' | 'impossible'
  onTabChange: (tab: 'deadline' | 'impossible') => void
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { isLoggedIn, currentUser, openAuthModal, logout } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/75 dark:bg-neutral-900/80 border-b border-neutral-200/60 dark:border-neutral-800/80 transition-colors">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* 左侧：品牌标题 raymond log */}
        <div className="flex items-center gap-6">
          <a
            href="#deadline"
            onClick={(e) => {
              e.preventDefault()
              onTabChange('deadline')
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 select-none hover:opacity-85 transition-opacity"
          >
            raymond log
          </a>

          {/* 切换 Tab */}
          <nav className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-full text-xs font-semibold">
            <button
              onClick={() => onTabChange('deadline')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'deadline'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Deadline
            </button>
            <button
              onClick={() => onTabChange('impossible')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'impossible'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Impossible List
            </button>
          </nav>
        </div>

        {/* 右侧：极简登录/用户信息 (无任何呼吸灯与小圆点) */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {currentUser}
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <button
                onClick={logout}
                className="text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer text-xs"
              >
                log out
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 transition-all cursor-pointer"
            >
              log in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}