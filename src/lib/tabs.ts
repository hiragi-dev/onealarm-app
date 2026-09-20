/**
 * 下部ナビの3タブと、タブ間を移動したときの画面遷移の向き。
 *
 * 並び順は下部ナビの見た目そのもの。左のタブへ移るなら画面は右へ流れ（back）、
 * 右のタブへ移るなら左へ流れる（forward）。ネイティブアプリのタブ切り替えと同じで、
 * 向きが並びと一致していないと「どこへ移ったか」が体で分からない。
 * 判断だけをここに置き、CSS（index.css の View Transitions）と下部ナビが同じ並びを見る。
 */

export const TABS = [
  { to: '/settings', label: '設定', exact: false },
  { to: '/', label: 'アラーム', exact: true },
  { to: '/stop', label: '停止', exact: false },
] as const

export type TabPath = (typeof TABS)[number]['to']

export type TabTransition = 'forward' | 'back'

function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => (tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)))
}

/**
 * タブ間の移動なら向きを返す。どちらかがタブでなければ null（遷移アニメーションを付けない）。
 * 同じタブ内の移動（同じ pathname）も null。
 */
export function deriveTabTransition(from: string | undefined, to: string): TabTransition | null {
  if (from === undefined) return null
  const fromIndex = tabIndex(from)
  const toIndex = tabIndex(to)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null
  return toIndex > fromIndex ? 'forward' : 'back'
}
