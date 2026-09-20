import * as React from 'react'
import { Effect } from 'effect'

import { useApp } from '@/contexts/app-context'
import { deriveWalkGate } from '@/lib/walk-gate'

/** 1回の pause で止める時間 */
const PAUSE_DURATION_MS = 5000
/** 歩行が続く間、止まる時間が切れる前に送り直す間隔 */
const RESEND_INTERVAL_MS = 2000

/**
 * 「歩いている間はアラームが一時停止する」を実現する常駐処理（画面なし）。
 *
 * 鳴動中・歩行中・接続中・歩行検知が有効（walk-gate が open）の 4 つが揃っている間、
 * デバイスへ pause を送り続けて鳴り止んだ状態を延ばす。デバイス側の pause は
 * 上書き式で積み上がらないので、期限が切れる前に送り直す必要がある。
 *
 * 送り損ね（未接続・エッジ無応答）は通知に上げない。鳴っている最中に 2 秒ごとに
 * 同じ通知が積まれるだけで、利用者にできることが無いため。ログには残る
 */
export function WalkPauseBridge() {
  const {
    alarms,
    ringingStatus,
    stopMethods,
    currentPosition,
    simulatedPosition,
    isWalking,
    walkUnlocked,
    status,
    sendPauseCommand,
  } = useApp()

  const ringingIds = ringingStatus?.ringingIds ?? []
  const gate = deriveWalkGate({
    alarm: alarms.find((a) => a.id === ringingIds[0]),
    stopMethods,
    position: simulatedPosition ?? currentPosition,
    unlocked: walkUnlocked,
  })

  const shouldPause =
    ringingIds.length > 0 && isWalking && status === 'connected' && gate.kind === 'open'

  React.useEffect(() => {
    if (!shouldPause) return
    const send = () => {
      void Effect.runPromise(sendPauseCommand(PAUSE_DURATION_MS).pipe(Effect.ignore))
    }
    send()
    const id = setInterval(send, RESEND_INTERVAL_MS)
    return () => clearInterval(id)
  }, [shouldPause, sendPauseCommand])

  return null
}
