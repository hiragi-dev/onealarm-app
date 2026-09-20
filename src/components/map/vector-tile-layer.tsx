import * as React from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import '@maplibre/maplibre-gl-leaflet'

import '@/components/map/maplibre-setup'
import { MAP_STYLE_URL } from '@/components/map/tile-source'

/**
 * Leaflet の地図に OpenFreeMap のベクタタイルを載せるレイヤー。
 *
 * react-leaflet には対応するコンポーネントが無いので、useMap で Leaflet の
 * インスタンスを取り、公式バインディング（@maplibre/maplibre-gl-leaflet）の
 * レイヤーを直接 add / remove する。
 *
 * 帰属表示はバインディングがスタイルの sources から拾って Leaflet の
 * attribution control に足すため、ここでは何もしない。
 */
export function VectorTileLayer() {
  const map = useMap()

  React.useEffect(() => {
    const layer = L.maplibreGL({ style: MAP_STYLE_URL })
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [map])

  return null
}
