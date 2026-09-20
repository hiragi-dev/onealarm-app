import * as React from 'react'
import { Effect } from 'effect'

import { LocationUnavailableError } from '@/lib/errors'

export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'insecure'

export type CurrentPosition = { lat: number; lng: number; accuracy: number }

function detectPermission(): LocationPermission {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  return 'prompt'
}

/**
 * 端末の現在地の監視（navigator.geolocation.watchPosition）。
 *
 * enabled が false の間は何もしない（dev のデモでは代わりにダミーの現在地を使う）。
 * startWatching は「監視を始める」までを担う。最初の測位を待たないのは、
 * 呼び出し側（地図を開く・鳴動が始まる）は待ちたいのではなく始めたいだけで、
 * 「まだ取れていない」は currentPosition が null であることで画面に伝わるため。
 * 対応していない・HTTPS でない・拒否済み は始められないので失敗として返す。
 * 監視が始まってからの失敗（拒否・タイムアウト）は onError で通知に回す。
 */
export function useGeolocation(options: {
  enabled: boolean
  onError: (error: LocationUnavailableError) => void
}) {
  const { enabled, onError } = options
  const [permission, setPermission] = React.useState<LocationPermission>(detectPermission)
  const [watching, setWatching] = React.useState(false)
  const [currentPosition, setCurrentPosition] = React.useState<CurrentPosition | null>(null)
  const watchId = React.useRef<number | null>(null)

  const stopWatching = React.useCallback(() => {
    if (watchId.current === null) return
    navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    setWatching(false)
  }, [])

  // 無効になったら（デモへ切り替え、アンマウント）監視を止める
  React.useEffect(() => {
    if (enabled) return
    stopWatching()
  }, [enabled, stopWatching])
  React.useEffect(() => stopWatching, [stopWatching])

  // 監視の開始。ref（watchId）の読み書きは Effect.sync の中に閉じ込める。
  // useMemo の中の関数から直接読むと react-hooks/refs（render 中の ref 参照）に落ちる
  const beginWatch = React.useCallback(() => {
    if (watchId.current !== null) return
    watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
              setCurrentPosition({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              })
              setWatching(true)
              setPermission('granted')
            },
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                stopWatching()
                setPermission('denied')
                onError(new LocationUnavailableError({ reason: 'denied' }))
                return
              }
              // 一時的な失敗。監視は続く（次の測位で取れることがある）
              onError(new LocationUnavailableError({ reason: 'timeout' }))
            },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    setWatching(true)
  }, [onError, stopWatching])

  const startWatching = React.useMemo(
    (): Effect.Effect<void, LocationUnavailableError> =>
      Effect.gen(function* () {
        if (!enabled) return
        if (permission === 'unsupported' || permission === 'insecure' || permission === 'denied') {
          return yield* Effect.fail(new LocationUnavailableError({ reason: permission }))
        }
        yield* Effect.sync(beginWatch)
      }),
    [enabled, permission, beginWatch],
  )

  return { permission, watching, currentPosition, startWatching }
}
