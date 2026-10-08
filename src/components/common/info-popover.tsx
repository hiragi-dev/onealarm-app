import type * as React from 'react'
import { Info } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * 長い説明文を常時表示せず、アイコンボタンを押した時だけポップオーバーで表示する。
 * ホバーではなくタップ起点にしているのはモバイル操作を考慮したもの。
 *
 * 見出しの横に置くので、縦位置は見出しの文字に合わせる必要がある。
 * 呼び出し側は flex の items-center で並べているが、それが揃えるのは
 * 「箱の中央」であって「文字の中央」ではない。行ボックスは文字の上下に
 * 行間の余白を持つうえ、丸いアイコンは角ばった文字の隣だと同じ高さでも
 * 沈んで見えるため、1px だけ持ち上げて見た目の中央に寄せる。
 *
 * inline-flex と leading-none は、アイコンの箱を「アイコン + 余白」ちょうどに
 * 固定するため。付けないと、SVG が行内要素として扱われた場合に
 * ベースライン下の余白ぶん箱が伸び、補正量が環境によってずれる。
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
        className="inline-flex -translate-y-px items-center justify-center rounded-full p-1 leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  )
}
