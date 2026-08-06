import { useCallback, useEffect, useRef, useState } from 'react'

export type FocusPhase = 'idle' | 'work' | 'break'

interface State {
  phase: FocusPhase
  running: boolean
  /** Seconds left in the current phase. */
  remaining: number
  /** When the current work phase began — the session's `started_at`. */
  startedAt: Date | null
}

/**
 * Deadline-based rather than decrement-based: the timer stores the instant it
 * should end and derives the remaining seconds from the clock. A decrementing
 * counter loses time whenever the tab is throttled in the background, which is
 * exactly when a focus timer is least likely to be in the foreground.
 */
export function useFocusTimer({
  workMinutes,
  breakMinutes,
  onWorkComplete,
  onBreakComplete,
}: {
  workMinutes: number
  breakMinutes: number
  onWorkComplete: (elapsedMinutes: number) => void
  onBreakComplete: () => void
}) {
  const [state, setState] = useState<State>({
    phase: 'idle',
    running: false,
    remaining: workMinutes * 60,
    startedAt: null,
  })

  const deadlineRef = useRef<number | null>(null)
  const phaseRef = useRef<FocusPhase>('idle')
  phaseRef.current = state.phase

  // Callbacks are read through refs so a new inline handler on every render
  // doesn't tear down and rebuild the interval underneath a running timer.
  const onWorkCompleteRef = useRef(onWorkComplete)
  const onBreakCompleteRef = useRef(onBreakComplete)
  onWorkCompleteRef.current = onWorkComplete
  onBreakCompleteRef.current = onBreakComplete

  // Keep an idle timer's display in step with the duration sliders.
  useEffect(() => {
    setState((prev) =>
      prev.phase === 'idle'
        ? { ...prev, remaining: workMinutes * 60 }
        : prev,
    )
  }, [workMinutes])

  const finishPhase = useCallback(() => {
    deadlineRef.current = null
    if (phaseRef.current === 'work') {
      onWorkCompleteRef.current(workMinutes)
      setState({
        phase: 'break',
        running: true,
        remaining: breakMinutes * 60,
        startedAt: null,
      })
      deadlineRef.current = Date.now() + breakMinutes * 60_000
    } else {
      onBreakCompleteRef.current()
      setState({
        phase: 'idle',
        running: false,
        remaining: workMinutes * 60,
        startedAt: null,
      })
    }
  }, [breakMinutes, workMinutes])

  useEffect(() => {
    if (!state.running) return

    const tick = () => {
      if (deadlineRef.current === null) return
      const left = Math.round((deadlineRef.current - Date.now()) / 1000)
      if (left <= 0) finishPhase()
      else setState((prev) => ({ ...prev, remaining: left }))
    }

    const id = window.setInterval(tick, 250)
    tick()
    return () => window.clearInterval(id)
  }, [state.running, finishPhase])

  const startWork = useCallback(() => {
    deadlineRef.current = Date.now() + workMinutes * 60_000
    setState({
      phase: 'work',
      running: true,
      remaining: workMinutes * 60,
      startedAt: new Date(),
    })
  }, [workMinutes])

  const pause = useCallback(() => {
    deadlineRef.current = null
    setState((prev) => ({ ...prev, running: false }))
  }, [])

  const resume = useCallback(() => {
    setState((prev) => {
      deadlineRef.current = Date.now() + prev.remaining * 1000
      return { ...prev, running: true }
    })
  }, [])

  /** Ends the session early; returns how long was actually spent working. */
  const stop = useCallback(() => {
    const planned = workMinutes * 60
    const elapsed =
      state.phase === 'work' ? (planned - state.remaining) / 60 : 0
    deadlineRef.current = null
    setState({
      phase: 'idle',
      running: false,
      remaining: workMinutes * 60,
      startedAt: null,
    })
    return { elapsedMinutes: Math.max(0, elapsed) }
  }, [state.phase, state.remaining, workMinutes])

  const skipBreak = useCallback(() => {
    deadlineRef.current = null
    setState({
      phase: 'idle',
      running: false,
      remaining: workMinutes * 60,
      startedAt: null,
    })
  }, [workMinutes])

  const totalSeconds =
    state.phase === 'break' ? breakMinutes * 60 : workMinutes * 60
  const progress =
    totalSeconds > 0 ? 1 - state.remaining / totalSeconds : 0

  return {
    ...state,
    progress: Math.min(1, Math.max(0, progress)),
    startWork,
    pause,
    resume,
    stop,
    skipBreak,
  }
}
