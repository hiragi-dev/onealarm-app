export type GeoPoint = { lat: number; lng: number }

/** 2地点間の距離をハーバーサイン公式で計算する（メートル） */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const EARTH_RADIUS_M = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 距離を「◯ m」「◯ km」に整形する。未取得は「—」 */
export function formatDistance(meters: number | null): string {
  if (meters == null) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`
}
