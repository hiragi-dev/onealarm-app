/**
 * PWA 用アイコンを依存パッケージなしで生成する。
 *
 * 絵は scripts/icon-source.png（正方形・白背景・青い目覚まし時計）を唯一の元データとして、
 * 目的別の大きさ・余白に焼き直す。デザインを変えたら icon-source.png を差し替えて
 * `npm run icons` を実行する。
 *
 * sharp / canvas のような画像ライブラリは入れていない。やっているのは
 * 「PNG をほどく → 面積平均で縮小 → 合成 → PNG に戻す」だけで、どれも zlib と
 * 自前の数十行で足りる。3MB 超の libvips を devDependency に抱える理由が無い。
 */
import { deflateSync, inflateSync, crc32 } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcPath = join(here, 'icon-source.png')
const outDir = join(here, '..', 'public')

// アイコンの地の色。白背景の source に合わせて、穴埋めも同じ白で敷く。
const BG = [0xff, 0xff, 0xff]
// favicon はタブの地色に馴染ませたいので、白を抜いて青い線だけ残す。
const INK = [0x0b, 0x78, 0xfd]

// --- PNG デコード ---------------------------------------------------------

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** 8bit・非インターレースの truecolor(RGB/RGBA) だけを対象に RGBA へほどく。 */
function decodePng(buf) {
  let pos = 8
  let width = 0
  let height = 0
  let channels = 0
  const idat = []

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const bitDepth = data[8]
      const colorType = data[9]
      const interlace = data[12]
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`unsupported PNG: depth=${bitDepth} color=${colorType} interlace=${interlace}`)
      }
      channels = colorType === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const data = Buffer.alloc(width * height * 4)
  const prev = Buffer.alloc(stride)
  const cur = Buffer.alloc(stride)
  let rp = 0

  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    raw.copy(cur, 0, rp, rp + stride)
    rp += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      if (filter === 1) cur[i] = (cur[i] + a) & 0xff
      else if (filter === 2) cur[i] = (cur[i] + b) & 0xff
      else if (filter === 3) cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) cur[i] = (cur[i] + paeth(a, b, c)) & 0xff
    }
    for (let x = 0; x < width; x++) {
      const si = x * channels
      const di = (y * width + x) * 4
      data[di] = cur[si]
      data[di + 1] = cur[si + 1]
      data[di + 2] = cur[si + 2]
      data[di + 3] = channels === 4 ? cur[si + 3] : 0xff
    }
    cur.copy(prev)
  }

  return { width, height, data }
}

// --- 画像操作 -------------------------------------------------------------

/** 面積平均で縮小する。拡大はしない（用途上すべて縮小）。 */
function resize(img, dw, dh) {
  const { width: sw, height: sh, data } = img
  const out = Buffer.alloc(dw * dh * 4)
  const xr = sw / dw
  const yr = sh / dh

  for (let dy = 0; dy < dh; dy++) {
    const sy0 = dy * yr
    const sy1 = (dy + 1) * yr
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = dx * xr
      const sx1 = (dx + 1) * xr
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let wsum = 0
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1) && sy < sh; sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0)
        if (wy <= 0) continue
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1) && sx < sw; sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0)
          if (wx <= 0) continue
          const w = wx * wy
          const si = (sy * sw + sx) * 4
          r += data[si] * w
          g += data[si + 1] * w
          b += data[si + 2] * w
          a += data[si + 3] * w
          wsum += w
        }
      }
      const di = (dy * dw + dx) * 4
      out[di] = Math.round(r / wsum)
      out[di + 1] = Math.round(g / wsum)
      out[di + 2] = Math.round(b / wsum)
      out[di + 3] = Math.round(a / wsum)
    }
  }

  return { width: dw, height: dh, data: out }
}

function solid(size, color) {
  const data = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = color[0]
    data[i * 4 + 1] = color[1]
    data[i * 4 + 2] = color[2]
    data[i * 4 + 3] = 0xff
  }
  return { width: size, height: size, data }
}

function paste(base, img) {
  const ox = Math.round((base.width - img.width) / 2)
  const oy = Math.round((base.height - img.height) / 2)
  for (let y = 0; y < img.height; y++) {
    const row = ((oy + y) * base.width + ox) * 4
    img.data.copy(base.data, row, y * img.width * 4, (y + 1) * img.width * 4)
  }
  return base
}

