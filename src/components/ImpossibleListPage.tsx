'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ImpossibleCategory,
  ImpossibleItem,
  ImpossibleListData,
  DEFAULT_IMPOSSIBLE_CATEGORIES,
  DEFAULT_ZERO_IN_ON,
} from '../lib/defaultData'
import { useAuth } from '../context/AuthContext'
import { apiRequest, saveUserData } from '../lib/api'
import { useSocketSync } from '../hooks/useSocketSync'

const STORAGE_KEY = 'site_impossible_list_v9'

function formatAppleDate(date: Date = new Date()): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const d = date.getDate()
  const m = months[date.getMonth()]
  const y = date.getFullYear()

  let suffix = 'th'
  if (d % 10 === 1 && d !== 11) suffix = 'st'
  else if (d % 10 === 2 && d !== 12) suffix = 'nd'
  else if (d % 10 === 3 && d !== 13) suffix = 'rd'

  return `${m} ${d}${suffix}, ${y}`
}

export default function ImpossibleListPage() {
  const { isLoggedIn } = useAuth()
  const [categories, setCategories] = useState<ImpossibleCategory[]>(DEFAULT_IMPOSSIBLE_CATEGORIES)
  const [zeroInOnIds, setZeroInOnIds] = useState<string[]>(DEFAULT_ZERO_IN_ON)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null)

  // 事项拖拽排序状态
  const [draggedItemInfo, setDraggedItemInfo] = useState<{ catId: string; chainIndex: number } | null>(null)
  const [dragOverItemInfo, setDragOverItemInfo] = useState<{ catId: string; chainIndex: number } | null>(null)
  const touchDragTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isTouchDraggingRef = useRef(false)

  // 双击手势状态记录（用于兼容移动端手指快速双击和电脑端点击）
  const lastTapMapRef = useRef<Map<string, number>>(new Map())
  const lastToggleTimeRef = useRef<number>(0)

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    catId: string
    itemId: string
  } | null>(null)

  // Modals & Popovers
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ImpossibleCategory | null>(null)
  const [isZeroInOnModalOpen, setIsZeroInOnModalOpen] = useState(false)
  const [editingItemData, setEditingItemData] = useState<{
    catId: string
    item: ImpossibleItem
  } | null>(null)

  const [nextStageAnchor, setNextStageAnchor] = useState<{
    catId: string
    parentItemId: string
    x: number
    y: number
  } | null>(null)

  // 分类管理器的拖拽状态
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null)
  const [dragOverCatIndex, setDragOverCatIndex] = useState<number | null>(null)

  // Form Fields
  const [nextStageTitle, setNextStageTitle] = useState('')
  const [nextStageLinkText, setNextStageLinkText] = useState('')
  const [nextStageLinkUrl, setNextStageLinkUrl] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const appleFontFamily =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

  // 拉取数据
  const loadData = async () => {
    if (isLoggedIn) {
      try {
        const res = await apiRequest<{ data: ImpossibleListData }>('/api/data/impossible_list')
        if (res.data && Array.isArray(res.data.categories) && res.data.categories.length > 0) {
          setCategories(res.data.categories)
          setZeroInOnIds(res.data.zeroInOnIds || [])
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data))
          return
        }
      } catch (err) {
        console.warn('拉取云端数据失败，回退到本地缓存', err)
      }
    }

    const local = localStorage.getItem(STORAGE_KEY)
    if (local) {
      try {
        const parsed = JSON.parse(local)
        if (parsed.categories && parsed.categories.length > 0) {
          setCategories(parsed.categories)
          setZeroInOnIds(parsed.zeroInOnIds || [])
          return
        }
      } catch {
        // Fallback
      }
    }
    setCategories(DEFAULT_IMPOSSIBLE_CATEGORIES)
    setZeroInOnIds(DEFAULT_ZERO_IN_ON)
  }

  // 挂载 Socket.io 房间同步
  const { emitLocalChange } = useSocketSync<ImpossibleListData>({
    namespace: 'impossible_list',
    onRemoteSync: (remoteData) => {
      if (
        !editingCategory &&
        !editingItemData &&
        !nextStageAnchor &&
        !isCategoryManagerOpen &&
        !isZeroInOnModalOpen
      ) {
        setCategories(remoteData.categories)
        setZeroInOnIds(remoteData.zeroInOnIds || [])
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData))
      }
    },
    onReconnect: () => {
      loadData()
    },
  })

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [isLoggedIn])

  useEffect(() => {
    const handleClose = () => setContextMenu(null)
    window.addEventListener('click', handleClose)
    window.addEventListener('scroll', handleClose)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('scroll', handleClose)
    }
  }, [])

  // 数据持久化
  const persistData = async (
    newCategories: ImpossibleCategory[],
    newZeroIds: string[] = zeroInOnIds
  ) => {
    setCategories(newCategories)
    setZeroInOnIds(newZeroIds)
    const payload: ImpossibleListData = { categories: newCategories, zeroInOnIds: newZeroIds }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    if (isLoggedIn) {
      emitLocalChange(payload)
      try {
        await saveUserData('impossible_list', payload)
      } catch (err) {
        console.error('Impossible List 同步至云端失败:', err)
      }
    }
  }

  // 事项拖拽重新排序算法
  const reorderCategoryChains = (catId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const targetCat = categories.find((c) => c.id === catId)
    if (!targetCat) return

    const rootItems = targetCat.items.filter((it) => !it.parentItemId)
    const chains: ImpossibleItem[][] = rootItems.map((root) => {
      const chain: ImpossibleItem[] = []
      const visited = new Set<string>()
      let cur: ImpossibleItem | undefined = root
      while (cur && !visited.has(cur.id)) {
        visited.add(cur.id)
        chain.push(cur)
        cur = targetCat.items.find((i) => i.id === cur?.nextItemId)
      }
      return chain
    })

    if (fromIndex < 0 || fromIndex >= chains.length || toIndex < 0 || toIndex >= chains.length) return

    const updatedChains = [...chains]
    const [movedChain] = updatedChains.splice(fromIndex, 1)
    updatedChains.splice(toIndex, 0, movedChain)

    const newItems = updatedChains.flat()
    const updatedCategories = categories.map((c) =>
      c.id === catId ? { ...c, items: newItems } : c
    )
    persistData(updatedCategories)
  }

  // 移动端长按拖拽监听
  const handleTouchStart = (catId: string, chainIndex: number) => {
    touchDragTimerRef.current = setTimeout(() => {
      isTouchDraggingRef.current = true
      setDraggedItemInfo({ catId, chainIndex })
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40)
        } catch {}
      }
    }, 350)
  }

  const handleTouchMove = (e: React.TouchEvent, catId: string) => {
    if (!isTouchDraggingRef.current || !draggedItemInfo) {
      if (touchDragTimerRef.current) {
        clearTimeout(touchDragTimerRef.current)
        touchDragTimerRef.current = null
      }
      return
    }

    const touch = e.touches[0]
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-chain-index]')
    if (targetEl) {
      const targetIndex = Number(targetEl.getAttribute('data-chain-index'))
      const targetCatId = targetEl.getAttribute('data-cat-id')
      if (targetCatId === catId && !isNaN(targetIndex)) {
        setDragOverItemInfo({ catId, chainIndex: targetIndex })
      }
    }
  }

  const handleTouchEnd = () => {
    if (touchDragTimerRef.current) {
      clearTimeout(touchDragTimerRef.current)
      touchDragTimerRef.current = null
    }

    if (isTouchDraggingRef.current && draggedItemInfo && dragOverItemInfo) {
      if (draggedItemInfo.catId === dragOverItemInfo.catId) {
        reorderCategoryChains(draggedItemInfo.catId, draggedItemInfo.chainIndex, dragOverItemInfo.chainIndex)
      }
    }

    isTouchDraggingRef.current = false
    setDraggedItemInfo(null)
    setDragOverItemInfo(null)
  }

  // 🌟 手机与电脑通用：双击切换事项完成状态处理器
  const handleItemDoubleAction = (catId: string, itemId: string) => {
    const now = Date.now()
    if (now - lastToggleTimeRef.current < 200) return
    lastToggleTimeRef.current = now
    toggleItemCompletion(catId, itemId)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(35)
      } catch {}
    }
  }

  const handleItemTapOrClick = (catId: string, itemId: string, e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now()
    const lastTime = lastTapMapRef.current.get(itemId) || 0

    // 两次点击时间间隔小于 380ms 判定为双击
    if (now - lastTime < 380) {
      e.preventDefault()
      lastTapMapRef.current.delete(itemId)
      handleItemDoubleAction(catId, itemId)
    } else {
      lastTapMapRef.current.set(itemId, now)
    }
  }

  // Backup & Restore
  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ categories, zeroInOnIds }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `impossible_list_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string)
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          persistData(data.categories, data.zeroInOnIds || [])
          alert('数据恢复成功，并已同步至云端！')
        }
      } catch {
        alert('导入失败：无效的 JSON 文件格式。')
      }
    }
    reader.readAsText(file)
  }

  const handleResetDefaults = () => {
    if (confirm('确认恢复默认预设？将载入示范清单。')) {
      persistData(DEFAULT_IMPOSSIBLE_CATEGORIES, DEFAULT_ZERO_IN_ON)
      setActiveCategoryId('all')
      setSearchQuery('')
    }
  }

  const toggleItemCompletion = (catId: string, itemId: string, targetState?: boolean) => {
    const updated = categories.map((cat) => {
      if (cat.id !== catId) return cat
      return {
        ...cat,
        items: cat.items.map((item) => {
          if (item.id !== itemId) return item
          const nextState = targetState !== undefined ? targetState : !item.completed
          if (nextState) {
            setAnimatingItemId(item.id)
            setTimeout(() => setAnimatingItemId(null), 900)
          }
          return {
            ...item,
            completed: nextState,
            completedDate: nextState ? item.completedDate || formatAppleDate() : undefined,
          }
        }),
      }
    })
    persistData(updated)
    setContextMenu(null)
  }

  const handleSaveNextStage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nextStageAnchor || !nextStageTitle.trim()) return

    const newId = `evol-${Date.now()}`
    const newItem: ImpossibleItem = {
      id: newId,
      title: nextStageTitle.trim(),
      completed: false,
      linkText: nextStageLinkText.trim() || undefined,
      linkUrl: nextStageLinkUrl.trim() || undefined,
      parentItemId: nextStageAnchor.parentItemId,
    }

    const updated = categories.map((cat) => {
      if (cat.id !== nextStageAnchor.catId) return cat
      const itemIdx = cat.items.findIndex((i) => i.id === nextStageAnchor.parentItemId)
      if (itemIdx === -1) return cat

      const newItems = [...cat.items]
      newItems[itemIdx] = {
        ...newItems[itemIdx],
        nextItemId: newId,
      }
      newItems.splice(itemIdx + 1, 0, newItem)
      return { ...cat, items: newItems }
    })

    let updatedZeroInOnIds = [...zeroInOnIds]
    if (zeroInOnIds.includes(nextStageAnchor.parentItemId)) {
      updatedZeroInOnIds = zeroInOnIds.map((id) =>
        id === nextStageAnchor.parentItemId ? newId : id
      )
    } else {
      updatedZeroInOnIds.push(newId)
    }

    persistData(updated, updatedZeroInOnIds)
    setNextStageAnchor(null)
    setNextStageTitle('')
    setNextStageLinkText('')
    setNextStageLinkUrl('')
  }

  const findItemById = (id: string) => {
    for (const cat of categories) {
      const item = cat.items.find((i) => i.id === id)
      if (item) return { item, category: cat }
    }
    return null
  }

  const stats = useMemo(() => {
    let total = 0
    let completed = 0
    categories.forEach((c) => {
      c.items.forEach((i) => {
        total++
        if (i.completed) completed++
      })
    })
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
  }, [categories])

  const zeroInOnItems = useMemo(() => {
    return zeroInOnIds
      .map((id) => findItemById(id))
      .filter((x): x is { item: ImpossibleItem; category: ImpossibleCategory } => Boolean(x))
  }, [zeroInOnIds, categories])

  const displayedCategories = useMemo(() => {
    let list =
      activeCategoryId === 'all'
        ? categories
        : categories.filter((c) => c.id === activeCategoryId)

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              cat.name.toLowerCase().includes(q) ||
              (item.progress && item.progress.toLowerCase().includes(q))
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    }

    return list
  }, [categories, activeCategoryId, searchQuery])

  return (
    <div
      style={{ fontFamily: appleFontFamily }}
      className="antialiased pb-24 w-full px-4 sm:px-6 max-w-[1720px] mx-auto box-border text-neutral-900 dark:text-neutral-100"
    >
      <style>{`
        @keyframes appleStrikeThrough {
          0% { width: 0%; opacity: 0.3; }
          60% { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0.85; }
        }
        .anim-strike {
          position: relative;
        }
        .anim-strike::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          height: 1.5px;
          background-color: currentColor;
          animation: appleStrikeThrough 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes applePopoverFade {
          0% { opacity: 0; transform: scale(0.96) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-apple-popover {
          animation: applePopoverFade 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {/* 1. 顶部标题栏：已按要求移除最上方单独的 PROGRESS 胶囊 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 pt-6 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-gray-900 dark:text-gray-100">
              Impossible List
            </h1>

            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all active:scale-95 cursor-pointer tracking-tight"
              title="Manage and reorder categories"
            >
              Settings
            </button>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1.5 tracking-tight">
            <span className="block">
              You can't do a project; you can only do action steps related to it.
            </span>
            <span className="block mt-1">
              When enough of the right action steps have been taken, some situation will have been created that matches your initial picture of the outcome finished.
            </span>
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="relative flex items-center">
            <svg
              className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 sm:w-44 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs cursor-pointer"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <button
            onClick={handleExport}
            title="Export all data to JSON"
            className="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-1"
          >
            export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import JSON to restore data"
            className="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-1"
          >
            import
          </button>
          <button
            onClick={handleResetDefaults}
            className="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-1"
          >
            default
          </button>
        </div>
      </div>

      {/* 2. ZERO IN ON 顶置专注 */}
      <section className="my-5 space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/80">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
              Zero In On
            </h2>
            <span className="text-[10px] font-mono text-neutral-400">
              · {zeroInOnItems.length} Active Targets
            </span>
          </div>
          <button
            onClick={() => setIsZeroInOnModalOpen(true)}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-blue-500 active:scale-95 transition-all cursor-pointer"
          >
            + Add
          </button>
        </div>

        {zeroInOnItems.length === 0 ? (
          <div className="text-xs font-medium text-neutral-400 tracking-tight italic py-3 text-center">
            No active targets chosen. Click "+ Add" to focus on key milestones.
          </div>
        ) : (
          <div className="flex flex-col space-y-1">
            {zeroInOnItems.map(({ item, category }, index) => {
              const parentItem = item.parentItemId
                ? category.items.find((i) => i.id === item.parentItemId)
                : null

              return (
                <div
                  key={item.id}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      catId: category.id,
                      itemId: item.id,
                    })
                  }}
                  className="group flex items-center justify-between py-2 px-1.5 rounded-lg hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 transition-colors cursor-context-menu"
                >
                  <div className="flex items-center flex-wrap gap-2.5 min-w-0 pr-3 text-[14px]">
                    {/* 纯黑细长加粗序号 (1, 2, 3...) */}
                    <span
                      className="font-mono font-black text-black dark:text-white text-[13px] tracking-[-0.08em] select-none inline-block shrink-0"
                      style={{ transform: 'scale(0.85, 1.15)', transformOrigin: 'center' }}
                    >
                      {index + 1}
                    </span>

                    {/* 双击完成事项并划线 */}
                    <span
                      onClick={(e) => handleItemTapOrClick(category.id, item.id, e)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        handleItemDoubleAction(category.id, item.id)
                      }}
                      title="双击切换完成状态"
                      className={`tracking-[-0.01em] cursor-pointer select-none ${
                        item.completed
                          ? 'line-through text-neutral-400 dark:text-neutral-500 font-normal'
                          : 'text-neutral-900 dark:text-neutral-100 font-medium'
                      }`}
                    >
                      {item.title}
                    </span>

                    {item.completed && item.completedDate && (
                      <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        [{item.completedDate}]
                      </span>
                    )}

                    {parentItem && (
                      <div className="inline-flex items-center gap-1.5 shrink-0 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-xs">
                        <span className="text-rose-500 font-bold text-xs select-none">
                          ←
                        </span>
                        <span className="line-through text-neutral-400 dark:text-neutral-500 text-[11px] font-normal tracking-tight">
                          {parentItem.title}
                        </span>
                        {parentItem.completedDate && (
                          <span className="text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                            [{parentItem.completedDate}]
                          </span>
                        )}
                      </div>
                    )}

                    {item.linkUrl && item.linkText && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 underline shrink-0 hover:opacity-80 tracking-tight"
                      >
                        – {item.linkText}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase">
                      {category.name}
                    </span>
                    <button
                      onClick={() =>
                        persistData(
                          categories,
                          zeroInOnIds.filter((id) => id !== item.id)
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-xs px-1 transition-opacity cursor-pointer"
                      title="Remove from Focus"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. 主题分类胶囊导航栏 */}
      <div className="pt-2 pb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`px-4 py-2 rounded-full text-xs font-semibold tracking-tight transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeCategoryId === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <span>All</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeCategoryId === 'all'
                  ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black font-bold'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {stats.completed}/{stats.total}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = activeCategoryId === cat.id
            const count = cat.items.length
            const completed = cat.items.filter((i) => i.completed).length

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-tight transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black font-bold'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {completed}/{count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. 清单展示区：纯黑细长序号(1,2,3) + 图二波点样式 + 双击划线 */}
      <div className="space-y-12 pt-2">
        {displayedCategories.map((category) => {
          const total = category.items.length
          const completed = category.items.filter((i) => i.completed).length
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0

          const rootItems = category.items.filter((item) => !item.parentItemId)

          return (
            <section key={category.id} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-3 border-b border-neutral-200/80 dark:border-neutral-800">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-neutral-900 dark:text-neutral-100">
                    {category.name}
                  </h2>
                  <span className="text-xs font-mono text-neutral-400 font-medium">
                    {completed} of {total} completed ({pct}%)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-36 sm:w-48 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="px-3 py-1 rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 transition-colors cursor-pointer"
                  >
                    Edit Theme
                  </button>
                </div>
              </div>

              {/* 列表条目 */}
              <div className="flex flex-col space-y-1.5">
                {rootItems.map((rootItem, chainIndex) => {
                  const chain: ImpossibleItem[] = []
                  const visited = new Set<string>()
                  let cur: ImpossibleItem | undefined = rootItem

                  while (cur && !visited.has(cur.id)) {
                    visited.add(cur.id)
                    chain.push(cur)
                    cur = category.items.find((i) => i.id === cur?.nextItemId)
                  }

                  const reversedChain = [...chain].reverse()
                  const isCurrentDragged =
                    draggedItemInfo?.catId === category.id && draggedItemInfo?.chainIndex === chainIndex
                  const isCurrentDragOver =
                    dragOverItemInfo?.catId === category.id && dragOverItemInfo?.chainIndex === chainIndex

                  return (
                    <div
                      key={rootItem.id}
                      data-cat-id={category.id}
                      data-chain-index={chainIndex}
                      draggable
                      onDragStart={(e) => {
                        setDraggedItemInfo({ catId: category.id, chainIndex })
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (
                          dragOverItemInfo?.catId !== category.id ||
                          dragOverItemInfo?.chainIndex !== chainIndex
                        ) {
                          setDragOverItemInfo({ catId: category.id, chainIndex })
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (!draggedItemInfo || draggedItemInfo.catId !== category.id) return
                        reorderCategoryChains(category.id, draggedItemInfo.chainIndex, chainIndex)
                        setDraggedItemInfo(null)
                        setDragOverItemInfo(null)
                      }}
                      onDragEnd={() => {
                        setDraggedItemInfo(null)
                        setDragOverItemInfo(null)
                      }}
                      onTouchStart={() => handleTouchStart(category.id, chainIndex)}
                      onTouchMove={(e) => handleTouchMove(e, category.id)}
                      onTouchEnd={handleTouchEnd}
                      className={`group/item flex items-start gap-2.5 py-1.5 px-2 rounded-xl transition-all ${
                        isCurrentDragged
                          ? 'opacity-30 border border-dashed border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 scale-[0.99]'
                          : isCurrentDragOver
                          ? 'border border-blue-500 bg-blue-500/10 shadow-xs'
                          : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 border border-transparent'
                      }`}
                    >
                      {/* 🌟 1. 抓取手柄 + 纯黑细长加粗数字 (1, 2, 3...) */}
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5 select-none">
                        <span
                          className="text-neutral-300 dark:text-neutral-600 group-hover/item:text-neutral-500 dark:group-hover/item:text-neutral-400 cursor-grab active:cursor-grabbing text-xs transition-colors p-0.5"
                          title="按住拖拽自由排序"
                        >
                          ⠿
                        </span>
                        <span
                          className="font-mono font-black text-black dark:text-white text-[13px] tracking-[-0.08em] select-none inline-block w-4 text-right"
                          style={{ transform: 'scale(0.85, 1.15)', transformOrigin: 'center' }}
                        >
                          {chainIndex + 1}
                        </span>
                      </div>

                      {/* 🌟 2. 图二样式波点：双同心圆结构（已完成为亮青同心环，未完成为灰同心环） */}
                      <span
                        onClick={(e) => handleItemTapOrClick(category.id, reversedChain[0].id, e)}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          handleItemDoubleAction(category.id, reversedChain[0].id)
                        }}
                        className="mt-1.5 shrink-0 flex items-center justify-center cursor-pointer select-none"
                        title="双击切换完成状态"
                      >
                        {reversedChain[0].completed ? (
                          <span className="w-3.5 h-3.5 rounded-full border-[2px] border-[#0099cc] dark:border-[#38bdf8] flex items-center justify-center bg-white dark:bg-neutral-900 shadow-[0_0_6px_rgba(0,153,204,0.45)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0099cc] dark:bg-[#38bdf8]" />
                          </span>
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-neutral-300 dark:border-neutral-600 flex items-center justify-center bg-transparent group-hover/item:border-[#0099cc] transition-colors">
                            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 group-hover/item:bg-[#0099cc] transition-colors" />
                          </span>
                        )}
                      </span>

                      {/* 🌟 3. 事项内容与链式演化区：双击触发划线完成，单击不误触 */}
                      <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1.5 flex-1 min-w-0 text-[14px] leading-relaxed">
                        {reversedChain.map((item, index) => {
                          const isHead = index === 0
                          const isAnimating = animatingItemId === item.id

                          return (
                            <React.Fragment key={item.id}>
                              {!isHead && (
                                <span className="inline-flex items-center text-rose-500 font-bold text-xs select-none px-0.5">
                                  ←
                                </span>
                              )}

                              <div
                                onClick={(e) => handleItemTapOrClick(category.id, item.id, e)}
                                onDoubleClick={(e) => {
                                  e.preventDefault()
                                  handleItemDoubleAction(category.id, item.id)
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    catId: category.id,
                                    itemId: item.id,
                                  })
                                }}
                                title="双击标记完成 / 右键管理"
                                className={`group/node relative inline-flex items-center gap-1.5 px-2 py-0.5 -mx-1.5 rounded-lg transition-all cursor-context-menu select-none ${
                                  item.completed
                                    ? 'hover:bg-rose-50/70 dark:hover:bg-rose-950/20'
                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                }`}
                              >
                                <span
                                  className={`transition-colors ${
                                    item.completed
                                      ? 'line-through text-neutral-400 dark:text-neutral-500 font-normal'
                                      : 'text-neutral-900 dark:text-neutral-100 font-medium'
                                  } ${isAnimating ? 'anim-strike font-semibold' : ''}`}
                                >
                                  {item.title}
                                </span>

                                {item.progress && (
                                  <span className="text-[11px] font-mono text-neutral-400">
                                    {item.progress}
                                  </span>
                                )}

                                {item.completed && item.completedDate && (
                                  <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                                    [{item.completedDate}]
                                  </span>
                                )}

                                {item.linkUrl && item.linkText && (
                                  <span className="text-neutral-400">
                                    {' '}–{' '}
                                    <a
                                      href={item.linkUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-medium text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                                    >
                                      {item.linkText}
                                    </a>
                                  </span>
                                )}

                                {item.completed && isHead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setNextStageAnchor({
                                        catId: category.id,
                                        parentItemId: item.id,
                                        x: rect.right + 10,
                                        y: rect.top - 12,
                                      })
                                    }}
                                    title="Create next stage evolution"
                                    className="opacity-0 group-hover/node:opacity-100 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-[0_0_8px_rgba(244,63,94,0.7)] hover:scale-110 active:scale-95 transition-all ml-0.5 cursor-pointer"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {displayedCategories.length === 0 && (
          <div className="py-20 text-center text-neutral-400 text-sm">
            No milestones found matching "{searchQuery}".
          </div>
        )}
      </div>

      {/* 5. 演化里程碑 Next Stage 浮层 */}
      {mounted && nextStageAnchor &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[99998] bg-transparent"
              onClick={() => setNextStageAnchor(null)}
            />
            <div
              className="fixed z-[99999] rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-4 shadow-2xl animate-apple-popover w-[290px] sm:w-[320px] text-neutral-900 dark:text-neutral-100"
              style={{
                left: Math.min(nextStageAnchor.x, window.innerWidth - 335),
                top: Math.min(nextStageAnchor.y, window.innerHeight - 260),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100 dark:border-neutral-800">
                <h4 className="text-xs font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                  Next Stage
                </h4>
                <button
                  type="button"
                  onClick={() => setNextStageAnchor(null)}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveNextStage} className="space-y-2.5">
                <div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="New milestone title..."
                    value={nextStageTitle}
                    onChange={(e) => setNextStageTitle(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Link label"
                    value={nextStageLinkText}
                    onChange={(e) => setNextStageLinkText(e.target.value)}
                    className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-2.5 py-1.5 text-[11px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={nextStageLinkUrl}
                    onChange={(e) => setNextStageLinkUrl(e.target.value)}
                    className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-2.5 py-1.5 text-[11px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex justify-end items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setNextStageAnchor(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-white px-2.5 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3.5 py-1 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Save Stage
                  </button>
                </div>
              </form>
            </div>
          </>,
          document.body
        )}

      {/* 6. 右键快捷菜单 */}
      {mounted && contextMenu &&
        createPortal(
          <div
            className="fixed z-[999999] rounded-2xl bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-700 p-1.5 shadow-2xl backdrop-blur-xl animate-apple-popover flex flex-col min-w-[170px] text-xs text-neutral-900 dark:text-neutral-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              top: Math.min(contextMenu.y, window.innerHeight - 170),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const cat = categories.find((c) => c.id === contextMenu.catId)
              const item = cat?.items.find((i) => i.id === contextMenu.itemId)
              if (!item) return null
              const isZero = zeroInOnIds.includes(item.id)

              return (
                <>
                  <div className="px-2.5 py-1 text-[10px] font-mono font-semibold text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 uppercase tracking-wider mb-1 truncate">
                    {item.title}
                  </div>

                  <button
                    onClick={() =>
                      toggleItemCompletion(contextMenu.catId, contextMenu.itemId, !item.completed)
                    }
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <span>{item.completed ? 'Mark Incomplete' : 'Mark Completed'}</span>
                    <span className="text-blue-600 font-bold">{item.completed ? '↩' : '✓'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isZero) {
                        persistData(
                          categories,
                          zeroInOnIds.filter((id) => id !== item.id)
                        )
                      } else {
                        persistData(categories, [...zeroInOnIds, item.id])
                      }
                      setContextMenu(null)
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <span>{isZero ? 'Remove Focus' : 'Add to Focus'}</span>
                    <span className="text-amber-500 font-bold">{isZero ? '★' : '☆'}</span>
                  </button>

                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

                  <button
                    onClick={() => {
                      setEditingItemData({ catId: contextMenu.catId, item: { ...item } })
                      setContextMenu(null)
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-neutral-500"
                  >
                    Edit Details...
                  </button>
                </>
              )
            })()}
          </div>,
          document.body
        )}

      {/* 7. 主题分类管理弹窗 */}
      {mounted && isCategoryManagerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCategoryManagerOpen(false)
            }}
          >
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-3xl p-6 text-neutral-900 dark:text-white shadow-2xl animate-apple-popover">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div>
                  <h3 className="text-base font-bold tracking-[-0.02em]">
                    Manage Categories
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5 tracking-tight">
                    Drag and drop to rearrange order
                  </p>
                </div>
                <button
                  onClick={() => setIsCategoryManagerOpen(false)}
                  className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedCatIndex(idx)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverCatIndex !== idx) setDragOverCatIndex(idx)
                    }}
                    onDragLeave={() => {
                      if (dragOverCatIndex === idx) setDragOverCatIndex(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedCatIndex === null || draggedCatIndex === idx) return
                      const updated = [...categories]
                      const [moved] = updated.splice(draggedCatIndex, 1)
                      updated.splice(idx, 0, moved)
                      persistData(updated)
                      setDraggedCatIndex(null)
                      setDragOverCatIndex(null)
                    }}
                    onDragEnd={() => {
                      setDraggedCatIndex(null)
                      setDragOverCatIndex(null)
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                      draggedCatIndex === idx
                        ? 'opacity-40 border-dashed border-blue-500 bg-neutral-100 dark:bg-neutral-800'
                        : dragOverCatIndex === idx
                        ? 'border-blue-500 bg-blue-500/10 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-neutral-400 text-xs select-none">⠿</span>
                      <span className="font-semibold text-xs tracking-tight">{cat.name}</span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Delete "${cat.name}" and all its targets?`)) {
                          const updated = categories.filter((c) => c.id !== cat.id)
                          persistData(updated)
                          if (activeCategoryId === cat.id) {
                            setActiveCategoryId('all')
                          }
                        }
                      }}
                      className="text-rose-500 hover:text-rose-700 text-xs px-2 py-0.5 rounded cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New category name..."
                  id="new-category-input"
                  className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('new-category-input') as HTMLInputElement
                    if (el && el.value.trim()) {
                      const newCat: ImpossibleCategory = {
                        id: `cat-${Date.now()}`,
                        name: el.value.trim(),
                        items: [],
                      }
                      persistData([...categories, newCat])
                      setActiveCategoryId(newCat.id)
                      el.value = ''
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-xl cursor-pointer shadow-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 8. 主题详情编辑弹窗 */}
      {mounted && editingCategory &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingCategory(null)
            }}
          >
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-3xl p-6 text-neutral-900 dark:text-white shadow-2xl animate-apple-popover max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Edit Theme:
                  </h3>
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => {
                      const updatedCat = { ...editingCategory, name: e.target.value }
                      setEditingCategory(updatedCat)
                      setCategories(categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)))
                    }}
                    className="bg-neutral-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-sm text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    persistData(categories)
                    setEditingCategory(null)
                  }}
                  className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
                {editingCategory.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={it.completed ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200 font-medium'}>
                        {it.title}
                      </span>
                      {it.completed && (
                        <span className="text-blue-600 dark:text-blue-400 text-[10px] font-mono">
                          [{it.completedDate}]
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingItemData({ catId: editingCategory.id, item: { ...it } })
                        }}
                        className="px-2 py-0.5 rounded bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          const updatedCat = {
                            ...editingCategory,
                            items: editingCategory.items.filter((x) => x.id !== it.id),
                          }
                          setEditingCategory(updatedCat)
                          persistData(categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)))
                        }}
                        className="px-2 py-0.5 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <input
                  type="text"
                  placeholder="Add new target..."
                  id="add-item-title-input"
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      const titleEl = document.getElementById('add-item-title-input') as HTMLInputElement
                      if (!titleEl || !titleEl.value.trim()) return
                      const newItem: ImpossibleItem = {
                        id: `item-${Date.now()}`,
                        title: titleEl.value.trim(),
                        completed: false,
                      }
                      const updatedCat = {
                        ...editingCategory,
                        items: [...editingCategory.items, newItem],
                      }
                      setEditingCategory(updatedCat)
                      persistData(categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)))
                      titleEl.value = ''
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-xs cursor-pointer"
                  >
                    + Add to Theme
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 9. 单项具体详情编辑弹窗 */}
      {mounted && editingItemData &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingItemData(null)
            }}
          >
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-3xl p-6 text-neutral-900 dark:text-white shadow-2xl animate-apple-popover">
              <h3 className="text-sm font-bold pb-2.5 border-b border-neutral-100 dark:border-neutral-800 tracking-tight">
                Edit Item Details
              </h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const updated = categories.map((cat) => {
                    if (cat.id !== editingItemData.catId) return cat
                    return {
                      ...cat,
                      items: cat.items.map((i) =>
                        i.id === editingItemData.item.id ? editingItemData.item : i
                      ),
                    }
                  })
                  persistData(updated)
                  setEditingItemData(null)
                }}
                className="mt-3 space-y-3 text-xs"
              >
                <div>
                  <label className="block text-neutral-400 mb-1 tracking-tight">Title</label>
                  <input
                    type="text"
                    required
                    value={editingItemData.item.title}
                    onChange={(e) =>
                      setEditingItemData({
                        ...editingItemData,
                        item: { ...editingItemData.item, title: e.target.value },
                      })
                    }
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-neutral-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="edit-item-completed"
                    checked={editingItemData.item.completed}
                    onChange={(e) =>
                      setEditingItemData({
                        ...editingItemData,
                        item: {
                          ...editingItemData.item,
                          completed: e.target.checked,
                          completedDate: e.target.checked
                            ? editingItemData.item.completedDate || formatAppleDate()
                            : undefined,
                        },
                      })
                    }
                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="edit-item-completed" className="text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer">
                    Completed
                  </label>
                </div>

                {editingItemData.item.completed && (
                  <div>
                    <label className="block text-neutral-400 mb-1 tracking-tight">Completion Date</label>
                    <input
                      type="text"
                      placeholder="e.g. Jun 30th, 2017"
                      value={editingItemData.item.completedDate || ''}
                      onChange={(e) =>
                        setEditingItemData({
                          ...editingItemData,
                          item: { ...editingItemData.item, completedDate: e.target.value },
                        })
                      }
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-neutral-900 dark:text-white font-mono focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-neutral-400 mb-1 tracking-tight">Link Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Link"
                      value={editingItemData.item.linkText || ''}
                      onChange={(e) =>
                        setEditingItemData({
                          ...editingItemData,
                          item: { ...editingItemData.item, linkText: e.target.value },
                        })
                      }
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1 tracking-tight">Link URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={editingItemData.item.linkUrl || ''}
                      onChange={(e) =>
                        setEditingItemData({
                          ...editingItemData,
                          item: { ...editingItemData.item, linkUrl: e.target.value },
                        })
                      }
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditingItemData(null)}
                    className="px-3 py-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 10. Zero In On 专注管理弹窗 */}
      {mounted && isZeroInOnModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsZeroInOnModalOpen(false)
            }}
          >
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-3xl p-6 text-neutral-900 dark:text-white shadow-2xl animate-apple-popover max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-base font-bold tracking-tight">
                  Zero In On Focus
                </h3>
                <button
                  onClick={() => setIsZeroInOnModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-bold">
                      {cat.name}
                    </div>
                    <div className="space-y-1">
                      {cat.items.map((it) => {
                        const isChecked = zeroInOnIds.includes(it.id)
                        return (
                          <label
                            key={it.id}
                            className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-blue-600/10 border border-blue-500/30 text-neutral-900 dark:text-white font-medium'
                                : 'bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setZeroInOnIds([...zeroInOnIds, it.id])
                                } else {
                                  setZeroInOnIds(zeroInOnIds.filter((id) => id !== it.id))
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <span className={it.completed ? 'line-through text-neutral-400' : ''}>
                              {it.title}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-mono">{zeroInOnIds.length} items highlighted</span>
                <button
                  onClick={() => {
                    persistData(categories, zeroInOnIds)
                    setIsZeroInOnModalOpen(false)
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-1.5 rounded-full font-semibold shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}