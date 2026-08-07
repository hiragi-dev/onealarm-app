import { match } from 'ts-pattern'
import { MapPin, Plus, Trash2 } from 'lucide-react'

import { InfoPopover } from '@/components/common/info-popover'
import { StaticMapPreview } from '@/components/map/static-map-preview'
import { StopMethodDialogs } from '@/components/stop/stop-method-dialogs'
import { useStopMethodEditing } from '@/components/stop/use-stop-method-editing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * 「停止」タブの停止方法の一覧。位置情報ベースの停止地点を登録・編集・削除する。
 *
 * 1件を1枚のカードにして、地図のプレビューを横いっぱいに置いている。
 * 名前だけの一覧だと「会社」がどの入口を指していたか思い出せず、
 * 結局1件ずつ地図を開いて確かめることになるため、駅名や通りが読める大きさを優先した。
 * プレビューは触れない（StaticMapPreview）ので、動かして確かめたいときは
 * カードをタップして全画面の地図を開く。
 *
 * 保存できるかどうかの判定は validateStopMethodForm（Schema）に任せ、
 * 「使用中だから消せない」「鳴動中だから変えられない」は demo-provider が
 * Effect のエラーとして返す。ここでは成否に応じて画面を閉じるだけにしている。
 */
export function StopMethodSettings() {
  const editing = useStopMethodEditing()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* 見出しに「（位置情報）」のような但し書きを足さない。
              説明は情報ボタンへ寄せ、見出しは名前だけにしておく */}
          <h2 className="text-lg font-semibold">停止方法</h2>
          <InfoPopover>
            アラームを止めるために移動する地点です。地図上の地点と、到達とみなす半径で決めます。
            「アラーム」タブでアラームごとに1つ割り当て、鳴っている間にその地点まで移動すると
            自動的に停止します。
          </InfoPopover>
        </div>
        <Button onClick={editing.openAdd}>
          <Plus />
          追加
        </Button>
      </div>

      {match(editing.rows)
        .with([], () => (
          <div className="flex flex-col items-center gap-2 py-10">
            <MapPin className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">まだ停止方法が登録されていません</p>
            <p className="text-xs text-muted-foreground/60">
              「追加」から地図で地点を選んで登録できます
            </p>
          </div>
        ))
        .otherwise((rows) => (
          <>
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.method.id}
                  className="overflow-hidden rounded-2xl border border-white/8 bg-white/4"
                >
                  <button
                    type="button"
                    onClick={() => editing.openView(row.method.id)}
                    aria-label={`${row.method.label} を地図で確認`}
                    className="block w-full text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <StaticMapPreview
                      point={row.method}
                      radiusMeters={row.method.radiusMeters}
                      className="h-28 w-full border-b border-white/8"
                    />
                  </button>

                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => editing.openView(row.method.id)}
                      className="min-w-0 flex-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{row.method.label}</span>
                        {row.inUse && (
                          <Badge variant="outline" className="shrink-0 border-white/15">
                            使用中
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        到達判定 半径{row.method.radiusMeters}m
                      </span>
                    </button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${row.method.label} を削除`}
                      title={match(row.inUse)
                        .with(true, () => 'いずれかのアラームで使用中のため削除できません')
                        .with(false, () => undefined)
                        .exhaustive()}
                      disabled={row.inUse}
                      onClick={() => void editing.remove(row.method.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground/60">
                カードをタップすると地図で確認・編集できます
              </p>
              {/* プレビューはタイル画像を直に読んでいて Leaflet の出典表示が付かないので、
                  ここで出す */}
              <p className="text-[0.65rem] text-muted-foreground/40">
                地図データ © OpenStreetMap contributors
              </p>
            </div>
          </>
        ))}

      <StopMethodDialogs editing={editing} />
    </div>
  )
}
