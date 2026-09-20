import * as React from 'react'
import { Duration, Effect, Exit, Scope, Stream } from 'effect'

import {
  AppContext,
  type AlarmOpError,
  type AppStore,
  type CommandError,
  type ConnectError,
  type CurrentPosition,
  type DemoControls,
  type LogEntry,
  type MqttSettings,
} from '@/contexts/app-context'
import { useNotify } from '@/contexts/notification-context'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useMotionSensor } from '@/hooks/use-motion-sensor'
import { usesStopMethod, type Alarm } from '@/lib/alarm'
import { makeEdgeClient, type EdgeClient, type EdgeState } from '@/lib/edge/client'
import type { FakeEdge } from '@/lib/edge/fake-edge'
import { makeMqttTransport } from '@/lib/edge/mqtt-transport'
import type { EdgeTransport } from '@/lib/edge/transport'
import {
  BrokerNotConnectedError,
  errorMessage,
  errorSeverity,
  RingingLockedError,
  ValidationError,
  type LocationUnavailableError,
} from '@/lib/errors'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod, StopMethodInput } from '@/lib/stop-method'
import {
  loadMqttSettings,
  loadStopMethods,
  loadWalkUnlockPoints,
  saveMqttSettings,
  saveStopMethods,
  saveWalkUnlockPoints,
  type WalkUnlockPoints,
} from '@/lib/storage'
import {
  DUMMY_ALARMS,
  DUMMY_CURRENT_POSITION,
  DUMMY_MQTT_SETTINGS,
  DUMMY_STOP_METHODS,
} from '@/lib/dummy-data'

/**
 * アプリ状態の実装。
 *
 * エッジデバイスとのやりとりは lib/edge/ の EdgeClient に任せ、ここは
 * - 接続のたびに transport と EdgeClient を作り直す「セッション」の管理
 * - EdgeClient の状態（SubscriptionRef）を React の state へ流す購読
 * - デバイスが持たない項目（歩行検知を有効にする地点）をアプリ側で重ねる
 * - 停止方法・位置情報・歩行検知といったブラウザ内だけの状態
 * を受け持つ。
 *
 * 位置情報は navigator.geolocation、歩行検知は DeviceMotionEvent（hooks/）から取る。
 *
 * dev では「デモのデバイスに繋ぐ」を入れると、MQTT の代わりに fake のデバイス
 * （lib/edge/fake-edge.ts）へ繋ぎ、センサーもダミー（GPS は東京駅付近で揺れ、歩行は
 * 開発用ボタンで切り替える）に差し替わる。開発機には加速度センサーが無く、ダミーの
 * 停止地点は東京なので、本物のセンサーでは到達の流れを試せないため。
 * fake の操作口は demo にまとめ、本番ビルドには残さない。
 */

/** 返事を待つ上限。実機（ESP32）は TLS 越しで数秒かかることがある */
const EDGE_TIMEOUT = Duration.seconds(8)

const DISCONNECTED_STATE: EdgeState = {
  broker: 'disconnected',
  edge: 'unknown',
  alarms: [],
  ringing: null,
  syncedAt: null,
}

/** 接続 1 回ぶんの資源。connect のたびに作り直し、disconnect で丸ごと畳む */
type Session = {
  readonly scope: Scope.CloseableScope
  readonly client: EdgeClient
  /** fake のデバイスに繋いだときだけ入る（dev 専用） */
  readonly fake: FakeEdge | null
}

