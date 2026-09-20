import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

/**
 * MapLibre の Worker を Vite でバンドルした URL に差し替える。
 *
 * MapLibre v6 は Worker のパスを実行時に import.meta.url から組み立てるので、
 * Vite はそれを静的に拾えず、本番ビルドに Worker のチャンクが出ない
 * （dev でも依存の事前バンドル先に Worker が無く 404 になる）。
 * どちらもエラーは出ず「タイルだけ描かれない」という壊れ方をするので、
 * 推測に頼らず `?worker&url` で束ねた URL を明示的に渡す。
 *
 * MapLibre を使う側（map-snapshot.ts / vector-tile-layer.tsx）は、Map を作る前に
 * このモジュールを副作用 import しておくこと。
 */
setWorkerUrl(workerUrl)
