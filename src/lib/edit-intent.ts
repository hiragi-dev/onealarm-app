/**
 * キー入力が「値を書き換えようとした操作」かどうかを判定する純粋関数。
 *
 * 編集できない入力欄を叩いたときにだけ理由を伝えたいが、キー入力には
 * 読むだけの操作（Tab での移動、Cmd+C でのコピー、矢印キーでの選択）も混ざる。
 * それらまで拾うと、値を確認しているだけで通知が出てしまう。
 *
 * 判断だけコンポーネントから引き剥がして DOM 無しで固定しておく
 * （`connection-view.ts` と同じ狙い）。
 */

/** KeyboardEvent のうち、判定に使う部分だけ */
export type EditIntentKey = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}

/** 修飾キーと組み合わさったときに値を書き換えるキー（貼り付け・切り取り・取り消し） */
const EDITING_SHORTCUTS = new Set(['v', 'x', 'z', 'y'])

/** 修飾キー無しでも値を消すキー */
const DELETING_KEYS = new Set(['Backspace', 'Delete'])

export function isEditIntent(event: EditIntentKey): boolean {
  // 消す操作は修飾キーの有無を問わない（Alt+Backspace は単語ごと消す）
  if (DELETING_KEYS.has(event.key)) return true

  if (event.metaKey || event.ctrlKey) {
    // Cmd+C / Cmd+A は読むための操作なので拾わない
    return EDITING_SHORTCUTS.has(event.key.toLowerCase())
  }

  // Alt は文字入力の修飾に使われる（Option+a など）ので、ここでは弾かない。
  // 印字される1文字だけを入力とみなし、Tab や矢印のような名前付きキーは除く
  return event.key.length === 1
}
