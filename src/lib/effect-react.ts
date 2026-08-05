import * as React from 'react'
import { Cause, Effect, Exit, Option } from 'effect'

import { errorMessage, errorSeverity, type AppError } from '@/lib/errors'
import { useNotify } from '@/contexts/notification-context'

/**
 * Effect を React から実行するための橋渡し。
 *
 * コンポーネント側で Effect.runPromise を直に呼ぶと、失敗（エラーチャネル）と
 * 欠陥（defect: 想定外の例外）の扱いがその場その場でばらつく。ここに集約して
 * - 失敗 → errorMessage() の文言を通知として出す
 * - 欠陥 → コンソールに出したうえで汎用の文言を出す（握り潰さない）
 * - アンマウント後の実行は中断する
 * を常に同じ形で行う。
 */

/** 欠陥（想定外の例外）が起きたときに出す文言 */
const DEFECT_MESSAGE = '予期しないエラーが発生しました。時間をおいて再度お試しください。'

export type RunResult<A> = Option.Option<A>

/**
 * Effect を実行し、成功値を Option で返すコールバックを作る。
 * 失敗した場合は通知を出したうえで Option.none() を返すため、
 * 呼び出し側は「成功したときだけやりたい処理」を素直に書ける。
 */
export function useRunEffect() {
  const notify = useNotify()
  // アンマウント後に通知が走らないよう、実行中の fiber をまとめて中断する。
  // 同時に走る複数の操作を互いに打ち消さないよう、1本ではなく集合で持つ
  const runningRef = React.useRef(new Set<AbortController>())

  React.useEffect(() => {
    const running = runningRef.current
    return () => {
      running.forEach((controller) => controller.abort())
      running.clear()
    }
  }, [])

  return React.useCallback(
    async <A>(effect: Effect.Effect<A, AppError>): Promise<RunResult<A>> => {
      const controller = new AbortController()
      runningRef.current.add(controller)

      const exit = await Effect.runPromiseExit(effect, { signal: controller.signal }).finally(() =>
        runningRef.current.delete(controller),
      )

      if (Exit.isSuccess(exit)) return Option.some(exit.value)

      // 中断（アンマウント/再実行）は利用者の操作ミスではないので何も出さない
      if (Cause.isInterruptedOnly(exit.cause)) return Option.none()

      const failure = Cause.failureOption(exit.cause)
      if (Option.isSome(failure)) {
        notify(errorSeverity(failure.value), errorMessage(failure.value))
      } else {
        console.error(Cause.pretty(exit.cause))
        notify('error', DEFECT_MESSAGE)
      }
      return Option.none()
    },
    [notify],
  )
}

/**
 * 実行中フラグ付きの版。保存ボタンの二重押し防止や
 * 応答待ちのオーバーレイ表示に使う。
 */
export function useRunEffectState() {
  const run = useRunEffect()
  const [pending, setPending] = React.useState(false)

  const runWithPending = React.useCallback(
    async <A>(effect: Effect.Effect<A, AppError>): Promise<RunResult<A>> => {
      setPending(true)
      try {
        return await run(effect)
      } finally {
        setPending(false)
      }
    },
    [run],
  )

  return { run: runWithPending, pending }
}
