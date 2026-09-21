import { match } from 'ts-pattern'
import { AlarmClock, MapPin, Plus, Trash2 } from 'lucide-react'

import { InfoPopover } from '@/components/common/info-popover'
import { TabHeader } from '@/components/layout/tab-header'
import { StaticMapPreview } from '@/components/map/static-map-preview'
import { MAP_ATTRIBUTION_TEXT } from '@/components/map/tile-source'
import { StopMethodDialogs } from '@/components/stop/stop-method-dialogs'
import { useStopMethodEditing } from '@/components/stop/use-stop-method-editing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAlarmTime } from '@/lib/alarm'

/**
 * 「停止」タブの停止方法の一覧。位置情報ベースの停止地点を登録・編集・削除する。
 *
 * 1件は「正方形の地図サムネイル + 文字」の行で、カードには囲わず区切り線で並べる
 * （カードをやめた接続設定と同じ作り）。地図を大きく出す案・グリッドに並べる案とも
 * 比較したうえで、地図は「どの場所だったか」を思い出す手がかりに徹しさせ、
 * 空いた幅で「どのアラームがこの地点で止まるのか（時刻）」を出すこの案を採った。
 * 名前だけの一覧だと地図を1件ずつ開いて確かめることになるので、サムネイルでも
 * 実際の地図を出す前提は変えていない。
 * プレビューは触れない（StaticMapPreview）ので、動かして確かめたいときは
 * 行をタップして全画面の地図を開く。
 *
 * 保存できるかどうかの判定は validateStopMethodForm（Schema）に任せ、
 * 「使用中だから消せない」「鳴動中だから変えられない」は demo-provider が
 * Effect のエラーとして返す。ここでは成否に応じて画面を閉じるだけにしている。
 */
export function StopMethodSettings() {
  const editing = useStopMethodEditing()

  return (
    <div className="space-y-4">
      <TabHeader
        title="停止方法"
        titleExtra={
          // 見出しに「（位置情報）」のような但し書きを足さない。
          // 説明は情報ボタンへ寄せ、見出しは名前だけにしておく
          <InfoPopover>
            アラームを止めるために移動する地点です。地図上の地点と、到達とみなす半径で決めます。
            「アラーム」タブでアラームごとに1つ割り当て、鳴っている間にその地点まで移動すると
            自動的に停止します。
          </InfoPopover>
        }
        action={
          <Button onClick={editing.openAdd}>
            <Plus />
            追加
          </Button>
        }
      />

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
            <ul className="divide-y divide-white/8">
              {rows.map((row) => (
                <li key={row.method.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => editing.openView(row.method.id)}
                    aria-label={`${row.method.label} を地図で確認`}
                    className="shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <StaticMapPreview
                      point={row.method}
                      radiusMeters={row.method.radiusMeters}
                      className="size-20 rounded-2xl border border-white/8"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => editing.openView(row.method.id)}
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="block truncate">{row.method.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      到達判定 半径{row.method.radiusMeters}m
                    </span>
                    {/* 「使用中」の1チップではなく、使っているアラームの時刻を1つずつチップにする。
                        消してよいかを判断するには、使われている事実よりどのアラームかが要る */}
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {match(row.usedBy)
                        .with([], () => <Badge variant="neutral">未使用</Badge>)
                        .otherwise((usedBy) =>
                          usedBy.map((a) => (
                            <Badge key={a.id} variant="info">
                              <AlarmClock />
                              {formatAlarmTime(a.time)}
                            </Badge>
                          )),
                        )}
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
                </li>
              ))}
            </ul>

            {/* プレビューは撮った画像を出すだけで地図側の帰属表示が付かないので、ここで出す */}
            <p className="text-[0.65rem] text-muted-foreground/40">{MAP_ATTRIBUTION_TEXT}</p>
          </>
        ))}

      <StopMethodDialogs editing={editing} />
    </div>
  )
}
