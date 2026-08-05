import type { Alarm } from '@/lib/alarm'
import type { GeoPoint } from '@/lib/geo'
import type { StopMethod } from '@/lib/stop-method'

/**
 * UI確認用のダミーデータ。実機（エッジデバイス）もブローカーも使わず、
 * すべてこのファイルの値を初期状態としてメモリ上で完結させる。
 */

/** 地図の初期中心地点（現在地未取得時のフォールバック。東京駅） */
export const FALLBACK_CENTER: GeoPoint = { lat: 35.6812, lng: 139.7671 }

/** ダミーの現在地（東京駅の少し南西） */
export const DUMMY_CURRENT_POSITION = { lat: 35.6798, lng: 139.765, accuracy: 12 }

export const DUMMY_MQTT_SETTINGS = {
  brokerUrl: 'wss://demo-broker.example.cloud:8884/mqtt',
  deviceId: 'onealarm-demo-01',
  username: 'demo-user',
  password: 'demo-password',
}

export const DUMMY_STOP_METHODS: StopMethod[] = [
  {
    id: 'sm-office',
    label: '会社',
    lat: 35.6812,
    lng: 139.7671,
    radiusMeters: 30,
    createdAt: Date.parse('2026-06-01T09:00:00+09:00'),
  },
  {
    id: 'sm-station',
    label: '最寄り駅',
    lat: 35.658,
    lng: 139.7016,
    radiusMeters: 50,
    createdAt: Date.parse('2026-06-03T08:12:00+09:00'),
  },
  {
    id: 'sm-convenience',
    label: 'コンビニ',
    lat: 35.6895,
    lng: 139.6917,
    radiusMeters: 15,
    createdAt: Date.parse('2026-07-11T22:40:00+09:00'),
  },
]

export const DUMMY_ALARMS: Alarm[] = [
  {
    id: 'alarm-weekday',
    time: '06:30',
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isEnabled: true,
    stopMethodId: 'sm-office',
    isNfcEnabled: true,
  },
  {
    id: 'alarm-weekend',
    time: '08:45',
    daysOfWeek: ['Sat', 'Sun'],
    isEnabled: false,
    stopMethodId: 'sm-convenience',
    isNfcEnabled: false,
  },
  {
    id: 'alarm-daily',
    time: '22:00',
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    isEnabled: true,
    stopMethodId: 'sm-station',
    isNfcEnabled: false,
  },
]

export const DUMMY_LOG: { time: string; text: string }[] = [
  { time: '07:12:04', text: 'connected to wss://demo-broker.example.cloud:8884/mqtt' },
  { time: '07:12:04', text: 'subscribe eager-alarm/onealarm-demo-01/status' },
  { time: '07:12:04', text: 'subscribe eager-alarm/onealarm-demo-01/alarms' },
  { time: '07:12:05', text: 'publish {"type":"list"}' },
  { time: '07:12:05', text: 'recv alarms: 3件' },
  { time: '07:12:08', text: 'recv status: {"online":true}' },
]
