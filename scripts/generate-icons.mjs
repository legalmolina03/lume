/**
 * Renders the Lume starburst into the PNG sizes the PWA manifest needs.
 *
 * Run with `npm run icons`. Regenerate whenever the mark changes — the shapes
 * here are kept in sync with src/components/LumeMark.tsx by hand.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

const BACKGROUND = '#0b0b14'

// The mark carries a fixed blue-to-violet gradient. It deliberately does NOT
// follow the user's accent setting: a home-screen icon that changed colour
// when you changed a preference would stop being recognisable at a glance.
const GRADIENT_FROM = '#60a5fa'
const GRADIENT_TO = '#8b5cf6'

/**
 * @param {number} size
 * @param {boolean} maskable Maskable icons need the mark inside the safe zone,
 *   so it is drawn smaller with more padding around it.
 */
function svg(size, maskable = false) {
  // The mark is authored on a 24x24 grid; scale and centre it.
  const scale = (size / 24) * (maskable ? 0.56 : 0.72)
  const offset = (size - 24 * scale) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GRADIENT_FROM}"/>
      <stop offset="100%" stop-color="${GRADIENT_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M12 1.5c.65 5.6 4.9 9.85 10.5 10.5-5.6.65-9.85 4.9-10.5 10.5-.65-5.6-4.9-9.85-10.5-10.5C7.1 11.35 11.35 7.1 12 1.5Z" fill="url(#mark)"/>
    <path d="M19.4 2.2c.24 2.03 1.77 3.56 3.8 3.8-2.03.24-3.56 1.77-3.8 3.8-.24-2.03-1.77-3.56-3.8-3.8 2.03-.24 3.56-1.77 3.8-3.8Z" fill="url(#mark)" opacity="0.6"/>
  </g>
</svg>`
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

await mkdir(outDir, { recursive: true })

for (const { file, size, maskable } of targets) {
  const png = await sharp(Buffer.from(svg(size, maskable))).png().toBuffer()
  await writeFile(resolve(outDir, file), png)
  console.log(`wrote public/icons/${file} (${size}x${size})`)
}

// The favicon stays vector — it scales better in browser tabs.
await writeFile(resolve(root, 'public/favicon.svg'), svg(64))
console.log('wrote public/favicon.svg')
