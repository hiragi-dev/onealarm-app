import * as React from 'react'
import { Duration, Effect } from 'effect'

import {
  DemoContext,
  type AlarmOpError,
  type CommandError,
  type CurrentPosition,
  type DemoStore,
  type LocationPermission,
  type LogEntry,
  type MotionValues,
  type MqttSettings,
  type WalkPermission,
} from '@/contexts/demo-context'
import { sortAlarmsByTime, type Alarm, type RingingStatus } from '@/lib/alarm'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import {
  BrokerNotConnectedError,
  EdgeOfflineError,
  EdgeTimeoutError,
  LocationUnavailableError,
  RingingLockedError,
  SensorPermissionError,
  ValidationError,
} from '@/lib/errors'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod, StopMethodInput } from '@/lib/stop-method'
import {
  DUMMY_ALARMS,
  DUMMY_CURRENT_POSITION,
  DUMMY_LOG,
  DUMMY_MQTT_SETTINGS,
  DUMMY_STOP_METHODS,
} from '@/lib/dummy-data'

/**
 * MQTT・GPS・加速度センサーをすべてダミーに置き換えた、UI確認専用のアプリ状態。
 *
 * 本来は MqttProvider / LocationProvider / WalkSensorProvider / StopMethodProvider に
 * 分かれている状態を、通信も権限もないこの再構成では1つのストアにまとめている。
 * 実機を繋がずに各画面を確認できるよう、鳴動の開始や接続状態の切り替えといった
 * 「本来は外から起きるイベント」も操作として公開している（設定タブのデモ操作パネル）。
 */

