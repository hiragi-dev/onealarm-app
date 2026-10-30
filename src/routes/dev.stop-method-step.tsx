import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { match } from 'ts-pattern'
import { MapPin } from 'lucide-react'

import { StopMethodStepVariantA } from '@/components/alarm/stop-method-step-variants/variant-a-always-preview'
import { StopMethodStepVariantB } from '@/components/alarm/stop-method-step-variants/variant-b-tap-to-view'
import { StopMethodStepVariantC } from '@/components/alarm/stop-method-step-variants/variant-c-accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDemo } from '@/contexts/demo-context'
import { useRunEffect } from '@/lib/effect-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dev/stop-method-step')({
  component: StopMethodStepCompare,
})

type Variant = 'current' | 'a' | 'b' | 'c'

const VARIANTS: { key: Variant; label: string; blurb: string }[] = [
  { key: 'current', label: '現行', blurb: '比較の基準。テキストのみで地図プレビューなし。' },
  { key: 'a', label: 'A. 常時プレビュー', blurb: '選択中の地点の地図を一覧の下に常に表示する。' },
  { key: 'b', label: 'B. タップして確認', blurb: '一覧は軽いまま、地図アイコンを押すと全画面で確認できる。' },
  { key: 'c', label: 'C. インライン展開', blurb: '選んだ行がその場でアコーディオンのように開いて地図を見せる。' },
]

/**
 * 「どこまで行けば止めますか」ステップに地図プレビューを足す3方向の比較用
 * dev 専用ページ。ナビゲーションからはリンクしていない（URL を直接開く）。
 * 実機での操作感を試すための実コンポーネント。収束したら削除する。
 */
function StopMethodStepCompare() {
  const { stopMethods, currentPosition, startWatching } = useDemo()
  const run = useRunEffect()
  const [variant, setVariant] = React.useState<Variant>('current')
  const [selectedId, setSelectedId] = React.useState(stopMethods[0]?.id ?? '')

  React.useEffect(() => {
    void run(startWatching)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = VARIANTS.find((v) => v.key === variant)!

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">停止方法プレビューUI比較（dev専用）</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        新規作成ウィザードの「どこまで行けば止めますか」ステップの案です。
      </p>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setVariant(v.key)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              v.key === variant
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/15 text-muted-foreground hover:bg-white/8',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{active.blurb}</p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-white/4 p-4">
        {match(stopMethods)
          .with([], () => (
            <Alert variant="warning">
              <AlertDescription>
                停止方法が登録されていません。「停止」タブから先に登録してください。
              </AlertDescription>
            </Alert>
          ))
          .otherwise((methods) =>
            match(variant)
              .with('current', () => (
                <div className="space-y-2">
                  {methods.map((method) => {
                    const isSelected = selectedId === method.id
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedId(method.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/8'
                            : 'border-white/10 bg-white/4 hover:bg-white/6',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white/8 text-muted-foreground',
                          )}
                        >
                          <MapPin className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{method.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            到達判定 半径{method.radiusMeters}m
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
              .with('a', () => (
                <StopMethodStepVariantA
                  methods={methods}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  currentPosition={currentPosition}
                />
              ))
              .with('b', () => (
                <StopMethodStepVariantB
                  methods={methods}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  currentPosition={currentPosition}
                />
              ))
              .with('c', () => (
                <StopMethodStepVariantC
                  methods={methods}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  currentPosition={currentPosition}
                />
              ))
              .exhaustive(),
          )}
      </div>

      <div className="mt-4 rounded-xl bg-white/4 px-3 py-2 text-sm">
        選択中:{' '}
        <span className="font-bold">
          {stopMethods.find((m) => m.id === selectedId)?.label ?? '未選択'}
        </span>
      </div>
    </div>
  )
}
