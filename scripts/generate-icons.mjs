import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const svgIcon = readFileSync(join(root, 'public/icons/icon.svg'))
const svgMaskable = readFileSync(join(root, 'public/icons/icon-maskable.svg'))

const sizes = [
  { src: svgIcon,      out: 'icon-192.png',          size: 192 },
  { src: svgIcon,      out: 'icon-512.png',           size: 512 },
  { src: svgIcon,      out: 'apple-touch-icon.png',   size: 180 },
  { src: svgMaskable,  out: 'icon-maskable-512.png',  size: 512 },
]

for (const { src, out, size } of sizes) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public/icons', out))
  console.log(`✓ ${out} (${size}x${size})`)
}
