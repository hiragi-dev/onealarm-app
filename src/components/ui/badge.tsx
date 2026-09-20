import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * 状態を示すチップ。「今どうなっているか」を地の文に混ぜず、色付きの丸いチップで出す。
 *
 * neutral / success / warning / destructive は lib/connection-view.ts の Tone と
 * 同じ名前にしてあり、<Badge variant={tone}> とそのまま渡せる。
 * info はキーカラー（青）の状態色。「選ばれている・割り当てられている」など、
 * 良し悪しではない事実を示すのに使う。
 * 枠線は持たない。文字が太く角が丸い前提だと、薄い枠線は輪郭をぼかすだけになる。
 */
const badgeVariants = cva(
  'inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-bold whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-muted-foreground',
        neutral: 'bg-white/8 text-muted-foreground',
        info: 'bg-primary/20 text-primary',
        success: 'bg-success/20 text-success',
        warning: 'bg-warning/20 text-warning',
        destructive: 'bg-destructive/20 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
