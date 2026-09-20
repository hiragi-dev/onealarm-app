import * as React from 'react'

export type VisualViewportRect = {
  /** 見えている範囲の高さ。スマホでキーボードが開くとここだけが縮む */
  readonly height: number
  /** 見えている範囲の上端（レイアウト上の座標） */
  readonly offsetTop: number
}

let cached: VisualViewportRect | null = null

/** 値が変わったときだけ新しいオブジェクトを返す（useSyncExternalStore は同一性で変化を見る） */
function readSnapshot(): VisualViewportRect | null {
  const vv = window.visualViewport
  if (!vv) return null
  const height = Math.round(vv.height)
  const offsetTop = Math.round(vv.offsetTop)
  if (cached && cached.height === height && cached.offsetTop === offsetTop) return cached
  cached = { height, offsetTop }
  return cached
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport
  if (!vv) return () => {}
  vv.addEventListener('resize', onChange)
  vv.addEventListener('scroll', onChange)
  return () => {
    vv.removeEventListener('resize', onChange)
    vv.removeEventListener('scroll', onChange)
  }
}

/**
 * 見えている範囲（visualViewport）の高さと上端。
 *
 * iOS ではキーボードが開いてもレイアウト上の画面は縮まず、見えている範囲だけが縮む。
 * 画面中央に置いたものがキーボードに隠れないようにするには、この範囲の中央に
 * 置き直す必要がある。対応していない環境では null。
 */
export function useVisualViewport(): VisualViewportRect | null {
  return React.useSyncExternalStore(subscribe, readSnapshot, () => null)
}
