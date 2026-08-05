import { match } from 'ts-pattern'
import { Footprints } from 'lucide-react'

import { useDemo } from '@/contexts/demo-context'
import { cn } from '@/lib/utils'

/**
 * 鳴動中の歩行検知状況。
 *
 * この表示を見るのは「寝起きに、アラームを鳴らしたまま、歩きながら」という状況で、
 * 端末は腕の長さの先にあり、目は覚めていない。そこで読めることだけを狙って、
 * 文字を2語まで削り、中心から広がるリングと特大のタイポで状態を伝える。
 * 歩数や最終検知時刻といった数値は「設定」タブの歩行検知に置き、ここでは出さない。
 */
export function WalkStatus() {
  const { isWalking } = useDemo()

  return (
    <div
      className={cn(
        'relative flex h-52 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl transition-colors duration-500',
        match(isWalking)
          .with(true, () => 'bg-success/18')
          .with(false, () => 'bg-accent/30')
          .exhaustive(),
      )}
    >
      {/* 歩行中だけ、心拍のように広がるリングを重ねる */}
      {isWalking && (
        <>
          <span className="absolute size-28 animate-ping rounded-full bg-success/25 [animation-duration:1.6s]" />
          <span className="absolute size-44 animate-ping rounded-full bg-success/10 [animation-delay:500ms] [animation-duration:1.6s]" />
        </>
      )}

      <Footprints
        className={cn(
          'relative size-16 transition-all duration-500',
          match(isWalking)
            .with(true, () => 'scale-110 text-success')
            .with(false, () => 'scale-100 text-muted-foreground/35')
            .exhaustive(),
        )}
      />

      <p
        className={cn(
          'relative text-4xl font-bold tracking-tight transition-colors duration-500',
          match(isWalking)
            .with(true, () => 'text-success')
            .with(false, () => 'text-muted-foreground/60')
            .exhaustive(),
        )}
      >
        {match(isWalking)
          .with(true, () => '歩行中')
          .with(false, () => '静止中')
          .exhaustive()}
      </p>
    </div>
  )
}
