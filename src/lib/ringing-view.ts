import type { Alarm, RingingStatus } from '@/lib/alarm'
import { distanceMeters, type GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'

/**
 * 「今、鳴動停止画面に何を描くべきか」を状態から一意に導く純粋関数と、その結果の型。
 *
 * 描画判断をコンポーネントから引き剥がしておくことで、
 * 「エッジが鳴らしている＝停止画面が出る」を DOM 無しの node テストで固定できる
 * （実際に画面へ出すのは RingingTakeover が ts-pattern で網羅描画する）。
 */

/** 停止方法の有無で分かれる、鳴動中に見せる中身 */
export type RingingTarget =
  | { kind: 'no-method' }
  | {
      kind: 'with-method'
      stopMethod: StopMethod
      /** 停止地点までの距離（メートル）。現在地が未取得なら null（測位待ち） */
      distanceToTarget: number | null
      hasArrived: boolean
      /**
       * 距離の算出に使った実効現在地。未取得なら null。
       * 地図に現在地を打つには座標そのものが要るので、距離と併せて外に出す。
       */
      position: GeoPoint | null
    }

/** 鳴動停止画面の表示状態 */
export type RingingView = { kind: 'silent' } | { kind: 'ringing'; target: RingingTarget }

export type RingingViewInput = {
  ringingStatus: RingingStatus | null
  alarms: Alarm[]
  stopMethods: StopMethod[]
  /** 疑似現在地を優先した「実効現在地」。未取得なら null */
  position: GeoPoint | null
}

export function deriveRingingView(input: RingingViewInput): RingingView {
  // isRinging フラグではなく ringingIds の有無で判定する。
  // 実際に止める対象（先頭のアラーム）を辿れることが表示の前提だから
  const ringingIds = input.ringingStatus?.ringingIds ?? []
  if (ringingIds.length === 0) return { kind: 'silent' }

  // 複数同時鳴動は先頭の1件だけを見る（簡易表示）
  const ringingAlarm = input.alarms.find((a) => a.id === ringingIds[0])
  const stopMethod = input.stopMethods.find((m) => m.id === ringingAlarm?.stopMethodId)

  if (!stopMethod) return { kind: 'ringing', target: { kind: 'no-method' } }

  const distanceToTarget = input.position ? distanceMeters(input.position, stopMethod) : null
  const hasArrived = distanceToTarget !== null && distanceToTarget <= stopMethod.radiusMeters

  return {
    kind: 'ringing',
    target: {
      kind: 'with-method',
      stopMethod,
      distanceToTarget,
      hasArrived,
      position: input.position,
    },
  }
}
