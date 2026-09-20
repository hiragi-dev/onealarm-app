import type { Alarm } from '@/lib/alarm'
import { distanceMeters, type GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'

/**
 * 「今、歩行検知を有効にしてよいか」を状態から一意に導く純粋関数。
 *
 * 歩いている間はアラームが一時停止する。NFC 認証はその一時停止を許可する経路だが、
 * 別アプリから手で実行できてしまい抜け道になっていた。そこで位置に紐づく経路を
 * 別に設け、アラームに「歩行検知を有効にする地点」を持たせる。
 * 鳴動中はその地点に着くまで歩行検知を働かせない、というのがこの関数の判断。
 *
 * 一度着いたら（unlocked）その鳴動の間は開いたままにする。地点を離れた途端に
 * 閉じ直すと、停止地点へ向かう道中で一時停止が切れて本末転倒になるため。
 */

export type WalkGate =
  | { kind: 'open' }
  | {
      kind: 'locked'
      point: StopMethod
      /** 地点までの距離（メートル）。現在地が未取得なら null */
      distance: number | null
      /** 到達判定の半径に入ったか。これが true になった鳴動は unlocked にしてよい */
      arrived: boolean
    }

export function deriveWalkGate(input: {
  /** 鳴っているアラーム。無ければ判断する対象が無いので open */
  alarm: Alarm | undefined
  stopMethods: readonly StopMethod[]
  position: GeoPoint | null
  /** この鳴動でもう地点に着いたか */
  unlocked: boolean
}): WalkGate {
  const pointId = input.alarm?.walkUnlockPointId ?? null
  if (pointId === null || input.unlocked) return { kind: 'open' }

  const point = input.stopMethods.find((m) => m.id === pointId)
  // 参照先の地点が消えていたら閉じたままにしない。開けられない鍵になってしまう
  if (!point) return { kind: 'open' }

  const distance = input.position ? distanceMeters(input.position, point) : null
  return {
    kind: 'locked',
    point,
    distance,
    arrived: distance !== null && distance <= point.radiusMeters,
  }
}
