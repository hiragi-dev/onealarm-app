import L from 'leaflet'

/**
 * 地図上のマーカー見た目。地点選択（location-picker-map）と
 * 鳴動中のミニマップ（ringing-mini-map）で同じ意味には同じ絵を使う。
 */

// Leaflet の既定マーカー画像はバンドラー経由だとパスが壊れるため、
// public/leaflet/ に置いた実体を直接参照するよう上書きする
export const stopPointIcon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// 現在地を表す青い丸ドット（停止地点のピンとは見た目を分ける）
export const currentLocationIcon = L.divIcon({
  className: '',
  html:
    '<div style="width:16px;height:16px;border-radius:50%;background:#4285F4;' +
    'border:2px solid #fff;box-shadow:0 0 0 2px rgba(66,133,244,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/** 停止地点の到達判定円・現在地との導線に使う色 */
export const MAP_ACCENT_COLOR = '#4285F4'
