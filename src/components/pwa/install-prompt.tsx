import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/use-pwa-install'

/**
 * ホーム画面への追加を促すバナー。
 *
 * Safari のタブとして使い続けると、
 * - 7 日間操作がないオリジンのスクリプト由来データが自動削除される
 * - Safari と PWA でストレージが分離されており、後から移行できない
 * ため、データを作る前にインストールしてもらう必要がある。
 */
export function InstallPrompt() {
  const { shouldSuggest, canPrompt, needsManualInstructions, promptInstall, dismiss } =
    usePwaInstall()

  if (!shouldSuggest) return null

  return (
    <div className="bg-card fixed inset-x-0 bottom-0 z-50 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg">
      <div className="mx-auto flex max-w-md items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">ホーム画面に追加してください</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            ブラウザのままだと、しばらく使わない間にアラームの設定が消えることがあります。
            追加後はデータが引き継がれないため、設定を作る前の追加をおすすめします。
          </p>

          {canPrompt && (
            <Button size="sm" onClick={() => void promptInstall()}>
              <Download />
              インストール
            </Button>
          )}

          {needsManualInstructions && (
            <ol className="text-muted-foreground space-y-1 text-xs">
              <li className="flex items-center gap-1.5">
                <Share className="size-3.5 shrink-0" aria-hidden />
                <span>1. 下部の「共有」をタップ</span>
              </li>
              <li className="flex items-center gap-1.5">
                <SquarePlus className="size-3.5 shrink-0" aria-hidden />
                <span>2.「ホーム画面に追加」を選択</span>
              </li>
            </ol>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="この案内を閉じる"
          className="shrink-0"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
