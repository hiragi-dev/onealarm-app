import { useRegisterSW } from 'virtual:pwa-register/react'
import { match } from 'ts-pattern'

import { Button } from '@/components/ui/button'

/**
 * Service Worker の登録と、その状態表示。
 * registerType: 'autoUpdate' なので通常 needRefresh は出ないが、
 * skipWaiting できなかった場合の逃げ道として更新ボタンを残している。
 */
export function SwStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service Worker の登録に失敗しました', error)
    },
  })

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="bg-card fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 flex items-center gap-3 rounded-lg border p-3 text-sm shadow-lg">
      <span>
        {match(needRefresh)
          .with(true, () => '新しいバージョンがあります')
          .with(false, () => 'オフラインで利用できます')
          .exhaustive()}
      </span>
      {match(needRefresh)
        .with(true, () => (
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            更新
          </Button>
        ))
        .with(false, () => (
          <Button size="sm" variant="ghost" onClick={close}>
            閉じる
          </Button>
        ))
        .exhaustive()}
    </div>
  )
}
