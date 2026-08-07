import { match } from 'ts-pattern'

import { ALL_DAYS, DAY_LABELS, type DayOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'

/** 曜日を1つ以上選ばせる丸チップの行。新規作成ウィザードと編集ページで共有する。 */
export function DayOfWeekPicker({
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
    <div className="flex w-full gap-2.5">
      {ALL_DAYS.map((day) => {
        const selected = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggleDay(day)}
            aria-pressed={selected}
            className={cn(
              'aspect-square flex-1 rounded-xl border text-sm font-bold transition-transform disabled:pointer-events-none disabled:opacity-50',
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
}
