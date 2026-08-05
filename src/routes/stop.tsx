import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { match } from 'ts-pattern'

import { StopAlarmControl } from '@/components/stop/stop-alarm-control'
import { StopMethodSettings } from '@/components/stop/stop-method-settings'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/stop')({
  component: Stop,
})

type StopView = 'control' | 'methods'

const tabs = [
  { key: 'control', label: 'アラームを止める' },
  { key: 'methods', label: '停止方法' },
] as const satisfies ReadonlyArray<{ key: StopView; label: string }>

/**
 * 「停止」タブ。鳴っているアラームの停止状況と、停止方法（位置情報）の管理を
 * サブタブで切り替える。サブタブはURLに残す必要のない一時的な表示状態なので、
 * ルートを分けずにコンポーネントの state で持つ。
 */
function Stop() {
  const [view, setView] = React.useState<StopView>('control')

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="mb-4 flex shrink-0 gap-1 rounded-xl bg-accent/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => setView(tab.key)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              match(view === tab.key)
                .with(true, () => 'bg-primary text-primary-foreground')
                .with(false, () => 'text-muted-foreground hover:text-foreground')
                .exhaustive(),
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {match(view)
          .with('control', () => <StopAlarmControl />)
          .with('methods', () => <StopMethodSettings />)
          .exhaustive()}
      </div>
    </div>
  )
}
