import { Data, Match } from 'effect'

/**
 * アプリ全体で使う失敗の型。
 *
 * 失敗を `throw` や `null` ではなく Effect のエラーチャネルに載せるため、
 * すべて `Data.TaggedError` で定義する。こうしておくと
 * - 呼び出し側の型に「何が失敗しうるか」が現れる（`Effect<A, AlarmSaveError>` など）
 * - `Match.exhaustive` で分岐の取りこぼしをコンパイル時に検出できる
 * - `Effect.catchTag` で特定の失敗だけを個別に扱える
 * という3点が揃う。UI に出す文言は errorMessage() に集約し、
 * 各コンポーネントが独自の文言を持たないようにしている。
 */

/** ブローカー未接続。接続しないと送れないコマンドを送ろうとしたとき */
export class BrokerNotConnectedError extends Data.TaggedError('BrokerNotConnectedError')<{
  readonly operation: string
}> {}

/** エッジデバイスがオフライン。ブローカーには繋がっているが応答が期待できない */
export class EdgeOfflineError extends Data.TaggedError('EdgeOfflineError')<{
  readonly operation: string
}> {}

/** 制限時間内にエッジデバイスからの反映確認が取れなかった */
export class EdgeTimeoutError extends Data.TaggedError('EdgeTimeoutError')<{
  readonly operation: string
  readonly timeoutMs: number
}> {}

/** 鳴動中は許可されない操作（鳴っているアラームの変更・削除・停止方法の書き換え） */
export class RingingLockedError extends Data.TaggedError('RingingLockedError')<{
  readonly operation: string
}> {}

/** 入力値が不正。field は該当の入力欄名（UIでの強調表示に使う） */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string
  readonly message: string
}> {}

/** 位置情報が使えない。理由ごとに案内する内容が変わるので reason を持つ */
export class LocationUnavailableError extends Data.TaggedError('LocationUnavailableError')<{
  readonly reason: 'unsupported' | 'insecure' | 'denied' | 'timeout'
}> {}

/** センサー（加速度）の利用許可が下りなかった */
export class SensorPermissionError extends Data.TaggedError('SensorPermissionError')<{
  readonly reason: 'denied' | 'unsupported' | 'insecure'
}> {}

/** アプリが投げうる失敗の総和 */
export type AppError =
  | BrokerNotConnectedError
  | EdgeOfflineError
  | EdgeTimeoutError
  | RingingLockedError
  | ValidationError
  | LocationUnavailableError
  | SensorPermissionError

/**
 * 失敗を利用者向けの日本語メッセージに変換する。
 * Match.exhaustive なので、AppError に種類を足すとここが型エラーになり、
 * 文言の付け忘れたまま出荷されることがない。
 */
export const errorMessage = Match.type<AppError>().pipe(
  Match.tag(
    'BrokerNotConnectedError',
    (e) => `${e.operation}できませんでした。ブローカーに接続してから再度お試しください。`,
  ),
  Match.tag(
    'EdgeOfflineError',
    (e) => `${e.operation}できませんでした。エッジデバイスがオフラインです。`,
  ),
  Match.tag(
    'EdgeTimeoutError',
    (e) => `${e.operation}の反映を確認できませんでした。一覧を確認してください。`,
  ),
  Match.tag('RingingLockedError', (e) => `鳴動中は${e.operation}できません。先に停止してください。`),
  Match.tag('ValidationError', (e) => e.message),
  Match.tag('LocationUnavailableError', (e) => {
    switch (e.reason) {
      case 'unsupported':
        return 'この端末/ブラウザは位置情報に対応していません。'
      case 'insecure':
        return '位置情報の取得には HTTPS（または localhost）でのアクセスが必要です。'
      case 'denied':
        return '位置情報の利用が拒否されています。ブラウザの設定から許可してください。'
      case 'timeout':
        return '現在地を取得できませんでした。電波状況の良い場所で再度お試しください。'
    }
  }),
  Match.tag('SensorPermissionError', (e) => {
    switch (e.reason) {
      case 'denied':
        return '歩行検知の利用が拒否されています。ブラウザの設定から許可してください。'
      case 'unsupported':
        return 'このブラウザ/デバイスは歩行検知（加速度センサー）に対応していません。'
      case 'insecure':
        return '歩行検知には HTTPS（または localhost）でのアクセスが必要です。'
    }
  }),
  Match.exhaustive,
)

/** 失敗の深刻度。通知の見た目（色）を決めるのに使う */
export const errorSeverity = Match.type<AppError>().pipe(
  Match.tags({
    ValidationError: () => 'warning' as const,
    RingingLockedError: () => 'warning' as const,
  }),
  Match.orElse(() => 'error' as const),
)
