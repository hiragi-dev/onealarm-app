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
  const effectivePosition = simulatedPosition ?? currentPosition

  /**
   * 鳴動中の全アラームを見て、どれか1つでも停止地点に到達していれば送る。
   *
   * 先頭1件だけを見ると、そのアラームに停止方法が未設定だった場合に
   * 2件目以降の到達を永久に検知できず、歩いても止まらなくなる。
   * stop コマンドはどのアラームを止めるか指定できない仕様なので、
   * 1件でも到達していれば送ってよい。
   */
  const arrivedId =
    effectivePosition == null
      ? null
      : (ringingIds.find((id) => {
          const alarm = alarms.find((a) => a.id === id)
          if (!alarm?.stopMethodId) return false
          const method = stopMethods.find((m) => m.id === alarm.stopMethodId)
          if (!method) return false
          return distanceMeters(effectivePosition, method) <= method.radiusMeters
        }) ?? null)

  // 鳴動中のアラームの組。これが変わったら別の鳴動として扱う
  const ringingKey = ringingIds.join(',')

  // 鳴動が終わったら次の鳴動に備えて送信記録を戻す
  React.useEffect(() => {
    if (ringingKey === '') sentForRef.current = null
  }, [ringingKey])

  React.useEffect(() => {
    if (arrivedId == null) return
    if (sentForRef.current === ringingKey) return
    sentForRef.current = ringingKey

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
  }, [arrivedId, ringingKey, run, sendStopCommand, notify, setSimulatedPosition])

  return null
}
