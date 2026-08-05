import { Effect, ParseResult, Schema } from 'effect'

import { ALL_DAYS, type DayOfWeek } from '@/lib/alarm'
import { ValidationError } from '@/lib/errors'
import {
  MAX_STOP_METHOD_RADIUS_METERS,
  MIN_STOP_METHOD_RADIUS_METERS,
  type StopMethodInput,
} from '@/lib/stop-method'

/**
 * フォーム入力の検証。
 *
 * 「入力欄の生の文字列」から「ドメインの型」への変換を Schema として1か所に書き、
 * 失敗は ValidationError（タグ付きエラー）としてエラーチャネルに載せる。
 * コンポーネント側は if 文を並べる代わりに decode の結果を使うだけでよく、
 * 「保存ボタンの活性条件」と「保存時の検証」が同じ定義から導かれるので
 * 片方だけ直して条件がずれる、という食い違いが起きない。
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "HH:MM" 形式の時刻 */
export const TimeString = Schema.String.pipe(
  Schema.pattern(HHMM, {
    message: () => '時刻を HH:MM の形式で入力してください',
  }),
  Schema.brand('TimeString'),
)

/** 1つ以上選ばれた曜日 */
export const DaysOfWeek = Schema.Array(Schema.Literal(...ALL_DAYS)).pipe(
  Schema.minItems(1, { message: () => '繰り返す曜日を1つ以上選んでください' }),
)

/** 未選択（空文字）を弾いた停止方法ID */
export const StopMethodId = Schema.String.pipe(
  Schema.minLength(1, { message: () => '停止方法を選択してください' }),
  Schema.brand('StopMethodId'),
)

/** アラームの追加・編集フォーム */
export const AlarmForm = Schema.Struct({
  time: TimeString,
  daysOfWeek: DaysOfWeek,
  stopMethodId: StopMethodId,
  isNfcEnabled: Schema.Boolean,
})
export type AlarmForm = Schema.Schema.Type<typeof AlarmForm>

/** 停止方法の名前。前後の空白は落としてから長さを見る */
export const StopMethodLabel = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => '名前を入力してください' }),
  Schema.maxLength(20, { message: () => '名前は20文字以内で入力してください' }),
)

/** 到達判定の半径（m）。スライダーの範囲と同じ値をここで一元管理する */
export const RadiusMeters = Schema.Number.pipe(
  Schema.between(MIN_STOP_METHOD_RADIUS_METERS, MAX_STOP_METHOD_RADIUS_METERS, {
    message: () =>
      `半径は${MIN_STOP_METHOD_RADIUS_METERS}〜${MAX_STOP_METHOD_RADIUS_METERS}mの範囲で指定してください`,
  }),
)

export const Latitude = Schema.Number.pipe(
  Schema.between(-90, 90, { message: () => '緯度が不正です' }),
)
export const Longitude = Schema.Number.pipe(
  Schema.between(-180, 180, { message: () => '経度が不正です' }),
)

/** 停止方法（位置情報）の登録・編集フォーム */
export const StopMethodForm = Schema.Struct({
  label: StopMethodLabel,
  lat: Latitude,
  lng: Longitude,
  radiusMeters: RadiusMeters,
})
export type StopMethodForm = Schema.Schema.Type<typeof StopMethodForm>

/**
 * Schema の ParseError を、UI がそのまま扱える ValidationError に翻訳する。
 * どの入力欄で落ちたかを field に残し、フォーム側で強調表示できるようにする。
 */
function toValidationError(error: ParseResult.ParseError): ValidationError {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  const first = issues[0]
  return new ValidationError({
    field: first?.path.join('.') ?? '',
    message: first?.message ?? '入力内容を確認してください',
  })
}

/** Schema でデコードし、失敗を ValidationError に載せ替える */
export function decode<A, I>(
  schema: Schema.Schema<A, I>,
  input: I,
): Effect.Effect<A, ValidationError> {
  return Schema.decode(schema)(input).pipe(Effect.mapError(toValidationError))
}

/** アラームフォームの検証。成功すると型の付いた値が得られる */
export function validateAlarmForm(input: {
  time: string
  daysOfWeek: readonly DayOfWeek[]
  stopMethodId: string
  isNfcEnabled: boolean
}): Effect.Effect<AlarmForm, ValidationError> {
  return decode(AlarmForm, input)
}

/** 停止方法フォームの検証。地点未選択（null）もここで失敗として扱う */
export function validateStopMethodForm(input: {
  label: string
  point: { lat: number; lng: number } | null
  radiusMeters: number
}): Effect.Effect<StopMethodInput, ValidationError> {
  if (!input.point) {
    return Effect.fail(
      new ValidationError({ field: 'point', message: '地図をタップして停止地点を選んでください' }),
    )
  }
  return decode(StopMethodForm, {
    label: input.label,
    lat: input.point.lat,
    lng: input.point.lng,
    radiusMeters: input.radiusMeters,
  })
}
