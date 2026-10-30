import { match } from 'ts-pattern'

import { DAY_LABELS, type DayOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'

const WEEKDAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const WEEKEND: DayOfWeek[] = ['Sat', 'Sun']

/**
 * 【A案】拡大・分割案。
 *
 * 現行の「7個を1列」をやめ、平日5個/週末2個の2段にする。同じボタンサイズなら
 * 1段あたりの個数が減るほど1個は大きくなるため、間隔を広げつつボタン自体も
 * 大きくできる。誤タップの直接原因（ボタンが小さく隙間が狭い）に最短距離で効く。
 */
export function DayOfWeekPickerVariantA({
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

  const renderRow = (days: DayOfWeek[]) => (
    <div className="flex gap-3">
      {days.map((day) => {
        const selected = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggleDay(day)}
            aria-pressed={selected}
            className={cn(
              'flex-1 rounded-2xl border py-4 text-base font-bold transition-transform disabled:pointer-events-none disabled:opacity-50',
              match(selected)
                .with(true, () => 'scale-105 border-primary bg-primary text-primary-foreground')
                .with(false, () => 'border-white/15 text-muted-foreground hover:bg-white/8')
                .exhaustive(),
            )}
          >
            {DAY_LABELS[day]}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
          平日
        </p>
        {renderRow(WEEKDAYS)}
      </div>
      <div>
        <p className="mb-1.5 text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
          週末
        </p>
        {/* 週末は2個だけ。平日と同じボタン幅を保つため flex-1 にはせず、
            左側に固定幅で並べて残りは空ける（週末側だけ間延びして大きくなるのを防ぐ） */}
        <div className="flex gap-3">
          {WEEKEND.map((day) => {
            const selected = value.includes(day)
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => toggleDay(day)}
                aria-pressed={selected}
                style={{ width: 'calc((100% - 3 * 0.75rem) / 5)' }}
                className={cn(
                  'rounded-2xl border py-4 text-base font-bold transition-transform disabled:pointer-events-none disabled:opacity-50',
                  match(selected)
                    .with(true, () => 'scale-105 border-primary bg-primary text-primary-foreground')
                    .with(false, () => 'border-white/15 text-muted-foreground hover:bg-white/8')
                    .exhaustive(),
                )}
              >
                {DAY_LABELS[day]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
