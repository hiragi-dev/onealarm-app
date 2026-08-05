import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BellRing } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useDemo } from '@/contexts/demo-context'

/**
 * 鳴動状況を監視し、アラームが鳴り始めた瞬間だけ
 * 「停止」タブへの遷移を促すバナーを画面上部に出す。
 */
export function RingingBanner() {
  const { ringingStatus } = useDemo()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const prevRingingRef = React.useRef(false)

  React.useEffect(() => {
    const isRinging = ringingStatus?.isRinging === true
    // 非鳴動 → 鳴動 に切り替わった瞬間だけ表示し、止まったら自動的に閉じる
    if (isRinging && !prevRingingRef.current) setOpen(true)
    if (!isRinging && prevRingingRef.current) setOpen(false)
    prevRingingRef.current = isRinging
  }, [ringingStatus])

  if (!open) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-warning/30 bg-warning/15 px-4 py-3 text-sm shadow-2xl backdrop-blur-lg animate-in fade-in-0 slide-in-from-top-2">
        <BellRing className="size-4 shrink-0 text-warning" />
        <span className="flex-1 font-medium">アラームが鳴っています！</span>
        <Button
          size="sm"
          variant="ghost"
          className="font-bold whitespace-nowrap"
          onClick={() => {
            setOpen(false)
            void navigate({ to: '/stop' })
          }}
        >
          停止する
        </Button>
      </div>
    </div>
  )
}
