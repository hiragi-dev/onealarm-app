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
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-white/8 bg-[rgba(20,20,20,0.85)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <ul className="flex h-17">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact }}
                className="flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-white/50 transition-colors [&.active]:text-primary"
              >
                <Icon className="size-5.5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
