import * as React from 'react'

import { useApp } from '@/contexts/app-context'
import { useNotify } from '@/contexts/notification-context'
import { deriveWalkGate } from '@/lib/walk-gate'

/**
 * 鳴動中のアラームに「歩行検知を有効にする地点」があれば、そこへの到達を監視して
 * 歩行検知を解除する。画面を持たない常駐コンポーネント（ArrivalStopBridge と対）。
 *
 * 停止地点への到達と別のコンポーネントにしてあるのは、片方はエッジへ停止コマンドを
 * 送る操作で、こちらはアプリ内の状態を開くだけと、やることが違うため。
 */
export function WalkUnlockBridge() {
  const {
    alarms,
    ringingStatus,
    stopMethods,
    currentPosition,
    simulatedPosition,
    setSimulatedPosition,
    walkUnlocked,
    unlockWalkDetection,
  } = useApp()
  const notify = useNotify()

  const ringingIds = ringingStatus?.ringingIds ?? []
  const gate = deriveWalkGate({
    alarm: alarms.find((a) => a.id === ringingIds[0]),
    stopMethods,
    position: simulatedPosition ?? currentPosition,
    unlocked: walkUnlocked,
  })

  // effect の依存を「着いたか」と「どこに」だけに絞る。距離は毎秒変わるので、
  // gate をそのまま依存にすると到達していない間も effect が回り続ける
  const arrivedAt = gate.kind === 'locked' && gate.arrived ? gate.point.label : null

  React.useEffect(() => {
    if (arrivedAt === null) return
    unlockWalkDetection()
    notify('success', `${arrivedAt}に到達したため、歩行検知を有効にしました`)
    // 疑似現在地で試した場合はここで解除し、実際の現在地表示に戻す
    setSimulatedPosition(null)
  }, [arrivedAt, unlockWalkDetection, notify, setSimulatedPosition])

  return null
}
