import * as React from 'react'
import { match } from 'ts-pattern'

import { ALL_DAYS, DAY_LABELS, type DayOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'

function dayAtPoint(x: number, y: number): DayOfWeek | null {
  const el = document.elementFromPoint(x, y)
  const button = el?.closest<HTMLElement>('[data-day]')
  const day = button?.dataset.day as DayOfWeek | undefined
  return day ?? null
}

/**
 * 【C案】スワイプ選択案。
 *
 * 見た目は現行とほぼ同じ「7個1列の丸チップ」を維持するが、指を押したまま
 * 横になぞる（ドラッグ）と、なぞった範囲の曜日をまとめて選択/解除できるように
 * 拡張する。「平日を選ぶ」操作が5回の精密なタップから1回のスワイプになるため、
 * 個々のボタンの小ささ自体は変えずに、誤タップが起きる操作の回数を減らす方向。
 * 通常のワンタップでの個別トグルも従来どおり使える。
 */
export function DayOfWeekPickerVariantC({
  value,
  onChange,
  disabled,
}: {
  value: DayOfWeek[]
  onChange: (days: DayOfWeek[]) => void
  disabled?: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  // ドラッグ中に「押していく先」を選択/解除どちらにするかは、最初に触れた
  // 曜日の状態を反転した値に固定する（選択済みを押し始めたら解除方向で伸びる）
  const dragTargetSelectedRef = React.useRef<boolean | null>(null)
  const lastDraggedDayRef = React.useRef<DayOfWeek | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // ドラッグ中に何曜日も連続でトグルするため、直近の値を ref で追いかける。
  // value（props、React state 経由）をそのままクロージャで読むと、1回のドラッグ中に
  // 複数回 applyDay を呼んだときに古い value を基準にした更新が重なって、
  // 途中でトグルした曜日が後続の呼び出しで巻き戻ってしまう（stale closure）。
  const valueRef = React.useRef(value)
  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  const applyDay = React.useCallback(
    (day: DayOfWeek, shouldSelect: boolean) => {
      const current = valueRef.current
      const currentlySelected = current.includes(day)
      if (currentlySelected === shouldSelect) return
      const next = shouldSelect ? [...current, day] : current.filter((d) => d !== day)
      valueRef.current = next
      onChange(next)
    },
    [onChange],
  )

  const handlePointerDown = (day: DayOfWeek, e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const targetSelected = !valueRef.current.includes(day)
    dragTargetSelectedRef.current = targetSelected
    lastDraggedDayRef.current = day
    setIsDragging(true)
    applyDay(day, targetSelected)
  }

  React.useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      const targetSelected = dragTargetSelectedRef.current
      if (targetSelected === null) return
      const day = dayAtPoint(e.clientX, e.clientY)
      if (!day || day === lastDraggedDayRef.current) return
      lastDraggedDayRef.current = day
      applyDay(day, targetSelected)
    }
    const handlePointerUp = () => {
      setIsDragging(false)
      dragTargetSelectedRef.current = null
      lastDraggedDayRef.current = null
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isDragging, applyDay])

  return (
    <div ref={containerRef} className="select-none">
      <div className="flex w-full gap-1.5" style={{ touchAction: 'none' }}>
        {ALL_DAYS.map((day) => {
          const selected = value.includes(day)
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              disabled={disabled}
              aria-pressed={selected}
              onPointerDown={(e) => handlePointerDown(day, e)}
              className={cn(
                'aspect-square flex-1 rounded-full border text-sm font-bold transition-transform disabled:pointer-events-none disabled:opacity-50',
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
      <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
        指でなぞると複数の曜日をまとめて選択できます
      </p>
    </div>
  )
}
