import * as React from 'react'

/** 通知の深刻度。見た目（色とアイコン）を決める */
export type Severity = 'info' | 'success' | 'warning' | 'error'

export type Notify = (severity: Severity, message: string) => void

export const NotifyContext = React.createContext<Notify | null>(null)

export function useNotify(): Notify {
  const notify = React.useContext(NotifyContext)
  if (!notify) throw new Error('useNotify は NotificationProvider の中でのみ使えます')
  return notify
}
