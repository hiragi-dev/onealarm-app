import * as React from 'react'
import type { Effect } from 'effect'

import type { Alarm, DayOfWeek, RingingStatus } from '@/lib/alarm'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import type {
  BrokerNotConnectedError,
  BrokerUnreachableError,
  EdgeOfflineError,
  EdgeTimeoutError,
  LocationUnavailableError,
  RingingLockedError,
  SensorPermissionError,
  ValidationError,
} from '@/lib/errors'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod, StopMethodInput } from '@/lib/stop-method'
import type { MqttSettings } from '@/lib/storage'

/**
 * アプリ状態の「かたち」と、それを読むためのフック。
 * 実装（AppProvider）は app-provider.tsx にある。
 *
 * エッジデバイスとのやりとりは lib/edge/ の EdgeClient が担い、ここはそれを
 * React から読める形に並べ直したもの。失敗しうる操作は戻り値を Effect にしてある。
 * 「未接続だから送れない」「鳴動中だから変更できない」「応答が返ってこない」といった
 * 事情が呼び出し側の型に現れるので、画面側は成功時の処理だけを書き、
 * 失敗の文言と通知は useRunEffect に任せられる。
 */

export type { MqttSettings }

export type LogEntry = { time: string; text: string }

export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'insecure'
export type WalkPermission = 'granted' | 'prompt' | 'denied'

export type CurrentPosition = GeoPoint & { accuracy: number }

export type MotionValues = {
  accelerationX: number
  accelerationY: number
  accelerationZ: number
  accelerationGravityX: number
  accelerationGravityY: number
  accelerationGravityZ: number
}

/** 接続が失敗しうる理由 */
export type ConnectError = BrokerUnreachableError | EdgeTimeoutError

/** エッジデバイスへ送るコマンドが失敗しうる理由 */
export type CommandError = BrokerNotConnectedError | EdgeOfflineError | EdgeTimeoutError

/** アラームの追加・編集・削除が失敗しうる理由 */
export type AlarmOpError = CommandError | RingingLockedError

/**
 * dev 専用の口。実機もブローカーも無しで各画面を確認するために、
 * fake のデバイス（lib/edge/fake-edge.ts）へ繋ぎ、その振る舞いを外から動かす。
 * 本番ビルドでは enabled が常に false で、fake のコードも読み込まれない
 */
export type DemoControls = {
  /** fake のデバイスに繋ぐか。切り替えると繋ぎ直す */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  /** false にすると次の接続が失敗する */
  brokerReachable: boolean
  setBrokerReachable: (reachable: boolean) => void
  /** false にするとエッジが応答しなくなる。タイムアウト時の見え方を確認するため */
  edgeResponsive: boolean
  setEdgeResponsive: (responsive: boolean) => void
  /** アプリの意思と無関係に接続が切れる（電波断） */
  dropConnection: () => void
  /** 時刻の到来を待たずに鳴らす */
  startRinging: (alarmId: string) => void
  /** fake のデバイスと停止方法を初期状態に戻す */
  reset: () => void
}

export type AppStore = {
  // --- 接続 ---
  settings: MqttSettings
  updateSetting: (key: keyof MqttSettings, value: string) => void
  status: BrokerStatus
  edgeStatus: EdgeDeviceStatus
  connect: Effect.Effect<void, ConnectError>
  /** 失敗後・エッジ無応答時の立て直し。繋がっていれば切ってから connect する */
  reconnect: Effect.Effect<void, ConnectError>
  disconnect: Effect.Effect<void>
  log: LogEntry[]

  // --- アラーム ---
  alarms: Alarm[]
  /** 一覧を最後に受信した時刻。null は初回取得前（スケルトン表示） */
  alarmsUpdatedAt: number | null
  addAlarm: (input: Omit<Alarm, 'id'>) => Effect.Effect<void, AlarmOpError>
  editAlarm: (id: string, input: Omit<Alarm, 'id'>) => Effect.Effect<void, AlarmOpError>
  deleteAlarm: (id: string) => Effect.Effect<void, AlarmOpError>

  // --- 鳴動 ---
  ringingStatus: RingingStatus | null
  sendStopCommand: Effect.Effect<void, CommandError>
  /** 歩行中の一時停止。durationMs のあいだデバイスが鳴り止む。返事は無い */
  sendPauseCommand: (
    durationMs: number,
  ) => Effect.Effect<void, BrokerNotConnectedError | EdgeOfflineError>

  // --- 停止方法（位置情報） ---
  stopMethods: StopMethod[]
  addStopMethod: (input: StopMethodInput) => Effect.Effect<StopMethod>
  updateStopMethod: (id: string, input: StopMethodInput) => Effect.Effect<void, RingingLockedError>
  deleteStopMethod: (id: string) => Effect.Effect<void, ValidationError | RingingLockedError>

  // --- 歩行検知 ---
  walkPermission: WalkPermission
  requestWalkPermission: Effect.Effect<void, SensorPermissionError>
  isWalking: boolean
  setWalking: (walking: boolean) => void
  /**
   * この鳴動で「歩行検知を有効にする地点」にもう着いたか。鳴動が変わると false に戻る。
   * 判断そのものは lib/walk-gate.ts に置き、ここは着いた事実を覚えるだけ
   */
  walkUnlocked: boolean
  unlockWalkDetection: () => void
  stepCount: number
  motion: MotionValues | null
  lastEventAt: number | null

  // --- 位置情報 ---
  locationPermission: LocationPermission
  watching: boolean
  startWatching: Effect.Effect<void, LocationUnavailableError>
  currentPosition: CurrentPosition | null
  /** 到達検知フローを実際に移動せず試すための疑似現在地 */
  simulatedPosition: GeoPoint | null
  setSimulatedPosition: (point: GeoPoint | null) => void
  setLocationPermission: (permission: LocationPermission) => void
  setWalkPermission: (permission: WalkPermission) => void

  // --- dev 専用 ---
  demo: DemoControls
}

export const AppContext = React.createContext<AppStore | null>(null)

export function useApp(): AppStore {
  const store = React.useContext(AppContext)
  if (!store) throw new Error('useApp は AppProvider の中でのみ使えます')
  return store
}

export type { Alarm, DayOfWeek }
