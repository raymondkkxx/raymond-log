import { useRef, useCallback } from 'react'

interface LongPressOptions {
  threshold?: number // 长按毫秒数，默认 400ms
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void
}

export function useLongPress({
  threshold = 400,
  onLongPress,
  onClick,
}: LongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)
  const startCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      isLongPressRef.current = false
      if ('touches' in e && e.touches.length > 0) {
        startCoordsRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(28)
          } catch {
            // 忽略未授权震动
          }
        }
        onLongPress(e)
      }, threshold)
    },
    [onLongPress, threshold]
  )

  const clear = useCallback(
    (e: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e)
      }
    },
    [onClick]
  )

  const move = useCallback((e: React.TouchEvent) => {
    if (timerRef.current && e.touches.length > 0) {
      const moveX = Math.abs(e.touches[0].clientX - startCoordsRef.current.x)
      const moveY = Math.abs(e.touches[0].clientY - startCoordsRef.current.y)
      if (moveX > 10 || moveY > 10) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchMove: move,
    onContextMenu: (e: React.SyntheticEvent) => {
      if ('touches' in e) {
        e.preventDefault()
      }
    },
  }
}