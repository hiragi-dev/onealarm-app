import { Either, Schema } from 'effect'

import { ALL_DAYS, type Alarm, type RingingStatus } from '@/lib/alarm'

/**
 * 実機（onealarm-fw / eager-alarm-edge）が話す MQTT API v2 の電文。
 *
 * デバイス側の仕様は eager-alarm-edge の MQTT_API_SPEC.md。要点:
 * - トピックは 4 本。コマンドは 1 本、返事は種類ごとに 3 本（alarms / status / ringing_status）
 * - 項目名は snake_case。アプリ側の Alarm（camelCase）とはここで相互変換する
 * - ack が無い。add / edit / delete / pause / stop は返事を返さないので、
 *   結果を知るには直後に list / ringing_status を送って取り直す（client.ts）
 * - 返事は差分ではなく「全一覧」「全鳴動状態」。届いた内容で手元を丸ごと置き換える
 * - walkUnlockPointId はデバイスが知らない項目で、送っても保存されない。
 *   アプリ側（storage.ts）で id ごとに持ち、受信した一覧に重ねる
 * - is_nfc_enabled はデバイスが NFC 認証を要求するかの印。アプリは NFC を廃止したので
 *   常に false を送り、デバイスに認証を求めさせない
 *
 * DECISION.md の方針どおり retain もセッション永続も使わない。接続のたびに
 * 購読し直して取り直せば、これらが無くても手元は現状に追いつく。
 */

const DayOfWeekSchema = Schema.Literal(...ALL_DAYS)
const DaysOfWeekSchema = Schema.mutable(Schema.Array(DayOfWeekSchema))

/** デバイスが返す 1 件のアラーム。古い個体は項目が欠けることがあるので既定値で埋める */
export const DeviceAlarmSchema = Schema.Struct({
  id: Schema.String,
  time: Schema.String,
  days_of_week: DaysOfWeekSchema,
  is_enabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  stop_method_id: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
})
export type DeviceAlarm = Schema.Schema.Type<typeof DeviceAlarmSchema>

export const AlarmsPayloadSchema = Schema.mutable(Schema.Array(DeviceAlarmSchema))

export const RingingStatusPayloadSchema = Schema.Struct({
  is_ringing: Schema.Boolean,
  ringing_ids: Schema.mutable(Schema.Array(Schema.String)),
})

export const StatusPayloadSchema = Schema.Struct({ online: Schema.Boolean })

/** add / edit で送るアラームの中身 */
const AlarmFields = {
  time: Schema.String,
  days_of_week: DaysOfWeekSchema,
  is_enabled: Schema.Boolean,
  stop_method_id: Schema.NullOr(Schema.String),
  is_nfc_enabled: Schema.Boolean,
}

/** アプリ → デバイス */
export const CommandSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('list') }),
  Schema.Struct({ type: Schema.Literal('status') }),
  Schema.Struct({ type: Schema.Literal('ringing_status') }),
  Schema.Struct({ type: Schema.Literal('add'), ...AlarmFields }),
  Schema.Struct({ type: Schema.Literal('edit'), id: Schema.String, ...AlarmFields }),
  Schema.Struct({ type: Schema.Literal('delete'), id: Schema.String }),
  Schema.Struct({ type: Schema.Literal('pause'), duration_ms: Schema.Number }),
  Schema.Struct({ type: Schema.Literal('stop') }),
)
export type Command = Schema.Schema.Type<typeof CommandSchema>

/** アプリ側のアラーム入力（id 以外）。デバイスに送るのは alarmCommandFields が選ぶ */
export type AlarmInput = Omit<Alarm, 'id'>

export type DeviceTopics = {
  readonly command: string
  readonly alarms: string
  readonly status: string
  readonly ringingStatus: string
}

/** トピック。プレフィックスは旧アプリ・実機と同じ eager-alarm */
export function topicsFor(deviceId: string): DeviceTopics {
  const prefix = `eager-alarm/${deviceId}`
  return {
    command: `${prefix}/command`,
    alarms: `${prefix}/alarms`,
    status: `${prefix}/status`,
    ringingStatus: `${prefix}/ringing_status`,
  }
}

