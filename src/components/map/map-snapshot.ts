import { Map as MaplibreMap } from 'maplibre-gl'

import '@/components/map/maplibre-setup'
import { MAP_STYLE_URL } from '@/components/map/tile-source'
import type { GeoPoint } from '@/lib/geo'

/**
 * 地図の静止画を MapLibre で撮って data URL として返す。
 *
 * ベクタタイルには <img> で並べられる画像が無い。かといって一覧の行ごとに
 * MapLibre（WebGL コンテキスト）を立てると、行が増えるほど重くなり、
 * ブラウザのコンテキスト上限（十数個）にも当たる。そこで画面外に 1 枚だけ
 * 地図を置き、頼まれた地点を順に映してはキャンバスを画像に落とす。
 * 表示側は <img> を並べるだけで済み、行数が増えても地図は 1 枚のまま。
 *
 * 同じ地点・縮尺・大きさの要求は結果を使い回す。順番待ちを Promise の
 * 直列でつないでいるのは、共有の地図が 1 枚なので同時に 2 地点を映せないため。
 */

export type SnapshotRequest = {
  center: GeoPoint
  /** 256px タイル基準（Leaflet / OSM と同じ）の縮尺。MapLibre へ渡すときに 1 引く */
  zoom: number
  /** CSS ピクセル。実際の画像は devicePixelRatio 倍で撮れる */
  width: number
  height: number
}

const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

let shared: { map: MaplibreMap; container: HTMLDivElement } | null = null

function requestKey(r: SnapshotRequest): string {
  return `${r.center.lat},${r.center.lng}/${r.zoom}/${r.width}x${r.height}`
}

function getSharedMap() {
  if (shared) return shared

  // display:none だと WebGL が描けないので、画面外に固定して置く
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-10000px;top:0;width:256px;height:256px;pointer-events:none'
  container.setAttribute('aria-hidden', 'true')
  document.body.appendChild(container)

  const map = new MaplibreMap({
    container,
    style: MAP_STYLE_URL,
    interactive: false,
    attributionControl: false,
    // toDataURL で描画結果を読むには描画バッファを保持させる必要がある
    canvasContextAttributes: { preserveDrawingBuffer: true },
    // タイルのフェードインを待たずに撮れるようにする
    fadeDuration: 0,
  })

  shared = { map, container }
  return shared
}

/** 描画が落ち着く（タイルが揃って再描画待ちが無くなる）まで待つ */
function waitForIdle(map: MaplibreMap): Promise<void> {
  return new Promise((resolve) => {
    map.once('idle', () => resolve())
  })
}

async function render(r: SnapshotRequest): Promise<string> {
  const { map, container } = getSharedMap()
  container.style.width = `${r.width}px`
  container.style.height = `${r.height}px`
  map.resize()
  // MapLibre の zoom は 512px タイル基準で、同じ数字だと Leaflet より 1 段寄る
  map.jumpTo({ center: [r.center.lng, r.center.lat], zoom: r.zoom - 1 })
  await waitForIdle(map)
  return map.getCanvas().toDataURL('image/png')
}

export function snapshotMap(r: SnapshotRequest): Promise<string> {
  const key = requestKey(r)
  const hit = cache.get(key)
  if (hit) return hit

  const result = queue.then(() => render(r))
  // 失敗しても次の要求が詰まらないよう、待ち行列には失敗を握りつぶした版を積む
  queue = result.catch(() => undefined)
  cache.set(key, result)
  result.catch(() => cache.delete(key))
  return result
}
