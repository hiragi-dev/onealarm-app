import * as React from 'react'

/**
 * iOS（特にホーム画面に追加した PWA）で、入力欄にキーボードを出して閉じた後に
 * ページのスクロール位置が戻らず、fixed の要素（下部ナビ・全画面ダイアログ）ごと
 * 上へずれて画面の下に空白が残る、という挙動への守り。画面は持たない。
 *
 * ページ自体は index.css で overflow: hidden にしてあるが、iOS はそれでも
 * 入力欄を見せるためにページを持ち上げ、戻し忘れることがある。
 * 入力を抜けたとき、そしてキーボードの開閉で visualViewport の大きさが変わったときに
 * 先頭へ戻す。ずれていなければ scrollTo(0, 0) は何もしない。
 */
export function ViewportGuard() {
  React.useEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    // blur の直後はまだキーボードが閉じきっていないことがあるので、少し待ってからも戻す
    const onFocusOut = () => {
      reset()
      setTimeout(reset, 300)
    }
    const viewport = window.visualViewport
    document.addEventListener('focusout', onFocusOut)
    viewport?.addEventListener('resize', reset)
    return () => {
      document.removeEventListener('focusout', onFocusOut)
      viewport?.removeEventListener('resize', reset)
    }
  }, [])

  return null
}
