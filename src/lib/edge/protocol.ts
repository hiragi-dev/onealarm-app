import { Either, Schema } from 'effect'

import { ALL_DAYS } from '@/lib/alarm'

/**
 * PWA とエッジデバイスの間で交わす電文の定義（MQTT のペイロード）。
 *
 * この層の設計方針は DECISION.md の通り、
 * **ブローカーのセッション永続（オフライン中のメッセージキュー）に依存しない**こと。
 * そのため電文は「起きた出来事の差分」ではなく、常に**その時点の全状態**を運ぶ。
 * 受け手は届いた state で手元を丸ごと置き換えるだけでよく、
 * 「切断中に何を取りこぼしたか」を考える必要がない。
 *
 * retain も使わない。接続のたびにアプリ側から get-state を送って取り直すので、
 * ブローカーに状態を覚えておいてもらう必要がないため。
 * 結果として、この電文のやりとりは fake の transport だけで完全に検証できる。
 */

const DayOfWeekSchema = Schema.Literal(...ALL_DAYS)

/** アラームの中身（id を除く）。追加・変更で送る */
export const AlarmInputSchema = Schema.Struct({
  time: Schema.String,
  daysOfWeek: Schema.mutable(Schema.Array(DayOfWeekSchema)),
  isEnabled: Schema.Boolean,
  stopMethodId: Schema.NullOr(Schema.String),
  isNfcEnabled: Schema.Boolean,
})
export type AlarmInput = Schema.Schema.Type<typeof AlarmInputSchema>

/** エッジデバイスが保持している1件のアラーム。id はデバイスが採番する */
export const AlarmSchema = Schema.Struct({
  id: Schema.String,
  ...AlarmInputSchema.fields,
})

export const RingingStatusSchema = Schema.Struct({
  isRinging: Schema.Boolean,
  ringingIds: Schema.mutable(Schema.Array(Schema.String)),
})

/** エッジデバイスの全状態。差分ではなくこれ1つで手元を置き換える */
export const DeviceStateSchema = Schema.Struct({
  alarms: Schema.mutable(Schema.Array(AlarmSchema)),
  ringing: RingingStatusSchema,
})
export type DeviceState = Schema.Schema.Type<typeof DeviceStateSchema>

/** アプリ → デバイス */
export const CommandSchema = Schema.Union(
  /** 全状態をよこせ。接続のたびに必ず送る */
  Schema.Struct({ kind: Schema.Literal('get-state') }),
  Schema.Struct({ kind: Schema.Literal('set-power'), power: Schema.Literal('on', 'off') }),
  Schema.Struct({ kind: Schema.Literal('add-alarm'), alarm: AlarmInputSchema }),
  Schema.Struct({
    kind: Schema.Literal('edit-alarm'),
    id: Schema.String,
    alarm: AlarmInputSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('delete-alarm'), id: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('stop-ringing') }),
)
export type Command = Schema.Schema.Type<typeof CommandSchema>

/**
 * コマンドは requestId を付けて送る。デバイスは同じ requestId を ack で返す。
 * 遅れて届いた ack や重複した ack を「今待っている応答」と取り違えないため。
 */
export const CommandEnvelopeSchema = Schema.Struct({
  requestId: Schema.String,
  command: CommandSchema,
})
export type CommandEnvelope = Schema.Schema.Type<typeof CommandEnvelopeSchema>

/** デバイス → アプリ */
export const DeviceMessageSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('state'), state: DeviceStateSchema }),
  Schema.Struct({ kind: Schema.Literal('ack'), requestId: Schema.String }),
)
export type DeviceMessage = Schema.Schema.Type<typeof DeviceMessageSchema>

/**
 * トピック。デバイスIDで名前空間を切り、向きごとに1本ずつ。
 * トピックを状態の種類ごとに分けない（alarms / status を別トピックにしない）のは、
 * 全状態を1つの電文で運ぶ以上、分ける意味がないうえ、
 * 分けると「片方だけ届いた」中間状態を扱う羽目になるため。
 */
export function topicsFor(deviceId: string): { command: string; event: string } {
  return {
    command: `onealarm/${deviceId}/cmd`,
    event: `onealarm/${deviceId}/evt`,
  }
}

const encodeEnvelope = Schema.encodeSync(Schema.parseJson(CommandEnvelopeSchema))
const decodeEnvelope = Schema.decodeUnknownEither(Schema.parseJson(CommandEnvelopeSchema))
const encodeDeviceMessage = Schema.encodeSync(Schema.parseJson(DeviceMessageSchema))
const decodeDeviceMessage = Schema.decodeUnknownEither(Schema.parseJson(DeviceMessageSchema))

export function encodeCommandEnvelope(envelope: CommandEnvelope): string {
  return encodeEnvelope(envelope)
}

export function encodeDeviceMessagePayload(message: DeviceMessage): string {
  return encodeDeviceMessage(message)
}

/**
 * 受信したペイロードを読む。壊れた電文・知らない電文は Left になる。
 *
 * ここを例外ではなく Either にしているのは、受信は常駐ループの中で起きるためで、
 * 1通の不正な電文でループごと落ちるより、その1通を捨てて次を待つほうが正しい。
 */
export function parseDeviceMessage(payload: string): Either.Either<DeviceMessage, unknown> {
  return decodeDeviceMessage(payload)
}

/** デバイス側（テスト用のダミーデバイス）がコマンドを読むための対。実装対称性の確認も兼ねる */
export function parseCommandEnvelope(payload: string): Either.Either<CommandEnvelope, unknown> {
  return decodeEnvelope(payload)
}
