import * as React from 'react'

import { snapshotMap } from '@/components/map/map-snapshot'
import type { GeoPoint } from '@/lib/geo'
import { cn } from '@/lib/utils'

/**
 * 一覧の行に並べる、操作できない小さな地図。
 *
 * Leaflet や MapLibre の地図を行の数だけ置くと、1件につき地図インスタンスと
 * イベント購読（MapLibre なら WebGL コンテキストも）が増えてスクロールが重くなる。
 * ここでは共有の 1 枚（map-snapshot.ts）で撮った画像を <img> で出すだけにしてあり、
 * 何行並べても実質ただの画像リストになる。
 * 触れないので「場所を確かめる」以上のことはできない。動かしたいときは
 * これをタップして全画面の地図（LocationPickerMap）を開く、という役割分担。
 *
 * **利用側で MAP_ATTRIBUTION_TEXT の帰属表示を必ず出すこと。**
 * 画像に落としているぶん、地図側の帰属表示がここには無い。
 */

/** その緯度・縮尺での 1px あたりのメートル数（256px タイル基準） */
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
  // 行ごとに縮尺が散らばりすぎても比べにくいので幅を狭く取る
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

  // 枠の大きさは CSS 側（w-full や h-14）で決まるので、測ってから撮る大きさを決める。
  // 先に測らずに大きめに撮ると、見えない範囲まで描かせることになる
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
      // 画像が届くまでの下地。読み込み中に白く光らないよう暗い色にする
      className={cn('relative overflow-hidden bg-muted', className)}
      aria-hidden
    >
      {size && size.width > 0 && size.height > 0 && (
        <Snapshot point={point} radiusMeters={radiusMeters} {...size} />
      )}
    </div>
  )
}

function Snapshot({
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
  const { lat, lng } = point
  const zoom = fitZoom(lat, radiusMeters ?? 50, Math.min(width, height))
  // 撮った画像は「どの要求の結果か」と一緒に持ち、今の要求と一致するときだけ出す。
  // 要求が変わった瞬間に effect で null に戻す書き方だと、描画直後の setState に
  // なって lint に落ちるうえ、一致判定で済む話に再描画を 1 回足すことになる
  const requestKey = `${lat},${lng}/${zoom}/${width}x${height}`
  const [snap, setSnap] = React.useState<{ key: string; url: string } | null>(null)

  // 撮影の失敗（オフラインなど）は下地の色が残るだけで操作を妨げないので、
  // 通知には上げず、画像を出さないままにする
  React.useEffect(() => {
    let cancelled = false
    snapshotMap({ center: { lat, lng }, zoom, width, height }).then(
      (url) => {
        if (!cancelled) setSnap({ key: requestKey, url })
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [lat, lng, zoom, width, height, requestKey])

  const src = snap?.key === requestKey ? snap.url : null

  const circleDiameter = radiusMeters ? (radiusMeters * 2) / metersPerPixel(lat, zoom) : null

  return (
    <>
      {src && (
        <img
          src={src}
          alt=""
          width={width}
          height={height}
          decoding="async"
          // 明るい地図は黒い画面の中で浮くので、少しだけ落として馴染ませる
          className="pointer-events-none absolute inset-0 max-w-none brightness-90 saturate-90"
        />
      )}

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
