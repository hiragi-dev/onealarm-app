export type Platform = 'ios' | 'android' | 'other'

export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'

  const ua = navigator.userAgent

  // iPadOS 13+ は Mac を名乗るので touch point 数で判別する。
  const isIpadOs =
    /Macintosh/.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1

  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** ホーム画面から起動された（= インストール済みの）状態かどうか。 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari は display-mode を持たず、独自の navigator.standalone を使う。
    ('standalone' in navigator && navigator.standalone === true)
  )
}
