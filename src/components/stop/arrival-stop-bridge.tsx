import * as React from 'react'
import { Option } from 'effect'

import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useRunEffect } from '@/lib/effect-react'
import { distanceMeters } from '@/lib/geo'

/**
 * 鳴動中のアラームに割り当てられた停止地点に到達したかを監視し、
 * 到達したら自動的に停止コマンドを送る。画面を持たない常駐コンポーネント。
 *
 * 停止操作は「その地点まで移動する」以外の方法を用意しないのがこのアプリの前提なので、
 * 手動の停止ボタンは置かず、判定と送信だけをここに集約している。
 */
export function ArrivalStopBridge() {
  const {
    alarms,
    ringingStatus,
    stopMethods,
    sendStopCommand,
    currentPosition,
    simulatedPosition,
    setSimulatedPosition,
  } = useDemo()
  const run = useRunEffect()
  const notify = useNotify()

  // 到達判定は毎フレーム真になりうるため、1回の鳴動につき1度だけ送るよう記録しておく
  const sentForRef = React.useRef<string | null>(null)

  const ringingIds = ringingStatus?.ringingIds ?? []
  const ringingId = ringingIds[0] ?? null
  const effectivePosition = simulatedPosition ?? currentPosition

  const ringingAlarm = ringingId ? (alarms.find((a) => a.id === ringingId) ?? null) : null
  const stopMethod = ringingAlarm?.stopMethodId
    ? (stopMethods.find((m) => m.id === ringingAlarm.stopMethodId) ?? null)
    : null

  const arrived =
    stopMethod != null &&
    effectivePosition != null &&
    distanceMeters(effectivePosition, stopMethod) <= stopMethod.radiusMeters

  // 鳴動が終わったら次の鳴動に備えて送信記録を戻す
  React.useEffect(() => {
    if (ringingId == null) sentForRef.current = null
  }, [ringingId])

  React.useEffect(() => {
    if (!arrived || ringingId == null) return
    if (sentForRef.current === ringingId) return
    sentForRef.current = ringingId

    void (async () => {
      const result = await run(sendStopCommand)
      if (Option.isSome(result)) {
        notify('success', '停止地点に到達したため、アラームを停止しました')
        // 疑似現在地で試した場合はここで解除し、実際の現在地表示に戻す
        setSimulatedPosition(null)
      } else {
        // 失敗の文言は useRunEffect が通知済み。再度到達判定で送れるよう記録を戻す
        sentForRef.current = null
      }
    })()
  }, [arrived, ringingId, run, sendStopCommand, notify, setSimulatedPosition])

  return null
}
