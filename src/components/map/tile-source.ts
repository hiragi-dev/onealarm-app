/**
 * 地図の描画元。OpenFreeMap のベクタタイルを使う。
 *
 * OSM の標準ラスタタイルはボランティア運営でアプリからの常用を歓迎しておらず、
 * Referer の有無で「Blocked」画像を返すこともあった。OpenFreeMap は API キー不要・
 * 利用制限なしを掲げており、帰属表示だけ守ればよい。
 *
 * ベクタタイルなので、描画には MapLibre GL が要る。Leaflet の地図は
 * `vector-tile-layer.tsx` が MapLibre をレイヤーとして載せ、
 * 一覧のサムネイルは `map-snapshot.ts` が MapLibre で撮った画像を使う。
 */

/**
 * bright は OSM 標準に近い配色で、道と地名が読みやすい。
 * liberty も近い配色だが建物を立体（fill-extrusion）で描くため、停止地点の寄りの縮尺で
 * 道が建物に隠れて読みにくい。positron は淡すぎて到達円が浮く。
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

/**
 * 帰属表示（文字だけ）。Leaflet の地図はスタイルに含まれる帰属をバインディングが
 * 自動で出すのでこれは要らない。スナップショット画像には何も付かないので、
 * 画像を並べる側がこれを出す。
 */
export const MAP_ATTRIBUTION_TEXT =
  '地図 © OpenFreeMap © OpenMapTiles ・ データ © OpenStreetMap contributors'
