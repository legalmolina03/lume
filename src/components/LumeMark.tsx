/**
 * The Lume starburst (Section 5). Used as the app icon, the PWA home-screen
 * icon and the radial-ring FAB glyph in its closed state, so it has to stay
 * legible from 512px down to about 20px — hence a single four-point sparkle
 * with concave sides rather than anything with fine detail.
 */
export function LumeMark({
  size = 24,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 1.5c.65 5.6 4.9 9.85 10.5 10.5-5.6.65-9.85 4.9-10.5 10.5-.65-5.6-4.9-9.85-10.5-10.5C7.1 11.35 11.35 7.1 12 1.5Z"
        fill="currentColor"
      />
      <path
        d="M19.4 2.2c.24 2.03 1.77 3.56 3.8 3.8-2.03.24-3.56 1.77-3.8 3.8-.24-2.03-1.77-3.56-3.8-3.8 2.03-.24 3.56-1.77 3.8-3.8Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  )
}

/** Wordmark used on the auth screen and the app header. */
export function LumeWordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LumeMark size={size} className="text-accent" />
      <span
        className="font-semibold tracking-[0.2em] uppercase"
        style={{ fontSize: size * 0.7 }}
      >
        Lume
      </span>
    </span>
  )
}