/** デバイス → アプリ。トピックで種類が決まる */
export type DeviceMessage =
  | { readonly kind: 'alarms'; readonly alarms: Alarm[] }
  | { readonly kind: 'ringing'; readonly ringing: RingingStatus }
  | { readonly kind: 'status'; readonly online: boolean }

export type DeviceMessageKind = DeviceMessage['kind']

/** デバイスの形からアプリの Alarm へ。walkUnlockPointId はデバイスが持たないので null */
export function toAlarm(device: DeviceAlarm): Alarm {
  return {
    id: device.id,
    time: device.time,
    daysOfWeek: device.days_of_week,
    isEnabled: device.is_enabled,
    stopMethodId: device.stop_method_id,
    walkUnlockPointId: null,
  }
}

/** アプリの入力から add / edit の中身へ。walkUnlockPointId は送らない */
export function alarmCommandFields(input: AlarmInput): Omit<DeviceAlarm, 'id'> & {
  is_nfc_enabled: boolean
} {
  return {
    time: input.time,
    days_of_week: [...input.daysOfWeek],
    is_enabled: input.isEnabled,
    stop_method_id: input.stopMethodId,
    is_nfc_enabled: false,
  }
}

const encodeCommandSync = Schema.encodeSync(Schema.parseJson(CommandSchema))
const decodeCommand = Schema.decodeUnknownEither(Schema.parseJson(CommandSchema))
const decodeAlarms = Schema.decodeUnknownEither(Schema.parseJson(AlarmsPayloadSchema))
const decodeRinging = Schema.decodeUnknownEither(Schema.parseJson(RingingStatusPayloadSchema))
const decodeStatus = Schema.decodeUnknownEither(Schema.parseJson(StatusPayloadSchema))
const encodeAlarmsSync = Schema.encodeSync(Schema.parseJson(AlarmsPayloadSchema))
const encodeRingingSync = Schema.encodeSync(Schema.parseJson(RingingStatusPayloadSchema))
const encodeStatusSync = Schema.encodeSync(Schema.parseJson(StatusPayloadSchema))

export function encodeCommand(command: Command): string {
  return encodeCommandSync(command)
}

/** デバイス側（テスト用の fake）がコマンドを読むための対。実装対称性の確認も兼ねる */
export function parseCommand(payload: string): Either.Either<Command, unknown> {
  return decodeCommand(payload)
}

/**
 * 受信したペイロードを読む。知らないトピック・壊れた電文は Left になる。
 *
 * 例外ではなく Either にしているのは、受信は常駐ループの中で起きるためで、
 * 1通の不正な電文でループごと落ちるより、その1通を捨てて次を待つほうが正しい。
 */
export function parseDeviceMessage(
  topics: DeviceTopics,
  topic: string,
  payload: string,
): Either.Either<DeviceMessage, unknown> {
  switch (topic) {
    case topics.alarms:
      return Either.map(decodeAlarms(payload), (alarms) => ({
        kind: 'alarms' as const,
        alarms: alarms.map(toAlarm),
      }))
    case topics.ringingStatus:
      return Either.map(decodeRinging(payload), (r) => ({
        kind: 'ringing' as const,
        ringing: { isRinging: r.is_ringing, ringingIds: r.ringing_ids },
      }))
    case topics.status:
      return Either.map(decodeStatus(payload), (s) => ({ kind: 'status' as const, online: s.online }))
    default:
      return Either.left(new Error(`unknown topic: ${topic}`))
  }
}

// --- デバイス側の書き手（テスト用の fake が使う）---

export function encodeAlarmsPayload(alarms: readonly Alarm[]): string {
  return encodeAlarmsSync(
    alarms.map((a) => ({
      id: a.id,
      time: a.time,
      days_of_week: [...a.daysOfWeek],
      is_enabled: a.isEnabled,
      stop_method_id: a.stopMethodId,
    })),
  )
}

export function encodeRingingPayload(ringing: RingingStatus): string {
  return encodeRingingSync({ is_ringing: ringing.isRinging, ringing_ids: [...ringing.ringingIds] })
}

export function encodeStatusPayload(online: boolean): string {
  return encodeStatusSync({ online })
}
