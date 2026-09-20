import * as React from 'react'
import { Effect } from 'effect'

import { useApp } from '@/contexts/app-context'

/**
 * センサーの許可を、専用のボタンを押させずに済ませるための常駐処理（画面なし）。
 *
 * - 位置情報: 一度許可すればブラウザが覚えるので、起動したら黙って監視を始める。
 *   初回はここで OS のダイアログが出る。失敗（未対応・拒否）はここでは通知しない。
 *   使う場面（鳴動画面）が理由を出すので、起動のたびに同じ通知を積まない
 * - 歩行検知（加速度）: iOS は画面操作の中でしか許可を要求できず、ホーム画面から開くと
 *   起動のたびに要る。そこで起動後の最初のタップ（タブを押す等、何でもよい）に乗せて要求する。
 *   利用者から見れば「最初に一度ダイアログが出る」だけで、ボタンを探す必要が無い。
 *   許可か拒否が決まればリスナーは外れる
 */
export function SensorPermissionBridge() {
  const { locationPermission, startWatching, walkPermission, requestWalkPermission } = useApp()

  React.useEffect(() => {
    if (locationPermission !== 'prompt' && locationPermission !== 'granted') return
    void Effect.runPromise(startWatching.pipe(Effect.ignore))
    // 起動時に一度だけ。許可状態の変化で繰り返さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (walkPermission !== 'prompt') return
    const onFirstTap = () => {
      void Effect.runPromise(requestWalkPermission.pipe(Effect.ignore))
    }
    document.addEventListener('click', onFirstTap, { once: true })
    return () => document.removeEventListener('click', onFirstTap)
  }, [walkPermission, requestWalkPermission])

  return null
}
