import { createFileRoute } from '@tanstack/react-router'

import { StopMethodSettings } from '@/components/stop/stop-method-settings'

export const Route = createFileRoute('/stop')({
  component: Stop,
})

/**
 * 「停止」タブ。停止方法（位置情報）の管理を行う。
 *
 * 鳴動中の「アラームを止める」表示は、実際に鳴っているときにしか使わないため
 * このタブには置かず、鳴り始めた瞬間に画面全体を覆う RingingTakeover が担う
 * （__root.tsx で常駐）。そのためここは平常時の設定操作だけに専念する。
 */
function Stop() {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <StopMethodSettings />
      </div>
    </div>
  )
}
