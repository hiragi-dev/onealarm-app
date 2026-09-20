import { Link } from '@tanstack/react-router'
import { AlarmClock, CircleStop, Settings } from 'lucide-react'

const items = [
  { to: '/settings', label: '設定', icon: Settings, exact: false },
  { to: '/', label: 'アラーム', icon: AlarmClock, exact: true },
  { to: '/stop', label: '停止', icon: CircleStop, exact: false },
] as const

/** 画面下部に固定される3タブのナビゲーション。 */
export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 px-4 pb-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-full border border-white/8 bg-[rgba(16,18,24,0.85)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <ul className="flex h-17">
          {items.map(({ to, label, icon: Icon, exact }) => (
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
          ))}
        </ul>
      </div>
    </nav>
  )
}
