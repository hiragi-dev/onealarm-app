import type { GeoPoint } from '@/lib/geo'

/**
 * ユーザーが登録した「アラームの止め方」のうち位置情報ベースのもの。
 * 複数登録でき、それぞれ好きな名前(label)を付けられる。アラーム側は
 * stopMethodId でこのうちどれを使うかを参照する（1つのアラームにつき1つ、必須）。
 * 本来はエッジデバイスへ座標を送らないブラウザ内だけの概念だが、
 * この再構成ではダミーデータとしてメモリ上に保持する。
 */
export type StopMethod = GeoPoint & {
  id: string
  label: string
  radiusMeters: number
  createdAt: number
}

export type StopMethodInput = {
  label: string
  lat: number
  lng: number
  radiusMeters: number
}

export const DEFAULT_STOP_METHOD_RADIUS_METERS = 20
export const MIN_STOP_METHOD_RADIUS_METERS = 5
export const MAX_STOP_METHOD_RADIUS_METERS = 200

/**
 * 停止方法が1つも無いと、新しいアラームに割り当てる停止条件を選べない
 * （アラームごとに停止方法は必須・1つ）。一覧の＋ボタンをここで止め、
 * ウィザードを開いた後に手詰まりで気づく、という体験を避ける。
 */
export function canCreateAlarm(stopMethods: readonly StopMethod[]): boolean {
  return stopMethods.length > 0
}
