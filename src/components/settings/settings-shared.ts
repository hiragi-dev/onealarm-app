import type { MqttSettings } from '@/contexts/demo-context'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import type { Tone } from '@/lib/connection-view'

/**
 * 「設定」タブが使う文言と選択肢。
 * ここに置くのはラベル・説明・色の対応づけだけで、レイアウトは呼び出し側が決める。
 */

export type { Tone }

/** tone に対応する文字色。状態表示を地の文で示すのに使う */
export const toneTextClass: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

/** tone に対応する丸バッジの色。経路図のノードで使う */
export const toneBadgeClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

/** tone に対応する背景色。ドットなど、面で状態を示すときに使う */
export const toneBgClass: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
}

export type StatusMeta = {
  /** 大きく表示する短い名前 */
  label: string
  /** 何が起きているのかの一行説明 */
  description: string
  tone: Tone
}

export const brokerStatusMeta: Record<BrokerStatus, StatusMeta> = {
  disconnected: {
    label: '未接続',
    description: 'ブローカーに接続していません。接続先を入力して接続してください。',
    tone: 'neutral',
  },
  connecting: {
    label: '接続中…',
    description: 'ブローカーへ接続しています。',
    tone: 'warning',
  },
  connected: {
    label: '接続済み',
    description: 'ブローカーに接続しています。コマンドを送信できます。',
    tone: 'success',
  },
  error: {
    label: 'エラー',
    description: '接続に失敗しました。接続先とアカウント情報を確認してください。',
    tone: 'destructive',
  },
}

export const edgeStatusMeta: Record<EdgeDeviceStatus, StatusMeta> = {
  unknown: {
    label: '確認中',
    description: 'エッジデバイスの生存状況をまだ受け取っていません。',
    tone: 'neutral',
  },
  online: {
    label: 'オンライン',
    description: 'エッジデバイスは生きています。',
    tone: 'success',
  },
  offline: {
    label: 'オフライン',
    description: 'エッジデバイスから応答がありません。電源と回線を確認してください。',
    tone: 'destructive',
  },
}

export type MqttField = {
  key: keyof MqttSettings
  /** 何の設定かが単体で分かる正式な名前。行には出さず、読み上げ名に使う */
  label: string
  /** 行の左端に置く短い名前。群の見出しが文脈を補うので、ここは詰めてよい */
  short: string
  placeholder: string
  help: string
  type: 'text' | 'password'
}

/**
 * 図のノードごとに分けて持つ。画面は「どちらのノードの設定か」で群を切るので、
 * 平らな一覧を毎回 filter するより、最初から分けておくほうが素直
 */
export const brokerFields: MqttField[] = [
  {
    key: 'brokerUrl',
    label: 'ブローカー URL (WebSocket)',
    short: 'URL',
    placeholder: 'wss://xxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt',
    help: 'HiveMQ Cloud の WebSocket エンドポイント（TLS: 8884, パス /mqtt）',
    type: 'text',
  },
  {
    key: 'username',
    label: 'ユーザー名',
    short: 'ユーザー名',
    placeholder: 'onealarm',
    help: 'ブローカーに登録したアカウント名',
    type: 'text',
  },
  {
    key: 'password',
    label: 'パスワード',
    short: 'パスワード',
    placeholder: '',
    help: 'ブローカーに登録したパスワード',
    type: 'password',
  },
]

export const edgeFields: MqttField[] = [
  {
    key: 'deviceId',
    label: 'デバイスID',
    short: 'デバイスID',
    placeholder: 'onealarm-demo-01',
    help: 'エッジデバイス側の DEVICE_ID と一致させてください',
    type: 'text',
  },
]

/** デモ操作でブローカー状態を差し替えるための選択肢 */
export const brokerStatusOptions: { value: BrokerStatus; label: string }[] = [
  { value: 'connected', label: 'connected（接続済み）' },
  { value: 'connecting', label: 'connecting（接続中）' },
  { value: 'disconnected', label: 'disconnected（未接続）' },
  { value: 'error', label: 'error（エラー）' },
]

/** デモ操作でエッジの生存状況を差し替えるための選択肢 */
export const edgeStatusOptions: { value: EdgeDeviceStatus; label: string }[] = [
  { value: 'online', label: 'online（オンライン）' },
  { value: 'offline', label: 'offline（オフライン）' },
  { value: 'unknown', label: 'unknown（確認中）' },
]

export const DEV_PANEL_NOTE =
  'エッジデバイスにもブローカーにも接続していない、UI確認用のビルドです。ここから状態を切り替えて各画面の見え方を確認できます。'

export const EDGE_RESPONSIVE_HELP =
  '切ると反映確認が返らなくなり、タイムアウト時の通知を確認できます'
