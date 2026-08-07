import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useCallback, useEffect, useId, useRef } from 'react'

const CONTROL =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/70 transition-colors focus:border-accent'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
    </label>
  )
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL} ${className}`} />
}

/**
 * Grows to fit its content instead of scrolling inside a fixed box.
 *
 * Notes are the one field people actually write paragraphs into, and a
 * four-line window that hides what you already wrote is the fastest way to
 * make someone stop writing. `rows` sets the minimum height; `maxRows` stops
 * a long note from pushing the save buttons off-screen.
 */
export function Textarea({
  className = '',
  rows = 3,
  maxRows = 16,
  onChange,
  value,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    const style = window.getComputedStyle(el)
    const lineHeight = parseFloat(style.lineHeight) || 20
    const vertical =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth)

    // Collapse first, or scrollHeight only ever reports the current height.
    el.style.height = 'auto'
    const max = lineHeight * maxRows + vertical
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [maxRows])

  // Re-fit when the value changes from outside, e.g. a form being reset.
  useEffect(resize, [resize, value])

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => {
        resize()
        onChange?.(e)
      }}
      className={`${CONTROL} resize-none ${className}`}
    />
  )
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${CONTROL} ${className}`}>
      {children}
    </select>
  )
}

/** Segmented control — used for frequency, goal type, calendar view, etc. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
  label?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-accent text-accent-contrast'
              : 'text-muted hover:text-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Multi-select weekday picker for weekly habits and weekly recurrence. */
export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (next: number[]) => void
}) {
  const groupId = useId()
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]

  return (
    <div className="flex gap-1.5">
      {labels.map((label, day) => {
        const active = value.includes(day)
        return (
          <button
            key={`${groupId}-${day}`}
            type="button"
            aria-pressed={active}
            aria-label={names[day]}
            onClick={() =>
              onChange(
                active ? value.filter((d) => d !== day) : [...value, day].sort(),
              )
            }
            className={`h-8 w-8 rounded-full border text-xs font-medium transition-colors ${
              active
                ? 'border-accent bg-accent text-accent-contrast'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** The palette life areas, habits and projects choose their colour from. */
export const SWATCHES = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
]

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          aria-label={`Colour ${swatch}`}
          aria-pressed={value.toLowerCase() === swatch}
          onClick={() => onChange(swatch)}
          style={{ backgroundColor: swatch }}
          className={`h-7 w-7 rounded-full transition-transform ${
            value.toLowerCase() === swatch
              ? 'ring-2 ring-text ring-offset-2 ring-offset-surface'
              : 'hover:scale-110'
          }`}
        />
      ))}
    </div>
  )
}
