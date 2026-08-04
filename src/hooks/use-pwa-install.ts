import { useCallback, useEffect, useState } from 'react'
import { getPlatform, isStandalone, type Platform } from '@/lib/platform'

/** Chromium 系のみが発火する非標準イベント。 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISSED_KEY = 'onealarm:install-prompt-dismissed-at'
/** 「あとで」を選んだあと、再度案内を出すまでの期間。 */
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 「あとで」を選んでから TTL 以内かどうか。判定はマウント時に一度だけ行う。 */
function isRecentlyDismissed(): boolean {
  let raw: string | null
  try {
    raw = localStorage.getItem(DISMISSED_KEY)
  } catch {
    return false
  }
  if (!raw) return false

  const at = Number(raw)
  return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS
}

export interface PwaInstall {
  platform: Platform
  /** すでにホーム画面から起動している。 */
  installed: boolean
  /** ネイティブのインストールダイアログを出せる（Android / デスクトップ Chromium）。 */
  canPrompt: boolean
  /** iOS Safari のように手動手順の案内が必要。 */
  needsManualInstructions: boolean
  /** 案内を表示すべきか（インストール済み・却下期間中は false）。 */
  shouldSuggest: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  dismiss: () => void
}

export function usePwaInstall(): PwaInstall {
  const [platform] = useState<Platform>(() => getPlatform())
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(isRecentlyDismissed)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // 既定のミニインフォバーを抑止し、任意のタイミングで出せるよう保持する。
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // standalone への遷移をライブに拾う（同一タブで起動モードが変わるケース）。
    const media = window.matchMedia('(display-mode: standalone)')
    const onDisplayModeChange = () => setInstalled(isStandalone())
    media.addEventListener('change', onDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onDisplayModeChange)
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // ストレージが使えなくても致命的ではない。
    }
    setDismissed(true)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // prompt() は一度しか使えないので破棄する。
    setDeferredPrompt(null)
    if (outcome === 'dismissed') dismiss()
    return outcome
  }, [deferredPrompt, dismiss])

  const canPrompt = deferredPrompt !== null
  const needsManualInstructions = !installed && !canPrompt && platform === 'ios'

  return {
    platform,
    installed,
    canPrompt,
    needsManualInstructions,
    shouldSuggest: !installed && !dismissed && (canPrompt || needsManualInstructions),
    promptInstall,
    dismiss,
  }
}