/** ダミーの通信遅延（ms） */
const EDGE_RESPONSE_MS = 900
/** stop コマンド送信後、エッジ側が実際に鳴動を終えるまでのダミー遅延（ms） */
const EDGE_STOP_CONFIRM_MS = 1800
/** エッジからの反映確認を待つ上限。超えたら EdgeTimeoutError で失敗する */
const EDGE_TIMEOUT_MS = 8000

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

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<MqttSettings>(DUMMY_MQTT_SETTINGS)
  const [status, setStatus] = React.useState<BrokerStatus>('connected')
  const [edgeStatus, setEdgeStatus] = React.useState<EdgeDeviceStatus>('online')
  const [log, setLog] = React.useState<LogEntry[]>(DUMMY_LOG)
  const [edgeResponsive, setEdgeResponsive] = React.useState(true)

  const [alarms, setAlarms] = React.useState<Alarm[]>(() => sortAlarmsByTime(DUMMY_ALARMS))
  const [alarmsUpdatedAt, setAlarmsUpdatedAt] = React.useState<number | null>(() => Date.now())

  const [ringingStatus, setRingingStatus] = React.useState<RingingStatus | null>({
    isRinging: false,
    ringingIds: [],
  })

  const [stopMethods, setStopMethods] = React.useState<StopMethod[]>(DUMMY_STOP_METHODS)

  const [walkPermission, setWalkPermission] = React.useState<WalkPermission>('granted')
  const [isWalking, setWalking] = React.useState(false)
  const [stepCount, setStepCount] = React.useState(0)
  const [motion, setMotion] = React.useState<MotionValues | null>(null)
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null)

  const [locationPermission, setLocationPermission] = React.useState<LocationPermission>('granted')
  const [watching, setWatching] = React.useState(true)
  const [currentPosition, setCurrentPosition] = React.useState<CurrentPosition | null>(
    DUMMY_CURRENT_POSITION,
  )
  const [simulatedPosition, setSimulatedPosition] = React.useState<GeoPoint | null>(null)

  /**
   * Effect の中から「実行時点の最新の状態」を読むための参照。
   * Effect を毎レンダー作り直さずに済ませつつ、ガード（未接続か・鳴動中か）は
   * 常に最新の値で判定させるために使う。コミット後に更新するので、
   * イベントハンドラや副作用から読む限り常に最新の値が入っている。
   */
  const stateRef = React.useRef({
    status,
    edgeStatus,
    edgeResponsive,
    ringingIds: ringingStatus?.ringingIds ?? [],
    alarms,
    brokerUrl: settings.brokerUrl,
  })

  React.useEffect(() => {
    stateRef.current = {
      status,
      edgeStatus,
      edgeResponsive,
      ringingIds: ringingStatus?.ringingIds ?? [],
      alarms,
      brokerUrl: settings.brokerUrl,
    }
  })

  const appendLog = React.useCallback((text: string) => {
    setLog((prev) => [...prev, { time: nowLabel(), text }].slice(-60))
  }, [])

  // --- ダミーのセンサー値: 許可済みの間だけ動き続ける ---
  React.useEffect(() => {
    if (walkPermission !== 'granted') return
    const id = setInterval(() => {
      const amplitude = isWalking ? 3.2 : 0.25
      setMotion({
        accelerationX: jitter(amplitude),
        accelerationY: jitter(amplitude),
        accelerationZ: jitter(amplitude),
        accelerationGravityX: jitter(amplitude),
        accelerationGravityY: jitter(amplitude) + 9.8,
        accelerationGravityZ: jitter(amplitude),
      })
      setLastEventAt(Date.now())
      if (isWalking) setStepCount((prev) => prev + 1)
    }, 500)
    return () => clearInterval(id)
  }, [walkPermission, isWalking])

  // --- ダミーのGPS: 監視中はわずかに揺れる ---
  React.useEffect(() => {
    if (!watching || locationPermission !== 'granted') return
    const id = setInterval(() => {
      setCurrentPosition((prev) =>
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
  }, [watching, locationPermission])

  /**
   * コマンドを送れる状態かを確かめる。ブローカー接続とエッジの生存は別物なので、
   * 「繋がっていない」と「繋がっているがデバイスが応答しない」を別の失敗として返す。
   */
  const guardConnected = React.useCallback(
    (operation: string): Effect.Effect<void, BrokerNotConnectedError | EdgeOfflineError> =>
      Effect.suspend((): Effect.Effect<void, BrokerNotConnectedError | EdgeOfflineError> => {
        const { status: s, edgeStatus: e } = stateRef.current
        if (s !== 'connected') return Effect.fail(new BrokerNotConnectedError({ operation }))
        if (e !== 'online') return Effect.fail(new EdgeOfflineError({ operation }))
        return Effect.void
      }),
    [],
  )

  /** 鳴動中のアラームに対する変更を拒む */
  const guardNotRinging = React.useCallback(
    (operation: string, alarmId: string): Effect.Effect<void, RingingLockedError> =>
      Effect.suspend(() =>
        stateRef.current.ringingIds.includes(alarmId)
          ? Effect.fail(new RingingLockedError({ operation }))
          : Effect.void,
      ),
    [],
  )

  /**
   * エッジデバイスの応答を待つ。デモ操作で「応答しない」に切り替えていれば
   * いつまでも返らないので、timeoutFail が EdgeTimeoutError に変える。
   */
  const awaitEdge = React.useCallback(
    (operation: string, apply: () => void): Effect.Effect<void, EdgeTimeoutError> =>
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(EDGE_RESPONSE_MS))
        if (!stateRef.current.edgeResponsive) yield* Effect.never
        yield* Effect.sync(apply)
      }).pipe(
        Effect.timeoutFail({
          duration: Duration.millis(EDGE_TIMEOUT_MS),
          onTimeout: () => new EdgeTimeoutError({ operation, timeoutMs: EDGE_TIMEOUT_MS }),
        }),
      ),
    [],
  )

  const connect = React.useMemo(
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          setStatus('connecting')
          appendLog(`connect ${maskCredentials(stateRef.current.brokerUrl)}`)
        })
        yield* awaitEdge('接続', () => {
          setStatus('connected')
          setEdgeStatus('online')
          setAlarmsUpdatedAt(Date.now())
          setRingingStatus({ isRinging: false, ringingIds: [] })
          appendLog('connected')
          appendLog('publish {"type":"list"}')
        })
      }).pipe(
        // 失敗したまま「接続中…」に見え続けないよう、状態を error に落としてから伝える
        Effect.tapError(() =>
          Effect.sync(() => {
            setStatus('error')
            appendLog('connect failed: エッジからの応答がありません')
          }),
        ),
      ),
    [appendLog, awaitEdge],
  )

  const disconnect = React.useCallback(() => {
    setStatus('disconnected')
    setEdgeStatus('unknown')
    setRingingStatus(null)
    appendLog('disconnected')
  }, [appendLog])

  const updateSetting = React.useCallback((key: keyof MqttSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const sendPowerCommand = React.useCallback(
    (power: 'on' | 'off'): Effect.Effect<void, CommandError> =>
      Effect.gen(function* () {
        yield* guardConnected(`電源${power === 'on' ? 'ON' : 'OFF'}コマンドを送信`)
        yield* Effect.sync(() => appendLog(`publish {"type":"${power}"}`))
        yield* awaitEdge('電源コマンドの送信', () => appendLog(`recv status: {"ack":"${power}"}`))
      }),
    [appendLog, awaitEdge, guardConnected],
  )

  // --- アラーム: エッジからの list 返信を待つ体で少し遅らせて反映する ---
  const applyAlarms = React.useCallback(
    (operation: string, updater: (prev: Alarm[]) => Alarm[]) =>
      awaitEdge(operation, () => {
        setAlarms((prev) => sortAlarmsByTime(updater(prev)))
        setAlarmsUpdatedAt(Date.now())
      }),
    [awaitEdge],
  )

  const addAlarm = React.useCallback(
    (input: Omit<Alarm, 'id'>): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        yield* guardConnected('アラームを追加')
        yield* Effect.sync(() => appendLog(`publish {"type":"add","time":"${input.time}"}`))
        yield* applyAlarms('追加', (prev) => [...prev, { ...input, id: randomId('alarm') }])
      }),
    [appendLog, applyAlarms, guardConnected],
  )

  const editAlarm = React.useCallback(
    (id: string, input: Omit<Alarm, 'id'>): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        yield* guardConnected('アラームを変更')
        // 鳴動中に内容を書き換えられると、停止条件をその場でずらせてしまう
        yield* guardNotRinging('アラームを変更', id)
        yield* Effect.sync(() => appendLog(`publish {"type":"edit","id":"${id}"}`))
        yield* applyAlarms('変更', (prev) => prev.map((a) => (a.id === id ? { ...input, id } : a)))
      }),
    [appendLog, applyAlarms, guardConnected, guardNotRinging],
  )

  const deleteAlarm = React.useCallback(
    (id: string): Effect.Effect<void, AlarmOpError> =>
      Effect.gen(function* () {
        yield* guardConnected('アラームを削除')
        // 鳴動中のアラームを消すと停止操作の対象を見失う
        yield* guardNotRinging('アラームを削除', id)
        yield* Effect.sync(() => appendLog(`publish {"type":"delete","id":"${id}"}`))
        yield* applyAlarms('削除', (prev) => prev.filter((a) => a.id !== id))
      }),
    [appendLog, applyAlarms, guardConnected, guardNotRinging],
  )

  const startRinging = React.useCallback(
    (alarmId: string) => {
      setRingingStatus({ isRinging: true, ringingIds: [alarmId] })
      appendLog(`recv ringing_status: {"is_ringing":true,"ringing_ids":["${alarmId}"]}`)
    },
    [appendLog],
  )

  /**
   * 停止コマンドの送信。ブローカーへの配信確認が取れたあと、さらに遅れて
   * エッジ側が鳴動を終える（＝ringingStatus が空になる）。
   * 送信 → 配信確認 → 停止確認 の3段階を UI 側で表示するための作り。
   */
  const sendStopCommand = React.useMemo(
    (): Effect.Effect<void, CommandError> =>
      Effect.gen(function* () {
        yield* guardConnected('停止コマンドを送信')
        yield* Effect.sync(() => appendLog('publish {"type":"stop"} (QoS 2)'))
        yield* awaitEdge('停止コマンドの送信', () => appendLog('recv puback'))
        // 配信確認のあと、エッジが実際に鳴り止むまでの間も待って完了とする
        yield* Effect.sleep(Duration.millis(EDGE_STOP_CONFIRM_MS))
        yield* Effect.sync(() => {
          setRingingStatus({ isRinging: false, ringingIds: [] })
          appendLog('recv ringing_status: {"is_ringing":false,"ringing_ids":[]}')
        })
      }),
    [appendLog, awaitEdge, guardConnected],
  )

  // --- 停止方法 ---
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
        if (stateRef.current.ringingIds.length > 0) {
          return Effect.fail(new RingingLockedError({ operation: '停止方法を変更' }))
        }
        return Effect.sync(() =>
          setStopMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...input } : m))),
        )
      }),
    [],
  )

  const deleteStopMethod = React.useCallback(
    (id: string): Effect.Effect<void, ValidationError | RingingLockedError> =>
      Effect.suspend((): Effect.Effect<void, ValidationError | RingingLockedError> => {
        if (stateRef.current.ringingIds.length > 0) {
          return Effect.fail(new RingingLockedError({ operation: '停止方法を削除' }))
        }
        // 使用中の停止方法を消すと、そのアラームが止められなくなる
        const inUse = stateRef.current.alarms.some((a) => a.stopMethodId === id)
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

  const requestWalkPermission = React.useMemo(
    (): Effect.Effect<void, SensorPermissionError> =>
      // デモでは常に許可されるが、拒否の見え方は設定タブの権限切り替えで確認できる
      Effect.sync(() => setWalkPermission('granted')),
    [],
  )

  const startWatching = React.useMemo(
    (): Effect.Effect<void, LocationUnavailableError> =>
      Effect.suspend((): Effect.Effect<void, LocationUnavailableError> => {
        if (locationPermission === 'granted' || locationPermission === 'prompt') {
          return Effect.sync(() => {
            setLocationPermission('granted')
            setWatching(true)
            setCurrentPosition((prev) => prev ?? DUMMY_CURRENT_POSITION)
          })
        }
        return Effect.fail(new LocationUnavailableError({ reason: locationPermission }))
      }),
    [locationPermission],
  )

  const resetDemoData = React.useCallback(() => {
    setSettings(DUMMY_MQTT_SETTINGS)
    setStatus('connected')
    setEdgeStatus('online')
    setEdgeResponsive(true)
    setLog(DUMMY_LOG)
    setAlarms(sortAlarmsByTime(DUMMY_ALARMS))
    setAlarmsUpdatedAt(Date.now())
    setRingingStatus({ isRinging: false, ringingIds: [] })
    setStopMethods(DUMMY_STOP_METHODS)
    setWalkPermission('granted')
    setWalking(false)
    setStepCount(0)
    setLocationPermission('granted')
    setWatching(true)
    setCurrentPosition(DUMMY_CURRENT_POSITION)
    setSimulatedPosition(null)
  }, [])

  const value: DemoStore = {
    settings,
    updateSetting,
    status,
    edgeStatus,
    connect,
    disconnect,
    log,
    sendPowerCommand,
    alarms,
    alarmsUpdatedAt,
    addAlarm,
    editAlarm,
    deleteAlarm,
    ringingStatus,
    sendStopCommand,
    startRinging,
    stopMethods,
    addStopMethod,
    updateStopMethod,
    deleteStopMethod,
    walkPermission,
    requestWalkPermission,
    isWalking,
    setWalking,
    stepCount,
    motion,
    lastEventAt,
    locationPermission,
    watching,
    startWatching,
    currentPosition,
    simulatedPosition,
    setSimulatedPosition,
    setStatus,
    setEdgeStatus,
    setLocationPermission,
    setWalkPermission,
    edgeResponsive,
    setEdgeResponsive,
    resetDemoData,
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
