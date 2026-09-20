import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StopMethod } from '@/lib/stop-method'

/** Radix の Select は空文字を項目の値にできないので、「地点なし」は別の値で表す */
const NONE = 'none'

/**
 * 「歩行検知を有効にする地点」の選択。新規作成ウィザードと編集ページで共有する。
 * 候補は停止方法と同じ地点の一覧。停止地点と同じ地点を選ぶと保存時の検証で落ちる
 * （ここで候補から外すと、後から停止方法を同じ地点に変えたときに整合が取れないため）。
 */
export function WalkUnlockPointSelect({
  id,
  value,
  onChange,
  stopMethods,
  disabled,
}: {
  id?: string
  value: string | null
  onChange: (id: string | null) => void
  stopMethods: StopMethod[]
  disabled?: boolean
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>最初から有効</SelectItem>
        {stopMethods.map((method) => (
          <SelectItem key={method.id} value={method.id}>
            {method.label}に着いたら（半径{method.radiusMeters}m）
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
