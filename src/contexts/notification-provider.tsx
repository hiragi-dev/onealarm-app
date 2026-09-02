import * as React from 'react'
import { match, P } from 'ts-pattern'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

import { NotifyContext, type Severity } from '@/contexts/notification-context'
import { cn } from '@/lib/utils'

type Notification = { key: number; severity: Severity; message: string }

const AUTO_HIDE_MS = 4000

const severityStyles: Record<Severity, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-primary/30 bg-primary/15 text-foreground', Icon: Info },
  success: { className: 'border-success/30 bg-success/15 text-foreground', Icon: CircleCheck },
  warning: { className: 'border-warning/35 bg-warning/15 text-foreground', Icon: TriangleAlert },
  error: {
    className: 'border-destructive/35 bg-destructive/15 text-foreground',
    Icon: CircleAlert,
  },
}

/**
 * 各所で起きたエラーや操作結果を、文字列を画面に埋め込むのではなくポップアップで伝える。
 * 短時間に複数発生した場合も1件ずつ順番に表示する（キュー方式）。
 *
 * 同じ内容が既に出ている/待っている間は積まない。ロックされた入力欄を続けて
 * 叩いたときのように、同じ操作が短時間に繰り返されると同じ文言が何件も並び、
 * 表示時間 × 件数のあいだポップアップが居座ってしまうため。
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<Notification[]>([])
  const current = queue[0] ?? null

  const notify = React.useCallback((severity: Severity, message: string) => {
    setQueue((prev) => {
      const duplicated = prev.some((n) => n.severity === severity && n.message === message)
      if (duplicated) return prev
      return [...prev, { key: Date.now() + Math.random(), severity, message }]
    })
  }, [])

  const dismiss = React.useCallback(() => setQueue((prev) => prev.slice(1)), [])

  React.useEffect(() => {
    if (!current) return
    const timer = setTimeout(dismiss, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [current, dismiss])

  const style = match(current)
    .with(P.nullish, () => null)
    .otherwise((n) => severityStyles[n.severity])

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      {current && style && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-60 flex justify-center px-4">
          <div
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-lg animate-in fade-in-0 slide-in-from-bottom-2',
              style.className,
            )}
          >
            <style.Icon className="size-4 shrink-0" />
            <span className="flex-1">{current.message}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="通知を閉じる"
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  )
}
