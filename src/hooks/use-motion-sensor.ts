import * as React from 'react'
import { Effect } from 'effect'

import { SensorPermissionError } from '@/lib/errors'
import {
  feedSample,
  INITIAL_WALK_DETECTOR_STATE,
  isWalking as detectWalking,
  magnitudeOf,
  type WalkDetectorState,
} from '@/lib/walk-detector'

export type WalkPermission = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'insecure'

export type MotionValues = {
  accelerationX: number
  accelerationY: number
  accelerationZ: number
  accelerationGravityX: number
  accelerationGravityY: number
  accelerationGravityZ: number
}

type RequestPermissionFn = () => Promise<'granted' | 'denied'>

/** iOS Safari の DeviceMotionEvent.requestPermission は標準の DOM 型に無いので安全に取り出す */
function requestPermissionFnOf(): RequestPermissionFn | undefined {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return undefined
  const fn = (window.DeviceMotionEvent as unknown as { requestPermission?: unknown })
    .requestPermission
  return typeof fn === 'function' ? (fn as RequestPermissionFn) : undefined
}

function detectPermission(): WalkPermission {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  // 明示的な許可が要らない環境（Android Chrome 等）は最初から使える
  return requestPermissionFnOf() ? 'prompt' : 'granted'
}

/**
 * 加速度センサー（DeviceMotionEvent）と、その値から導く歩行検知。
 *
 * enabled が false の間は購読しない（dev のデモでは代わりに手で切り替える）。
 * iOS Safari は requestPermission をユーザー操作の中でしか受け付けず、しかも許可を
 * 起動をまたいで保持しない（ホーム画面から開くと毎回ダイアログが出る）。
 * だから起動時に勝手に要求せず、歩行検知が要る場面（鳴動中）のボタンから要求する。
 */
export function useMotionSensor(options: { enabled: boolean }) {
  const { enabled } = options
  const [permission, setPermission] = React.useState<WalkPermission>(detectPermission)
  const [motion, setMotion] = React.useState<MotionValues | null>(null)
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null)
  const [stepCount, setStepCount] = React.useState(0)
  const [walking, setWalking] = React.useState(false)
  const detector = React.useRef<WalkDetectorState>(INITIAL_WALK_DETECTOR_STATE)
  const requesting = React.useRef(false)

  const active = enabled && permission === 'granted'

  // 許可済みの間だけ購読する。判定は lib/walk-detector.ts に任せ、ここは値を渡すだけ
  React.useEffect(() => {
    if (!active) return
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity
      const a = e.acceleration
      const now = Date.now()
      setLastEventAt(now)
      if (g && g.x != null && g.y != null && g.z != null) {
        setMotion({
          accelerationX: a?.x ?? 0,
          accelerationY: a?.y ?? 0,
          accelerationZ: a?.z ?? 0,
          accelerationGravityX: g.x,
          accelerationGravityY: g.y,
          accelerationGravityZ: g.z,
        })
        const result = feedSample(detector.current, magnitudeOf({ x: g.x, y: g.y, z: g.z }), now)
        detector.current = result.state
        if (result.stepped) {
          setStepCount(result.state.stepCount)
          setWalking(detectWalking(result.state, now))
        }
      }
    }
    // 歩が途絶えたときは devicemotion 自体は来続けるが歩は増えないので、時間で解除する
    const timer = setInterval(() => {
      setWalking(detectWalking(detector.current, Date.now()))
    }, 300)
    window.addEventListener('devicemotion', onMotion)
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      clearInterval(timer)
    }
  }, [active])

  // ボタン連打でネイティブのダイアログが二重に出ないようにする印。
  // ref の読み書きは Effect.sync の中に閉じ込める（useMemo の中の関数から直接読むと
  // react-hooks/refs に落ちる）
  const tryBeginRequest = React.useCallback(() => {
    if (requesting.current) return false
    requesting.current = true
    return true
  }, [])
  const endRequest = React.useCallback(() => {
    requesting.current = false
  }, [])

  const requestPermission = React.useMemo(
    (): Effect.Effect<void, SensorPermissionError> =>
      Effect.gen(function* () {
        if (permission === 'unsupported' || permission === 'insecure') {
          return yield* Effect.fail(new SensorPermissionError({ reason: permission }))
        }
        const request = requestPermissionFnOf()
        if (!request || permission === 'granted') {
          setPermission('granted')
          return
        }
        if (!(yield* Effect.sync(tryBeginRequest))) return
        const result = yield* Effect.tryPromise({
          try: () => request(),
          // ユーザー操作を伴わない呼び出しは例外で拒まれるが、それは利用者が拒否したのとは違う。
          // prompt のまま残し、次の操作で要求し直せるようにする
          catch: () => new SensorPermissionError({ reason: 'denied' }),
        }).pipe(Effect.ensuring(Effect.sync(endRequest)))
        if (result === 'granted') {
          setPermission('granted')
          return
        }
        setPermission('denied')
        return yield* Effect.fail(new SensorPermissionError({ reason: 'denied' }))
      }),
    [permission, tryBeginRequest, endRequest],
  )

  return { permission, requestPermission, motion, lastEventAt, stepCount, isWalking: walking }
}