function nowLabel(): string {
  return new Date().toLocaleTimeString('ja-JP', { hour12: false })
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function jitter(scale: number): number {
  return (Math.random() - 0.5) * scale
}

/**
 * ログに出す前にブローカー URL から資格情報を落とす。
 *
 * MQTT では `wss://user:pass@host/mqtt` の形で資格情報を URL に埋める書き方が
 * 通用するため、貼られた文字列をそのまま流すと、設定画面のログ欄に
 * パスワードが平文で並ぶ（肩越しの覗き見、スクリーンショット付きの不具合報告で漏れる）。
 * URL として解釈できない入力は、途中まででも中身を推測させないよう伏せ字にする。
 */
function maskCredentials(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return '(不正な URL)'
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // --- 保存する設定 ---
  const [settings, setSettings] = React.useState<MqttSettings>(() =>
    loadMqttSettings(DUMMY_MQTT_SETTINGS),
  )
  React.useEffect(() => saveMqttSettings(settings), [settings])

  const [stopMethods, setStopMethods] = React.useState<StopMethod[]>(() => [
    ...loadStopMethods(import.meta.env.DEV ? DUMMY_STOP_METHODS : []),
  ])
  React.useEffect(() => saveStopMethods(stopMethods), [stopMethods])

  const [walkUnlockPoints, setWalkUnlockPoints] = React.useState<WalkUnlockPoints>(() =>
    loadWalkUnlockPoints(),
  )
  React.useEffect(() => saveWalkUnlockPoints(walkUnlockPoints), [walkUnlockPoints])

  // --- エッジデバイスの状態（EdgeClient から流れてくる）---
  const [edgeState, setEdgeState] = React.useState<EdgeState>(DISCONNECTED_STATE)
  const [log, setLog] = React.useState<LogEntry[]>([])

  // --- dev 専用: fake のデバイス ---
  const [demoEnabled, setDemoEnabled] = React.useState(false)
  const [demoRealSensors, setDemoRealSensors] = React.useState(false)
  const [brokerReachable, setBrokerReachable] = React.useState(true)
  const [edgeResponsive, setEdgeResponsive] = React.useState(true)
  /** ダミーのセンサーを使うか。デモでも「センサーは本物」を選べば本物を使う */
  const dummySensors = demoEnabled && !demoRealSensors

  // --- センサー（本物）。デモの間は購読しない ---
  const notify = useNotify()
  const notifyLocationError = React.useCallback(
    (error: LocationUnavailableError) => notify(errorSeverity(error), errorMessage(error)),
    [notify],
  )
  const geo = useGeolocation({ enabled: !dummySensors, onError: notifyLocationError })
  const sensor = useMotionSensor({ enabled: !dummySensors })

  // --- センサー（デモのダミー）---
  const [demoWalking, setDemoWalking] = React.useState(false)
  const [demoStepCount, setDemoStepCount] = React.useState(0)
  const [demoPosition, setDemoPosition] = React.useState<CurrentPosition | null>(
    DUMMY_CURRENT_POSITION,
  )

  const [walkUnlockedFor, setWalkUnlockedFor] = React.useState<string | null>(null)
  const [simulatedPosition, setSimulatedPosition] = React.useState<GeoPoint | null>(null)

  /**
   * Effect の中から「実行時点の最新の状態」を読むための箱。
   * Effect を毎レンダー作り直さずに済ませつつ、ガード（鳴動中か）や接続先は
   * 常に最新の値で判定させるために使う。コミット後に更新するので、
   * イベントハンドラや副作用から読む限り常に最新の値が入っている。
   *
   * 読むのは Effect の実行時だけだが、Effect の組み立ては render 中に行う。
   * react-hooks/refs は render 中に作る関数の直下で .current を読むと弾くので、
   * 読み書きは必ず Effect.sync(() => ...) のような、実行時に作られる閉包の中で行う
   */
  const latest = React.useRef({
    settings,
    broker: edgeState.broker,
    ringingIds: edgeState.ringing?.ringingIds ?? [],
    alarmIds: edgeState.alarms.map((a) => a.id),
    demoEnabled,
    brokerReachable,
    edgeResponsive,
  })
  React.useEffect(() => {
    latest.current = {
      settings,
      broker: edgeState.broker,
      ringingIds: edgeState.ringing?.ringingIds ?? [],
      alarmIds: edgeState.alarms.map((a) => a.id),
      demoEnabled,
      brokerReachable,
      edgeResponsive,
    }
  })

  const appendLog = React.useCallback((text: string) => {
    setLog((prev) => [...prev, { time: nowLabel(), text }].slice(-60))
  }, [])

  // ================= セッション（接続 1 回ぶんの資源）=================

  const sessionBox = React.useRef<Session | null>(null)

  /** セッションを畳む。畳むものがあったかを返す（無ければ切断のログを出さない） */
  const closeSession = React.useMemo(
    () =>
      Effect.gen(function* () {
        const session = yield* Effect.sync(() => {
          const current = sessionBox.current
          sessionBox.current = null
          return current
        })
        if (!session) return false
        yield* Scope.close(session.scope, Exit.void)
        yield* Effect.sync(() => setEdgeState(DISCONNECTED_STATE))
        return true
      }),
    [],
  )

  /**
   * fake のデバイス（dev 専用）。本番ビルドでは import.meta.env.DEV が false になり、
   * この分岐ごと消えるので fake-edge.ts はバンドルに入らない
   */
  const makeFake = React.useMemo(
    (): Effect.Effect<FakeEdge | null, never, Scope.Scope> =>
      Effect.gen(function* () {
        const snapshot = yield* Effect.sync(() => latest.current)
        if (!import.meta.env.DEV || !snapshot.demoEnabled) return null
        const { makeFakeEdge } = yield* Effect.promise(() => import('@/lib/edge/fake-edge'))
        const fake = yield* makeFakeEdge({
          deviceId: snapshot.settings.deviceId,
          alarms: DUMMY_ALARMS,
        })
        // 開発ツールの切り替え（到達不能・無応答）を、作り直した fake にも引き継ぐ
        yield* fake.broker.setReachable(snapshot.brokerReachable)
        yield* fake.device.setResponsive(snapshot.edgeResponsive)
        // 「歩行検知を有効にする地点」はデバイスが持たずアプリ側の保存から来る。
        // 何も保存されていなければダミーのアラームの地点を種として入れ、
        // 繋いだ直後から解除地点の流れを試せるようにする
        yield* Effect.sync(() =>
          setWalkUnlockPoints((prev) => {
            if (Object.keys(prev).length > 0) return prev
            const seeded: Record<string, string> = {}
            for (const a of DUMMY_ALARMS) {
              if (a.walkUnlockPointId !== null) seeded[a.id] = a.walkUnlockPointId
            }
            return seeded
          }),
        )
        return fake
      }),
    [],
  )

  const openSession = React.useMemo(
    () =>
      Effect.gen(function* () {
        const { deviceId, brokerUrl, username, password } = yield* Effect.sync(
          () => latest.current.settings,
        )
        const scope = yield* Scope.make()
        const session = yield* Effect.gen(function* () {
          const fake = yield* makeFake
          const transport: EdgeTransport = fake
            ? fake.transport
            : yield* makeMqttTransport({ brokerUrl, username, password })
          const client = yield* makeEdgeClient(transport, {
            deviceId,
            responseTimeout: EDGE_TIMEOUT,
          })
          // EdgeClient の状態を React へ流す。scope が閉じれば購読も止まる
          yield* client.state.changes.pipe(
            Stream.runForEach((s) => Effect.sync(() => setEdgeState(s))),
            Effect.forkScoped,
          )
          return { scope, client, fake } satisfies Session
        }).pipe(Scope.extend(scope))
        yield* Effect.sync(() => {
          sessionBox.current = session
        })
        return session
      }),
    [makeFake],
  )

  /**
   * 接続。前のセッションがあれば畳んでから作り直す。
   * 設定（接続先）は切断中にしか変えられないので、作り直せば常に最新の設定で繋がる
   */
  const connect = React.useMemo(
    (): Effect.Effect<void, ConnectError> =>
      Effect.gen(function* () {
        yield* closeSession
        const { demoEnabled: demo, settings: s } = latest.current
        yield* Effect.sync(() =>
          appendLog(demo ? 'connect (デモのデバイス)' : `connect ${maskCredentials(s.brokerUrl)}`),
        )
        const session = yield* openSession
        yield* session.client.connect.pipe(
          Effect.tap(() => Effect.sync(() => appendLog('connected: 一覧を受信'))),
          Effect.tapError((e) => Effect.sync(() => appendLog(`connect failed: ${e._tag}`))),
        )
      }),
    [appendLog, closeSession, openSession],
  )

  const disconnect = React.useMemo(
    () =>
      closeSession.pipe(
        Effect.flatMap((closed) =>
          closed ? Effect.sync(() => appendLog('disconnected')) : Effect.void,
        ),
      ),
    [appendLog, closeSession],
  )

  // アンマウント時に接続を畳む
  React.useEffect(() => {
    return () => {
      void Effect.runPromise(closeSession)
    }
  }, [closeSession])

  // dev: デモの切り替えに追従する。入れたら fake へ繋ぎ、切ったら畳む
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    void Effect.runPromise(demoEnabled ? connect.pipe(Effect.ignore) : disconnect)
  }, [demoEnabled, connect, disconnect])

  /**
   * バックグラウンドから戻ったら繋ぎ直す。iOS はバックグラウンド中に WebSocket を
   * 止めることがあり、mqtt.js の自動再接続だけでは戻った直後にすぐ繋がらない。
   * 一度でも繋いだ後（セッションがある）に限り、繋がっていなければ作り直す
   */
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!sessionBox.current || latest.current.broker === 'connected') return
      appendLog('foreground: 繋ぎ直します')
      void Effect.runPromise(connect.pipe(Effect.ignore))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [appendLog, connect])

  const updateSetting = React.useCallback((key: keyof MqttSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  // ================= コマンド =================

  /** 繋がっていなければ送らない。EdgeClient 自身のガードもあるが、セッションが無い間はそこへ届かない */
  const withClient = React.useCallback(
    <A, E>(
      operation: string,
      f: (client: EdgeClient) => Effect.Effect<A, E>,
    ): Effect.Effect<A, E | BrokerNotConnectedError> =>
      Effect.suspend((): Effect.Effect<A, E | BrokerNotConnectedError> => {
        const session = sessionBox.current
        return session ? f(session.client) : Effect.fail(new BrokerNotConnectedError({ operation }))
      }),
    [],
  )

  /** 鳴動中のアラームに対する変更を拒む */
  const guardNotRinging = React.useCallback(
    (operation: string, alarmId: string): Effect.Effect<void, RingingLockedError> =>
      Effect.suspend(() =>
        latest.current.ringingIds.includes(alarmId)
          ? Effect.fail(new RingingLockedError({ operation }))
          : Effect.void,
      ),
    [],
  )

  const addAlarm = React.useCallback(
    (input: Omit<Alarm, 'id'>): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        yield* Effect.sync(() => appendLog(`publish add ${input.time}`))
        const id = yield* withClient('アラームを追加', (c) => c.addAlarm(input))
        // 採番された ID が分かれば、デバイスが持たない地点をこちらで紐づける
        if (id !== null && input.walkUnlockPointId !== null) {
          const point = input.walkUnlockPointId
          yield* Effect.sync(() => setWalkUnlockPoints((prev) => ({ ...prev, [id]: point })))
        }
      }),
    [appendLog, withClient],
  )

  const editAlarm = React.useCallback(
    (id: string, input: Omit<Alarm, 'id'>): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        // 鳴動中に内容を書き換えられると、停止条件をその場でずらせてしまう
        yield* guardNotRinging('アラームを変更', id)
        yield* Effect.sync(() => appendLog(`publish edit ${id}`))
        yield* withClient('アラームを変更', (c) => c.editAlarm(id, input))
        yield* Effect.sync(() =>
          setWalkUnlockPoints((prev) => {
            const next = { ...prev }
            if (input.walkUnlockPointId === null) delete next[id]
            else next[id] = input.walkUnlockPointId
            return next
          }),
        )
      }),
    [appendLog, guardNotRinging, withClient],
  )

  const deleteAlarm = React.useCallback(
    (id: string): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        // 鳴動中のアラームを消すと停止操作の対象を見失う
        yield* guardNotRinging('アラームを削除', id)
        yield* Effect.sync(() => appendLog(`publish delete ${id}`))
        yield* withClient('アラームを削除', (c) => c.deleteAlarm(id))
        yield* Effect.sync(() =>
          setWalkUnlockPoints((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          }),
        )
      }),
    [appendLog, guardNotRinging, withClient],
  )

  const sendStopCommand = React.useMemo(
    (): Effect.Effect<void, CommandError> =>
      Effect.gen(function* () {
        appendLog('publish stop')
        yield* withClient('停止コマンドを送信', (c) => c.stopRinging)
      }),
    [appendLog, withClient],
  )

  const [pauseStats, setPauseStats] = React.useState<{ count: number; lastAt: number | null }>({
    count: 0,
    lastAt: null,
  })
  const sendPauseCommand = React.useCallback(
    (durationMs: number) =>
      withClient('一時停止を送信', (c) => c.pauseRinging(durationMs)).pipe(
        Effect.tap(() =>
          Effect.sync(() =>
            setPauseStats((prev) => ({ count: prev.count + 1, lastAt: Date.now() })),
          ),
        ),
      ),
    [withClient],
  )

  // ================= 停止方法（ブラウザ内）=================

  const addStopMethod = React.useCallback(
    (input: StopMethodInput): Effect.Effect<StopMethod> =>
      Effect.sync(() => {
        const created: StopMethod = { ...input, id: randomId('sm'), createdAt: Date.now() }
        setStopMethods((prev) => [...prev, created])
        return created
      }),
    [],
  )

  const updateStopMethod = React.useCallback(
    (id: string, input: StopMethodInput): Effect.Effect<void, RingingLockedError> =>
      Effect.suspend(() => {
        // 鳴動中に停止地点を書き換えられると、鳴っているアラームの停止条件を
        // その場で好きな場所にずらせてしまう
        if (latest.current.ringingIds.length > 0) {
          return Effect.fail(new RingingLockedError({ operation: '停止方法を変更' }))
        }
        return Effect.sync(() =>
          setStopMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...input } : m))),
        )
      }),
    [],
  )

  // デバイスの一覧に、アプリ側で持つ「歩行検知を有効にする地点」を重ねる
  const alarms = React.useMemo(
    () =>
      edgeState.alarms.map((a) => ({ ...a, walkUnlockPointId: walkUnlockPoints[a.id] ?? null })),
    [edgeState.alarms, walkUnlockPoints],
  )
  const alarmsBox = React.useRef(alarms)
  React.useEffect(() => {
    alarmsBox.current = alarms
  })

  const deleteStopMethod = React.useCallback(
    (id: string): Effect.Effect<void, ValidationError | RingingLockedError> =>
      Effect.suspend((): Effect.Effect<void, ValidationError | RingingLockedError> => {
        if (latest.current.ringingIds.length > 0) {
          return Effect.fail(new RingingLockedError({ operation: '停止方法を削除' }))
        }
        // 使用中の停止方法を消すと、そのアラームが止められなく（歩行検知を解除できなく）なる
        const inUse = alarmsBox.current.some((a) => usesStopMethod(a, id))
        if (inUse) {
          return Effect.fail(
            new ValidationError({
              field: 'stopMethod',
              message: 'いずれかのアラームで使用中のため削除できません',
            }),
          )
        }
        return Effect.sync(() => setStopMethods((prev) => prev.filter((m) => m.id !== id)))
      }),
    [],
  )

  // ================= 歩行検知 =================

  // 鳴動の組が変わったら別の鳴動。前回の鳴動で開いた鍵を持ち越さない
  const ringingKey = (edgeState.ringing?.ringingIds ?? []).join(',')
  const walkUnlocked = ringingKey !== '' && walkUnlockedFor === ringingKey
  const unlockWalkDetection = React.useCallback(() => {
    setWalkUnlockedFor(latest.current.ringingIds.join(','))
  }, [])

  // デモの歩行: 手で切り替えた「歩行中」の間だけ歩数が増える
  React.useEffect(() => {
    if (!dummySensors || !demoWalking) return
    const id = setInterval(() => setDemoStepCount((prev) => prev + 1), 500)
    return () => clearInterval(id)
  }, [dummySensors, demoWalking])

  // ================= 位置情報 =================

  // デモの GPS: 東京駅付近でわずかに揺れる
  React.useEffect(() => {
    if (!dummySensors) return
    const id = setInterval(() => {
      setDemoPosition((prev) =>
        prev
          ? {
              lat: prev.lat + jitter(0.00008),
              lng: prev.lng + jitter(0.00008),
              accuracy: 8 + Math.random() * 10,
            }
          : DUMMY_CURRENT_POSITION,
      )
    }, 3000)
    return () => clearInterval(id)
  }, [dummySensors])

  // ================= dev 専用: fake のデバイスの操作 =================

  /** 今のセッションが fake のデバイスなら、その口を叩く。そうでなければ何もしない */
  const withFake = React.useCallback((f: (fake: FakeEdge) => Effect.Effect<void>) => {
    const fake = sessionBox.current?.fake
    if (fake) void Effect.runPromise(f(fake))
  }, [])

  const demo = React.useMemo(
    (): DemoControls => ({
      enabled: demoEnabled,
      setEnabled: setDemoEnabled,
      realSensors: demoRealSensors,
      setRealSensors: setDemoRealSensors,
      brokerReachable,
      setBrokerReachable: (reachable) => {
        setBrokerReachable(reachable)
        withFake((fake) => fake.broker.setReachable(reachable))
      },
      edgeResponsive,
      setEdgeResponsive: (responsive) => {
        setEdgeResponsive(responsive)
        withFake((fake) => fake.device.setResponsive(responsive))
      },
      dropConnection: () => withFake((fake) => fake.broker.dropConnection),
      startRinging: (alarmId) =>
        withFake((fake) =>
          fake.device.mutate((s) => ({ ...s, ringing: { isRinging: true, ringingIds: [alarmId] } })),
        ),
      setWalking: setDemoWalking,
      reset: () => {
        // fake は次の接続で初期状態から作り直される。ブラウザ内の状態はここで戻す
        setStopMethods(DUMMY_STOP_METHODS)
        setWalkUnlockPoints({})
        setDemoWalking(false)
        setWalkUnlockedFor(null)
        setDemoStepCount(0)
        setDemoPosition(DUMMY_CURRENT_POSITION)
        setSimulatedPosition(null)
        setPauseStats({ count: 0, lastAt: null })
        setLog([])
        void Effect.runPromise(
          latest.current.demoEnabled ? connect.pipe(Effect.ignore) : disconnect,
        )
      },
    }),
    [brokerReachable, connect, demoEnabled, demoRealSensors, disconnect, edgeResponsive, withFake],
  )

  const value: AppStore = {
    settings,
    updateSetting,
    status: edgeState.broker,
    edgeStatus: edgeState.edge,
    connect,
    reconnect: connect,
    disconnect,
    log,
    alarms,
    alarmsUpdatedAt: edgeState.syncedAt,
    addAlarm,
    editAlarm,
    deleteAlarm,
    ringingStatus: edgeState.ringing,
    sendStopCommand,
    sendPauseCommand,
    pauseStats,
    stopMethods,
    addStopMethod,
    updateStopMethod,
    deleteStopMethod,
    // ダミーのセンサーのときは本物の代わりにダミーを出す
    walkPermission: dummySensors ? 'granted' : sensor.permission,
    requestWalkPermission: dummySensors ? Effect.void : sensor.requestPermission,
    isWalking: dummySensors ? demoWalking : sensor.isWalking,
    walkUnlocked,
    unlockWalkDetection,
    stepCount: dummySensors ? demoStepCount : sensor.stepCount,
    motion: dummySensors ? null : sensor.motion,
    lastEventAt: dummySensors ? null : sensor.lastEventAt,
    locationPermission: dummySensors ? 'granted' : geo.permission,
    watching: dummySensors ? true : geo.watching,
    startWatching: dummySensors ? Effect.void : geo.startWatching,
    currentPosition: dummySensors ? demoPosition : geo.currentPosition,
    simulatedPosition,
    setSimulatedPosition,
    demo,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