/** 白背景を除いたインク（青い時計）の範囲。余白のぶんだけ絵が小さくならないように使う。 */
function contentBounds(img, thresh = 245) {
  const { width, height, data } = img
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i] < thresh || data[i + 1] < thresh || data[i + 2] < thresh) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function crop(img, { minX, minY, width, height }) {
  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = ((minY + y) * img.width + minX) * 4
    img.data.copy(out, y * width * 4, from, from + width * 4)
  }
  return { width, height, data: out }
}

/** 外接矩形の中心から一番遠いインクまでの距離。安全領域への収まりは対角ではなくこれで測る。 */
function inkRadius(img, bounds) {
  let radius = 0
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      const i = ((bounds.minY + y) * img.width + bounds.minX + x) * 4
      if (img.data[i] >= 245 && img.data[i + 1] >= 245 && img.data[i + 2] >= 245) continue
      const d = Math.hypot(x - bounds.width / 2, y - bounds.height / 2)
      if (d > radius) radius = d
    }
  }
  return radius
}

/** 白い正方形に、時計の絵だけを glyphMax（長辺の px）で中央に置く。 */
function compose(src, bounds, size, glyphMax) {
  const glyph = crop(src, bounds)
  const scale = glyphMax / Math.max(glyph.width, glyph.height)
  const scaled = resize(glyph, Math.round(glyph.width * scale), Math.round(glyph.height * scale))
  return paste(solid(size, BG), scaled)
}

/** 白を透明に抜いて、青い線だけの RGBA にする（favicon 用）。 */
function toInk(img) {
  const { width, height, data } = img
  const out = Buffer.alloc(width * height * 4)
  const denom = 255 - INK[1] // 青の G 成分が白との差が一番大きいので濃度の尺度に使う
  for (let i = 0; i < width * height; i++) {
    let alpha = (255 - data[i * 4 + 1]) / denom
    if (alpha < 0.04) alpha = 0
    if (alpha > 1) alpha = 1
    out[i * 4] = INK[0]
    out[i * 4 + 1] = INK[1]
    out[i * 4 + 2] = INK[2]
    out[i * 4 + 3] = Math.round(alpha * 255)
  }
  return { width, height, data: out }
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

const src = decodePng(readFileSync(srcPath))
const bounds = contentBounds(src)
const ink = inkRadius(src, bounds)

// maskable の安全領域は直径 80% の円。時計の一番張り出した点がその半径（40%）に
// 収まるよう縮める。外接矩形の対角で測ると、四隅が白いぶん余計に小さくなる。
const glyphMax = Math.max(bounds.width, bounds.height)
const maskMax = ((0.4 * glyphMax) / ink) * 512

const targets = [
  // 通常アイコンは source と同じ 8% ほどの余白を残す。
  { file: 'pwa-192x192.png', size: 192, image: () => compose(src, bounds, 192, 0.84 * 192) },
  { file: 'pwa-512x512.png', size: 512, image: () => compose(src, bounds, 512, 0.84 * 512) },
  // maskable は端が円や角丸で切られる。背景を全面に敷き、絵を安全領域へ縮める。
  {
    file: 'maskable-icon-512x512.png',
    size: 512,
    image: () => compose(src, bounds, 512, maskMax),
  },
  // iOS は自前で角丸にマスクする。四隅が切られるので通常より少し小さめに置く。
  {
    file: 'apple-touch-icon-180x180.png',
    size: 180,
    image: () => compose(src, bounds, 180, 0.78 * 180),
  },
  // favicon はタブで見えるよう、余白を詰めた透明抜きの青い時計。
  { file: 'favicon-32x32.png', size: 32, image: () => resize(toInk(crop(src, bounds)), 32, 32) },
  { file: 'favicon-16x16.png', size: 16, image: () => resize(toInk(crop(src, bounds)), 16, 16) },
]

mkdirSync(outDir, { recursive: true })

for (const { file, size, image } of targets) {
  writeFileSync(join(outDir, file), encodePng(size, image().data))
  console.log(`generated public/${file}`)
}
