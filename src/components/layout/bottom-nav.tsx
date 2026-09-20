import { Link } from '@tanstack/react-router'
import { AlarmClock, CircleStop, Settings, type LucideIcon } from 'lucide-react'

import { TABS, type TabPath } from '@/lib/tabs'

/** 並び順と文言は lib/tabs.ts が持つ（画面遷移の向きと揃えるため）。ここはアイコンだけ足す */
const icons: Record<TabPath, LucideIcon> = {
  '/settings': Settings,
  '/': AlarmClock,
  '/stop': CircleStop,
}

/**
 * 画面下部に浮かぶ3タブのナビゲーション。
 *
 * fixed で内容の上に浮かせ、各タブのスクロール領域はこの下まで伸ばす（内側に
 * --bottom-nav-space ぶんの余白を取る）。独立した行に置くと背後が黒い背景だけになり、
 * 半透明にもぼかしにも意味が無くなる。内容がこの下を通ることで初めて透けて見える。
 *
 * タブ切り替えの View Transition では、動かすページ（main）側に名前を付け、ナビには付けない。
 * 名前を付けると WebKit で独立した描画層になり、中の backdrop-blur が背後の画面を
 * 拾えなくなる。名前が無ければルートの一部として据え置かれ、ルートの交差フェードは
 * index.css で切ってあるので動きもしない。
 */
export function BottomNav() {
  return (
    // 外側は当たり判定を持たない。錠剤の左右の余白で下の内容を触れなくしないため
    // 錠剤はセーフエリア（ホームインジケータ）の直上に置く。ブラウザのタブ（セーフエリア 0）では
    // 16px を下限にする。index.css の --bottom-nav-space と同じ式
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto max-w-md overflow-hidden rounded-full border border-white/8 bg-[rgba(16,18,24,0.7)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
