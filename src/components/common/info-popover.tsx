import type * as React from 'react'
import { Info } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * 長い説明文を常時表示せず、アイコンボタンを押した時だけポップオーバーで表示する。
 * ホバーではなくタップ起点にしているのはモバイル操作を考慮したもの。
 */
export function InfoPopover({
  children,
  ariaLabel = '説明を表示',
}: {
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  )
}
