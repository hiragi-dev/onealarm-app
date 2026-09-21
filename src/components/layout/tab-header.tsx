import type * as React from 'react'

/**
 * 各タブ左上の見出し。文字サイズ（text-3xl font-extrabold）は揃えていたが、
 * 右に置くボタンの高さがタブごとに違い（アラーム: icon-lg=44px、停止方法: 既定=40px、
 * 設定: ボタン無し）、items-center がその高さに引きずられて見出しの縦位置がずれていた。
 * 行の高さを固定（h-11 = 一番大きいボタンと同じ）にして、ボタンの有無・大きさに関係なく
 * 見出しが常に同じオフセットで沈むようにする。3タブとも必ずこれを通す。
 */
export function TabHeader({
  title,
  titleExtra,
  action,
}: {
  title: string
  /** 見出しの右隣に置く小さな要素（InfoPopover など）。見出しと同じ行・同じ高さの基準で揃う */
  titleExtra?: React.ReactNode
  /** 行の右端に置くボタンなど */
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-11 items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {titleExtra}
      </div>
      {action}
    </div>
  )
}
