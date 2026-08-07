import * as React from 'react'

import type { GeoPoint } from '@/lib/geo'
import { cn } from '@/lib/utils'

/**
 * 一覧の行に並べる、操作できない小さな地図。
 *
 * Leaflet の地図を行の数だけ置くと、1件につき地図インスタンスとイベント購読が増えて
 * スクロールが重くなる。ここでは必要なタイル画像を自分で並べるだけにしてあり、
 * 中身は <img> の集まりなので何枚並べても実質ただの画像リストになる。
 * 触れないので「場所を確かめる」以上のことはできない。動かしたいときは
 * これをタップして全画面の地図（LocationPickerMap）を開く、という役割分担。
 *
 * **利用側で「地図データ © OpenStreetMap contributors」の表示を必ず出すこと。**
 * タイルを直接読んでいるぶん、Leaflet が付ける出典表示がここには無い。
 */

const TILE_SIZE = 256

/** タイルの提供元。Leaflet 側（LocationPickerMap）と同じ OSM の標準タイルに揃える */
const TILE_URL = (zoom: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`

/** 緯度経度を、その縮尺での世界全体のピクセル座標に写す（Webメルカトル） */
function project(point: GeoPoint, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom
  const sinLat = Math.sin((point.lat * Math.PI) / 180)
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

/** その緯度・縮尺での 1px あたりのメートル数 */
function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/**
 * 到達判定の円が枠の半分ほどに見える縮尺を選ぶ。
 * 半径は 5m から 200m まで開きがあり、固定の縮尺だと
 * 「点にしか見えない」か「枠からはみ出す」のどちらかになるため。
 */
function fitZoom(lat: number, radiusMeters: number, minSidePx: number): number {
  const target = (4 * radiusMeters) / minSidePx
  const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / target)
  // 19 より上はタイルが無い。行ごとに縮尺が散らばりすぎても比べにくいので幅を狭く取る
  return Math.min(18, Math.max(14, Math.floor(zoom)))
}

type Props = {
  point: GeoPoint
  /** 描くと到達判定の輪が出る。縮尺もこの半径に合わせる */
  radiusMeters?: number
  className?: string
}

export function StaticMapPreview({ point, radiusMeters, className }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)

  // 枠の大きさは CSS 側（w-full や h-14）で決まるので、測ってから必要なタイルを決める。
  // 先に測らずに広めに並べると、見えないタイルまで取りに行くことになる
  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      // タイルが届くまでの下地。読み込み中に白く光らないよう地図の海と同じ色にする
      className={cn('relative overflow-hidden bg-[#1c1c1e]', className)}
      aria-hidden
    >
      {size && size.width > 0 && size.height > 0 && (
        <Tiles point={point} radiusMeters={radiusMeters} {...size} />
      )}
    </div>
  )
}

function Tiles({
  point,
  radiusMeters,
  width,
  height,
}: {
  point: GeoPoint
  radiusMeters?: number
  width: number
  height: number
}) {
  const zoom = fitZoom(point.lat, radiusMeters ?? 50, Math.min(width, height))
  const center = project(point, zoom)
  const tileCount = 2 ** zoom

  // 枠に写る範囲（世界ピクセル座標）から、必要なタイルの番号を割り出す
  const left = center.x - width / 2
  const top = center.y - height / 2
  const tiles: { key: string; url: string; left: number; top: number }[] = []

  for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + width) / TILE_SIZE); tx++) {
    for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + height) / TILE_SIZE); ty++) {
      // 縦は世界の端で折り返さない（存在しないタイルを取りに行かない）
      if (ty < 0 || ty >= tileCount) continue
      // 横は日付変更線をまたいで一周する
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount
      tiles.push({
        key: `${tx}-${ty}`,
        url: TILE_URL(zoom, wrappedX, ty),
        left: tx * TILE_SIZE - left,
        top: ty * TILE_SIZE - top,
      })
    }
  }

  const circleDiameter = radiusMeters
    ? (radiusMeters * 2) / metersPerPixel(point.lat, zoom)
    : null

  return (
    <>
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          loading="lazy"
          decoding="async"
          /* タイルの URL 自体が停止地点の座標なので、タイルサーバには位置が渡る。
             せめてどのアプリの利用者かまでは紐づけさせない */
          referrerPolicy="no-referrer"
          // 明るい OSM タイルは黒い画面の中で浮くので、少しだけ落として馴染ませる
          className="pointer-events-none absolute max-w-none brightness-90 saturate-90"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {/* 到達判定の輪。中心が停止地点になるよう枠の中央に固定する */}
      {circleDiameter !== null && (
        <span
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/20"
          style={{ width: circleDiameter, height: circleDiameter }}
        />
      )}
      <span className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-1 ring-black/60" />
    </>
  )
}
