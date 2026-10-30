import { match } from 'ts-pattern'

import { Switch } from '@/components/ui/switch'
import { ALL_DAYS, DAY_LABELS, type DayOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'

const FULL_DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: '月曜日',
  Tue: '火曜日',
  Wed: '水曜日',
  Thu: '木曜日',
  Fri: '金曜日',
  Sat: '土曜日',
  Sun: '日曜日',
}

/**
 * 【B案】リスト形式案。
 *
 * 横に並べる発想自体をやめ、縦積みの1行1曜日リストにする（iOS標準時計の
 * 「繰り返し」に近い形）。行は全幅が当たり判定になり、隣の行との間には
 * 十分な余白があるため、そもそも「隣を押してしまう」状況が構造的に起きない。
 * 縦方向に場所を取る代わりに、誤タップの可能性そのものをなくす方向。
 */
export function DayOfWeekPickerVariantB({
  value,
  onChange,
  disabled,
}: {
  value: DayOfWeek[]
  onChange: (days: DayOfWeek[]) => void
  disabled?: boolean
}) {
  const toggleDay = (day: DayOfWeek) => {
    onChange(
      match(value.includes(day))
        .with(true, () => value.filter((d) => d !== day))
        .with(false, () => [...value, day])
        .exhaustive(),
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8">
      {ALL_DAYS.map((day, index) => {
        const selected = value.includes(day)
        return (
          <div
            key={day}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={selected}
            aria-disabled={disabled}
            onClick={() => !disabled && toggleDay(day)}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleDay(day)
              }
            }}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              disabled && 'pointer-events-none opacity-50',
              index > 0 && 'border-t border-white/8',
              selected ? 'bg-primary/8' : 'hover:bg-white/4',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                selected ? 'bg-primary text-primary-foreground' : 'bg-white/8 text-muted-foreground',
              )}
            >
              {DAY_LABELS[day]}
            </span>
            <span className="flex-1 font-medium">{FULL_DAY_LABELS[day]}</span>
            {/* 行全体をタップ領域にしているため Switch 自体は視覚的なフィードバックのみ。
                pointer-events-none にしないと Switch 自体への直接タップでも
                toggle が二重発火する */}
            <Switch checked={selected} className="pointer-events-none" tabIndex={-1} />
          </div>
        )
      })}
    </div>
  )
}
