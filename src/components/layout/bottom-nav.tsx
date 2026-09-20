import { Link } from '@tanstack/react-router'
import { AlarmClock, CircleStop, Settings, type LucideIcon } from 'lucide-react'

import { TABS, type TabPath } from '@/lib/tabs'

/** 並び順と文言は lib/tabs.ts が持つ（画面遷移の向きと揃えるため）。ここはアイコンだけ足す */
const icons: Record<TabPath, LucideIcon> = {
  '/settings': Settings,
  '/': AlarmClock,
  '/stop': CircleStop,
}

/** 画面下部に固定される3タブのナビゲーション。 */
export function BottomNav() {
  return (
    // タブ切り替えの View Transition では、動かすページ（main）側に名前を付け、ナビには付けない。
    // 名前を付けると WebKit で独立した描画層になり、中の backdrop-blur が背後の画面を
    // 拾えなくなって不透明に見える（iPhone で再現）。名前が無ければルートの一部として
    // 据え置かれ、ルートの交差フェードは index.css で切ってあるので動きもしない
    <nav className="sticky bottom-0 z-30 px-4 pb-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-full border border-white/8 bg-[rgba(16,18,24,0.85)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <ul className="flex h-17">
          {TABS.map(({ to, label, exact }) => {
            const Icon = icons[to]
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className="group flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold text-muted-foreground transition-colors [&.active]:text-primary"
                >
                  {/* 選択中は文字色だけでなくアイコンの後ろに青い錠剤を敷く。
                      青が「選ばれている」の意味だと、ここで最初に覚えてもらう */}
                  <span className="flex h-7 w-12 items-center justify-center rounded-full transition-colors group-[.active]:bg-primary/15">
                    <Icon className="size-5.5" />
                  </span>
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
