import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Horizontal swipe-to-act on a row.
 *
 * Pointer events rather than touch events, so it works from a mouse too and
 * needs no separate desktop path. The axis is locked after the first few
 * pixels: without that, a vertical flick down a long list drags every row it
 * passes and the page stops scrolling properly.
 *
 * Only one direction is live. A row that acts on both is a row where a
 * mis-aimed thumb does the opposite of what you meant, and "complete" and
 * "delete" are a bad pair to confuse.
 */
const AXIS_LOCK_PX = 8
const TRIGGER_PX = 96
/** Past the trigger the row keeps moving, but grudgingly. */
const RESIST = 0.35

export function useSwipeAction({
  onTrigger,
  enabled = true,
}: {
  onTrigger: () => void
  enabled?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [settling, setSettling] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  /** Set when a drag actually happened, so the click it emits can be eaten. */
  const dragged = useRef(false)

  const reset = useCallback(() => {
    setSettling(true)
    setDx(0)
    window.setTimeout(() => setSettling(false), 180)
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled || e.pointerType === 'mouse' && e.button !== 0) return
      startX.current = e.clientX
      startY.current = e.clientY
      axis.current = 'none'
      dragged.current = false
      setSettling(false)
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return
      const deltaX = e.clientX - startX.current
      const deltaY = e.clientY - startY.current

      if (axis.current === 'none') {
        if (Math.abs(deltaY) > AXIS_LOCK_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
          axis.current = 'y' // leave it to the scroller
          return
        }
        if (Math.abs(deltaX) > AXIS_LOCK_PX) {
          axis.current = 'x'
          e.currentTarget.setPointerCapture(e.pointerId)
        } else {
          return
        }
      }
      if (axis.current !== 'x') return

      dragged.current = true
      // Rightward only; anything left is held at rest.
      const travel = Math.max(0, deltaX)
      setDx(
        travel <= TRIGGER_PX
          ? travel
          : TRIGGER_PX + (travel - TRIGGER_PX) * RESIST,
      )
    },
    [enabled],
  )

  const onPointerUp = useCallback(() => {
    if (axis.current === 'x' && dx >= TRIGGER_PX) onTrigger()
    axis.current = 'none'
    reset()
  }, [dx, onTrigger, reset])

  /** Attach to the row's capture phase to swallow the click after a drag. */
  const onClickCapture = useCallback((e: ReactPointerEvent | React.MouseEvent) => {
    if (!dragged.current) return
    e.preventDefault()
    e.stopPropagation()
    dragged.current = false
  }, [])

  return {
    dx,
    progress: Math.min(1, dx / TRIGGER_PX),
    armed: dx >= TRIGGER_PX,
    settling,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  }
}
