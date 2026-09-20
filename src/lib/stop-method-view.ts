import { sortAlarmsByTime, usesStopMethod, type Alarm } from '@/lib/alarm'
import type { StopMethod } from '@/lib/stop-method'

/**
 * 「停止方法の一覧に何を出すか」を状態から導く純粋関数。
 *
 * 停止方法そのものは座標と半径の記録でしかなく、一覧で要るのは
 * 「どのアラームがこれで止まるのか」＝消してよいのかどうかの判断材料。
 * 一覧の描画から引き剥がして、DOM 無しで固定できるようにしてある。
 */

export type StopMethodRow = {
  method: StopMethod
  /** この地点を使うアラーム（時刻の早い順）。停止地点としても、歩行検知を有効にする地点としても数える */
  usedBy: Alarm[]
  /** 使用中の停止方法は削除できない */
  inUse: boolean
}

export function deriveStopMethodRows(input: {
  stopMethods: readonly StopMethod[]
  alarms: readonly Alarm[]
}): StopMethodRow[] {
  return input.stopMethods.map((method) => {
    const usedBy = sortAlarmsByTime(input.alarms.filter((a) => usesStopMethod(a, method.id)))
    return { method, usedBy, inUse: usedBy.length > 0 }
  })
}
