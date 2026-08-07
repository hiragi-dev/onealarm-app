import * as React from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'

import {
  MAP_ACCENT_COLOR,
  currentLocationIcon,
  stopPointIcon,
} from '@/components/map/marker-icons'
import type { GeoPoint } from '@/lib/geo'

type Props = {
  /** 停止地点 */
  target: GeoPoint
  /** 停止地点の到達判定半径(m) */
  radiusMeters: number
  /** 実効現在地。未取得なら null（停止地点だけを描く） */
  position: GeoPoint | null
}

/**
 * 鳴動中に「登録した停止地点」と「現在位置」の位置関係を見せる小さな地図。
 *
 * 地点を選ぶための location-picker-map とは責務が逆で、こちらは一切操作させない。
 * 鳴動中にできることは移動だけであり、地図をずらせると
 * 「今どこを見ているのか」が分からなくなって現在地を見失うため、
 * ドラッグもズームも全て切り、表示範囲はこちらで決めきる。
 */
export function RingingMiniMap({ target, radiusMeters, position }: Props) {
  return (
    // 距離の数字が主役なので、地図はその補足として低い背丈に抑える
    <div className="h-40 w-full overflow-hidden rounded-xl border" aria-hidden="true">
      <MapContainer
        center={[target.lat, target.lng]}
        zoom={16}
        maxZoom={19}
        className="size-full"
        dragging={false}
        touchZoom={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToBoth target={target} radiusMeters={radiusMeters} position={position} />

        <Circle
          center={[target.lat, target.lng]}
          radius={radiusMeters}
          interactive={false}
          pathOptions={{
            color: MAP_ACCENT_COLOR,
            fillColor: MAP_ACCENT_COLOR,
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
        {position && (
          <>
            {/* 現在地と停止地点を結んで、どちらへ向かうのかを一目で分かるようにする */}
            <Polyline
              positions={[
                [position.lat, position.lng],
                [target.lat, target.lng],
              ]}
              interactive={false}
              pathOptions={{
                color: MAP_ACCENT_COLOR,
                weight: 2,
                opacity: 0.8,
                dashArray: '6 6',
              }}
            />
            <Marker
              position={[position.lat, position.lng]}
              icon={currentLocationIcon}
              interactive={false}
            />
          </>
        )}
        <Marker position={[target.lat, target.lng]} icon={stopPointIcon} interactive={false} />
      </MapContainer>
    </div>
  )
}

/** 停止地点の到達判定円と現在地の両方が収まるよう表示範囲を合わせる */
function FitToBoth({ target, radiusMeters, position }: Props) {
  const map = useMap()

  // 依存配列に載せるため、任意の現在地を単純な値へ開いておく
  const posLat = position?.lat ?? null
  const posLng = position?.lng ?? null

  // 親のフェードイン中にコンテナのサイズを測るとタイルが並び損ねることがあるため、
  // 一度測り直してから範囲合わせに入る（この効果が先に走る）
  React.useEffect(() => {
    map.invalidateSize()
  }, [map])

  React.useEffect(() => {
    // 到達判定円がちょうど収まる範囲を土台にし、現在地があれば足す
    const bounds = L.latLng(target.lat, target.lng).toBounds(radiusMeters * 2.5)
    if (posLat != null && posLng != null) bounds.extend([posLat, posLng])

    // GPS は静止していても数メートル揺れる。その度に合わせ直すと地図が
    // 絶えず動いて寝起きには読めないので、今の表示に収まっている限り動かさない
    if (map.getBounds().pad(-0.15).contains(bounds)) return

    // 到達間際は両点がほぼ重なる。maxZoom が無いと過剰に寄って何も分からなくなる
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false })
  }, [map, target.lat, target.lng, radiusMeters, posLat, posLng])

  return null
}
