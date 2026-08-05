export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: '月',
  Tue: '火',
  Wed: '水',
  Thu: '木',
  Fri: '金',
  Sat: '土',
  Sun: '日',
}

/**
 * エッジデバイスが保持する1件のアラーム。
 * stopMethodId はブラウザ側で管理する位置情報ベースの停止方法のIDを指す。
 * UIでは新規作成時に必須入力だが、移行前のデータでは欠落しうるため null 許容にしている。
 */
export type Alarm = {
  id: string
  /** "HH:MM" */
  time: string
  daysOfWeek: DayOfWeek[]
  isEnabled: boolean
  stopMethodId: string | null
  isNfcEnabled: boolean
}

export type RingingStatus = {
  isRinging: boolean
  ringingIds: string[]
}

/** 時刻が早い順に並べ替える（"HH:MM" 形式の文字列比較） */
export function sortAlarmsByTime(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => a.time.localeCompare(b.time))
}

/** 曜日を日本語表記にフォーマットする */
export function formatDaysOfWeek(days: DayOfWeek[]): string {
  if (days.length === 0) return 'なし'
  if (days.length === 7) return '毎日'

  const weekdays: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const weekend: DayOfWeek[] = ['Sat', 'Sun']

  if (days.length === 5 && weekdays.every((d) => days.includes(d))) return '平日'
  if (days.length === 2 && weekend.every((d) => days.includes(d))) return '週末'

  return ALL_DAYS.filter((d) => days.includes(d))
    .map((d) => DAY_LABELS[d])
    .join(' ')
}

/**
 * 一覧に出す時刻の表記。時の0詰めだけを外す（"08:00" → "8:00"）。
 *
 * 保持する値は入力欄（<input type="time">）とドメインの都合で "HH:MM" のままにし、
 * 表示するときにここを通す。分は桁が揃っていないと読みにくいので0詰めを維持する。
 */
export function formatAlarmTime(time: string): string {
  const [hour, minute] = time.split(':')
  if (minute == null) return time
  return `${Number(hour)}:${minute}`
}

/** 現在時刻の5分後を "HH:MM" で返す（追加ダイアログの初期値） */
export function defaultTimeValue(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
