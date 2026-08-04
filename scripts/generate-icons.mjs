/**
 * PWA 用アイコンを依存パッケージなしで生成する。
 * デザインを変えたら `node scripts/generate-icons.mjs` で public/ を作り直す。
 */
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BG = [0x0a, 0x0a, 0x0a]
const FG = [0xfa, 0xfa, 0xfa]

// --- 形状ヘルパー（座標は 0..1 に正規化） ---------------------------------

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

const disc = (x, y, cx, cy, r) => dist(x, y, cx, cy) <= r

const ring = (x, y, cx, cy, r, w) => Math.abs(dist(x, y, cx, cy) - r) <= w / 2

function capsule(x, y, ax, ay, bx, by, w) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
  return dist(x, y, ax + t * dx, ay + t * dy) <= w / 2
}

function roundedRect(x, y, r) {
  const cx = Math.min(x, 1 - x)
  const cy = Math.min(y, 1 - y)
  if (cx >= r || cy >= r) return true
  return dist(cx, cy, r, r) <= r
}

/** 目覚まし時計のグリフ。scale で全体を中心基準に縮小する。 */
function glyph(px, py, scale) {
  const x = (px - 0.5) / scale + 0.5
  const y = (py - 0.5) / scale + 0.5

  const cx = 0.5
  const cy = 0.545
  const r = 0.3
  const stroke = 0.058

  // 文字盤
  if (ring(x, y, cx, cy, r, stroke)) return true
  // ベル
  const bellR = r * 0.3
  if (disc(x, y, cx - r * 0.78, cy - r * 0.78, bellR)) return true
  if (disc(x, y, cx + r * 0.78, cy - r * 0.78, bellR)) return true
  // 脚
  if (capsule(x, y, cx - r * 0.6, cy + r * 0.75, cx - r * 0.95, cy + r * 1.1, stroke * 0.9))
    return true
  if (capsule(x, y, cx + r * 0.6, cy + r * 0.75, cx + r * 0.95, cy + r * 1.1, stroke * 0.9))
    return true
  // 針
  if (capsule(x, y, cx, cy, cx, cy - r * 0.6, stroke * 0.8)) return true
  if (capsule(x, y, cx, cy, cx + r * 0.45, cy + r * 0.08, stroke * 0.8)) return true
  if (disc(x, y, cx, cy, stroke * 0.55)) return true

  return false
}

// --- ラスタライズ ---------------------------------------------------------

const SS = 3 // スーパーサンプリング倍率（アンチエイリアス用）

function render(size, { corner, glyphScale }) {
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0
      let fgHits = 0

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          if (!roundedRect(x, y, corner)) continue
          bgHits++
          if (glyph(x, y, glyphScale)) fgHits++
        }
      }

      const total = SS * SS
      const alpha = bgHits / total
      const fg = bgHits === 0 ? 0 : fgHits / bgHits
      const i = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(BG[c] * (1 - fg) + FG[c] * fg)
      }
      rgba[i + 3] = Math.round(alpha * 255)
    }
  }

  return rgba
}

// --- PNG エンコード -------------------------------------------------------

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA

  // 各スキャンラインの先頭にフィルタタイプ 0 を付ける。
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- 出力 -----------------------------------------------------------------

const targets = [
  { file: 'pwa-192x192.png', size: 192, corner: 0.22, glyphScale: 1 },
  { file: 'pwa-512x512.png', size: 512, corner: 0.22, glyphScale: 1 },
  // maskable は端が切られるので背景を全面に敷き、グリフを安全領域に収める。
  { file: 'maskable-icon-512x512.png', size: 512, corner: 0, glyphScale: 0.7 },
  // iOS は自前でマスクするため角丸なしの正方形を渡す。
  { file: 'apple-touch-icon-180x180.png', size: 180, corner: 0, glyphScale: 0.88 },
]

mkdirSync(outDir, { recursive: true })

for (const { file, size, corner, glyphScale } of targets) {
  writeFileSync(join(outDir, file), encodePng(size, render(size, { corner, glyphScale })))
  console.log(`generated public/${file}`)
}
