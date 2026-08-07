import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { LumeMark } from './LumeMark'
import { SECTIONS, resolveSectionOrder } from '../lib/sections'
import { useSettings } from '../context/SettingsContext'

/**
 * The Radial Ring (Section 5, decided over Arc Slide).
 *
 * Five sections fan out around a bottom-centre FAB. The spec places them at
 * top / left / right / bottom-left / bottom-right; laid out literally, the two
 * bottom items would fall off the bottom of the screen, since the FAB sits
 * only ~60px above it. Instead the same five, in the same order, are spread
 * evenly across a 220° arc that opens upward — Habits still crowns the ring,
 * Tasks and Focus still flank it, and the Activity Log and Calendar still sit
 * lowest on the left and right, but every button stays on screen and no two
 * overlap.
 */

const RADIUS = 92
const ARC_START = 200 // down-left, in degrees (0 = right, positive = up)
const ARC_END = -20 // down-right

function offsetFor(index: number, count: number): { x: number; y: number } {
  const step = (ARC_END - ARC_START) / Math.max(1, count - 1)
  const degrees = ARC_START + step * index
  const radians = (degrees * Math.PI) / 180
  return {
    x: Math.cos(radians) * RADIUS,
    // Screen y grows downward, so the sine is negated.
    y: -Math.sin(radians) * RADIUS,
  }
}

export function RadialNav() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const { settings } = useSettings()

  // The ring reads the same order as the header and the hub. Reversed so the
  // user's first section lands at the top of the arc rather than the bottom
  // left, which is where the thumb looks first.
  const sections = resolveSectionOrder(settings?.section_order)
    .map((key) => SECTIONS[key])
    .reverse()

  // Close on route change, so tapping a section leaves a clean dashboard.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    firstItemRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Dimmed variant (Section 5): the dashboard recedes behind the ring. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <nav
        aria-label="Sections"
        className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2"
      >
        <div className="relative">
          {sections.map((section, index) => {
            const { x, y } = offsetFor(index, sections.length)
            const active = location.pathname.startsWith(section.path)

            return (
              <button
                key={section.path}
                ref={index === 0 ? firstItemRef : undefined}
                type="button"
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                onClick={() => navigate(section.path)}
                style={{
                  transform: open
                    ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                    : 'translate(-50%, -50%) scale(0.4)',
                  transitionDelay: open ? `${index * 28}ms` : '0ms',
                }}
                className={`absolute top-1/2 left-1/2 flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full border shadow-lg transition-all duration-200 ease-out ${
                  open ? 'opacity-100' : 'pointer-events-none opacity-0'
                } ${
                  active
                    ? 'border-accent bg-accent text-accent-contrast'
                    : 'border-border bg-surface text-text hover:border-accent'
                }`}
              >
                <section.Icon size={18} strokeWidth={1.6} />
                <span className="text-[9px] leading-none font-medium">
                  {section.label}
                </span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-xl transition-transform duration-200 active:scale-95"
          >
            <span
              className={`absolute transition-all duration-200 ${
                open ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
              }`}
            >
              <LumeMark size={26} />
            </span>
            <span
              className={`absolute transition-all duration-200 ${
                open ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              <X size={24} strokeWidth={2} />
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
