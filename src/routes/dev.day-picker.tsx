import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { match } from 'ts-pattern'

import { DayOfWeekPickerVariantA } from '@/components/alarm/day-picker-variants/variant-a-spacious'
import { DayOfWeekPickerVariantB } from '@/components/alarm/day-picker-variants/variant-b-list'
import { DayOfWeekPickerVariantC } from '@/components/alarm/day-picker-variants/variant-c-drag'
import { DayOfWeekPicker } from '@/components/alarm/day-of-week-picker'
import { formatDaysOfWeek, type DayOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dev/day-picker')({
  component: DayPickerCompare,
})

type Variant = 'current' | 'a' | 'b' | 'c'

const VARIANTS: { key: Variant; label: string; blurb: string }[] = [
  { key: 'current', label: '現行', blurb: '比較の基準。7個1列、狭い間隔。' },
  { key: 'a', label: 'A. 拡大・分割', blurb: '平日5個/週末2個の2段にしてボタンを大きくする。' },
  { key: 'b', label: 'B. リスト', blurb: '縦積みの1行1曜日リストにして隣接自体をなくす。' },
  { key: 'c', label: 'C. スワイプ選択', blurb: '見た目は現行のまま、なぞって複数選択できるようにする。' },
]

/**
 * 「繰り返す曜日」UIの方向性を比較するための dev 専用ページ。ナビゲーションからは
 * リンクしていない（URL を直接開く）。実機での誤タップしやすさは Playwright の
 * 精密クリックでは検証できないため、実際にタップして試すための実コンポーネント
 * として用意した。3方向の発散が終わり収束したら、このファイルと variants/ は削除する。
 */
function DayPickerCompare() {
  const [variant, setVariant] = React.useState<Variant>('current')
  const [days, setDays] = React.useState<DayOfWeek[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

  const active = VARIANTS.find((v) => v.key === variant)!

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">曜日UI比較（dev専用）</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        隣のボタンを誤タップしにくいか、実際にタップして試してください。
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
        {match(variant)
          .with('current', () => (
            <DayOfWeekPicker value={days} onChange={setDays} />
          ))
          .with('a', () => <DayOfWeekPickerVariantA value={days} onChange={setDays} />)
          .with('b', () => <DayOfWeekPickerVariantB value={days} onChange={setDays} />)
          .with('c', () => <DayOfWeekPickerVariantC value={days} onChange={setDays} />)
          .exhaustive()}
      </div>

      <div className="mt-4 rounded-xl bg-white/4 px-3 py-2 text-sm">
        選択中: <span className="font-bold">{formatDaysOfWeek(days)}</span>
      </div>

      <button
        type="button"
        onClick={() => setDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
        className="mt-3 self-start text-xs text-muted-foreground underline underline-offset-4"
      >
        平日にリセット
      </button>
    </div>
  )
}
