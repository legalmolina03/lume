import { useId } from 'react'
import type { LifeArea, TaskPriority } from '../lib/types'

/**
 * The three task signals kept on separate visual channels (Section 9a):
 * life area answers "what" (colour), priority answers "how important" (icon
 * fill level, never colour), overdue answers "is this urgent" (red edge,
 * rendered by the card itself via `.overdue-edge`).
 */

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
}

/** A flag whose fill level — not colour — carries the priority. */
export function PriorityIcon({
  priority,
  size = 14,
}: {
  priority: TaskPriority
  size?: number
}) {
  const clipId = useId()
  const bannerPath = 'M5 4.5h11l-2.4 3.2 2.4 3.2H5z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={PRIORITY_LABEL[priority]}
      className="shrink-0 text-muted"
    >
      <title>{PRIORITY_LABEL[priority]}</title>
      <defs>
        <clipPath id={clipId}>
          {/* Medium fills the banner's left half; high fills all of it. */}
          <rect x="0" y="0" width={priority === 'high' ? 24 : 10.5} height="24" />
        </clipPath>
      </defs>

      <path d="M5 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d={bannerPath}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {priority !== 'low' && (
        <path d={bannerPath} fill="currentColor" clipPath={`url(#${clipId})`} />
      )}
    </svg>
  )
}

/** The life-area colour dot, used everywhere an item can be tagged. */
export function LifeAreaDot({
  area,
  size = 8,
}: {
  area: LifeArea | null
  size?: number
}) {
  if (!area) return null
  return (
    <span
      title={area.name}
      style={{ backgroundColor: area.color, width: size, height: size }}
      className="inline-block shrink-0 rounded-full"
    />
  )
}

export function LifeAreaChip({ area }: { area: LifeArea | null }) {
  if (!area) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: area.color,
        backgroundColor: `color-mix(in oklab, ${area.color} 14%, transparent)`,
      }}
    >
      <LifeAreaDot area={area} size={6} />
      {area.name}
    </span>
  )
}
