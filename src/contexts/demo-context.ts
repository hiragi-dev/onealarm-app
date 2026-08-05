import * as React from 'react'
import type { Effect } from 'effect'

import type { Alarm, DayOfWeek, RingingStatus } from '@/lib/alarm'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import type {
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

/**
 * デモ用アプリ状態の「かたち」と、それを読むためのフック。
 * 実装（DemoProvider）は demo-provider.tsx にある。
 *
 * 失敗しうる操作は戻り値を Effect にしてある。「未接続だから送れない」「鳴動中だから
 * 変更できない」「応答が返ってこない」といった事情が呼び出し側の型に現れるので、
 * 画面側は成功時の処理だけを書き、失敗の文言と通知は useRunEffect に任せられる。
 */

export type MqttSettings = {
  brokerUrl: string
  deviceId: string
  username: string
  password: string
}

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

/** エッジデバイスへ送るコマンドが失敗しうる理由 */
export type CommandError = BrokerNotConnectedError | EdgeOfflineError | EdgeTimeoutError

/** アラームの追加・編集・削除が失敗しうる理由 */
export type AlarmOpError = CommandError | RingingLockedError

export type DemoStore = {
  // --- 接続（本来は MQTT ブローカー） ---
  settings: MqttSettings
  updateSetting: (key: keyof MqttSettings, value: string) => void
  status: BrokerStatus
  edgeStatus: EdgeDeviceStatus
  connect: Effect.Effect<void, EdgeTimeoutError>
  disconnect: () => void
  log: LogEntry[]
  sendPowerCommand: (power: 'on' | 'off') => Effect.Effect<void, CommandError>

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
  startRinging: (alarmId: string) => void

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

  // --- デモ操作（本来はユーザーが直接触らない状態の切り替え） ---
  setStatus: (status: BrokerStatus) => void
  setEdgeStatus: (status: EdgeDeviceStatus) => void
  setLocationPermission: (permission: LocationPermission) => void
  setWalkPermission: (permission: WalkPermission) => void
  /** false にするとエッジが応答しなくなる。タイムアウト時の見え方を確認するため */
  edgeResponsive: boolean
  setEdgeResponsive: (responsive: boolean) => void
  resetDemoData: () => void
}

export const DemoContext = React.createContext<DemoStore | null>(null)

export function useDemo(): DemoStore {
  const store = React.useContext(DemoContext)
  if (!store) throw new Error('useDemo は DemoProvider の中でのみ使えます')
  return store
}

export type { Alarm, DayOfWeek }
