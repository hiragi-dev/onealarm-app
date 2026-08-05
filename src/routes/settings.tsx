import { createFileRoute } from '@tanstack/react-router'

import { ConnectionSettings } from '@/components/settings/connection-settings'
import { DemoPanel } from '@/components/settings/demo-panel'
import { LocationSettings } from '@/components/settings/location-settings'
import { WalkSensorSettings } from '@/components/settings/walk-sensor-settings'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4">
      <h1 className="text-3xl font-bold">設定</h1>

      <ConnectionSettings />

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">位置情報</h2>
        <LocationSettings />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">歩行検知</h2>
        <WalkSensorSettings />
      </section>

      <Separator />

      <DemoPanel />
    </div>
  )
}
