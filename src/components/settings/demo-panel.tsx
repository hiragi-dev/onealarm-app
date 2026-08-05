import { match } from 'ts-pattern'
import { RotateCcw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useDemo, type LocationPermission, type WalkPermission } from '@/contexts/demo-context'
import { formatAlarmTime, formatDaysOfWeek } from '@/lib/alarm'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'

/**
 * ダミーデータでUIを確認するための操作パネル。
 *
 * 本来はブローカーやエッジデバイス、端末の権限ダイアログから受け取る状態を
 * ここから直接動かせるようにして、実機を繋がずに各画面の見え方
 * （未接続・オフライン・鳴動中・権限拒否・応答なし）を再現できるようにしている。
 */
export function DemoPanel() {
  const {
    status,
    setStatus,
    edgeStatus,
    setEdgeStatus,
    locationPermission,
    setLocationPermission,
    walkPermission,
    setWalkPermission,
    isWalking,
    setWalking,
    edgeResponsive,
    setEdgeResponsive,
    alarms,
    ringingStatus,
    startRinging,
    resetDemoData,
  } = useDemo()

  const isRinging = (ringingStatus?.ringingIds ?? []).length > 0

  return (
    <Card className="border-dashed border-warning/40">
      <CardHeader>
        <CardTitle className="text-warning">デモ操作</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="warning">
          <AlertDescription>
            エッジデバイスにもブローカーにも接続していない、UI確認用のビルドです。
            ここから状態を切り替えて各画面の見え方を確認できます。
          </AlertDescription>
        </Alert>

        <div className="space-y-1.5">
          <Label htmlFor="demo-broker">ブローカー接続状態</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as BrokerStatus)}>
            <SelectTrigger id="demo-broker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">connected（接続済み）</SelectItem>
              <SelectItem value="connecting">connecting（接続中）</SelectItem>
              <SelectItem value="disconnected">disconnected（未接続）</SelectItem>
              <SelectItem value="error">error（エラー）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-edge">エッジデバイスの生存状況</Label>
          <Select value={edgeStatus} onValueChange={(v) => setEdgeStatus(v as EdgeDeviceStatus)}>
            <SelectTrigger id="demo-edge">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">online（オンライン）</SelectItem>
              <SelectItem value="offline">offline（オフライン）</SelectItem>
              <SelectItem value="unknown">unknown（確認中）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Label className="flex items-center justify-between gap-3 font-normal">
          <span className="min-w-0">
            <span className="block text-sm">エッジが応答する</span>
            <span className="block text-xs text-muted-foreground">
              切ると反映確認が返らなくなり、タイムアウト時の通知を確認できます
            </span>
          </span>
          <Switch checked={edgeResponsive} onCheckedChange={setEdgeResponsive} />
        </Label>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="demo-location">位置情報の許可</Label>
          <Select
            value={locationPermission}
            onValueChange={(v) => setLocationPermission(v as LocationPermission)}
          >
            <SelectTrigger id="demo-location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="granted">granted（許可済み）</SelectItem>
              <SelectItem value="prompt">prompt（未確認）</SelectItem>
              <SelectItem value="denied">denied（拒否）</SelectItem>
              <SelectItem value="unsupported">unsupported（非対応）</SelectItem>
              <SelectItem value="insecure">insecure（HTTP接続）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-walk">歩行検知の許可</Label>
          <Select
            value={walkPermission}
            onValueChange={(v) => setWalkPermission(v as WalkPermission)}
          >
            <SelectTrigger id="demo-walk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="granted">granted（許可済み）</SelectItem>
              <SelectItem value="prompt">prompt（未確認）</SelectItem>
              <SelectItem value="denied">denied（拒否）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Label className="flex items-center justify-between gap-3 font-normal">
          <span className="text-sm">歩行を検知していることにする</span>
          <Switch checked={isWalking} onCheckedChange={setWalking} />
        </Label>

        <Separator />

        <div className="space-y-2">
          <Label>アラームを鳴らす</Label>
          {match({ isRinging, alarms })
            .with({ isRinging: true }, () => (
              <p className="text-xs text-muted-foreground">
                鳴動中です。「停止」タブから停止地点への到達で止められます。
              </p>
            ))
            .with({ alarms: [] }, () => (
              <p className="text-xs text-muted-foreground">アラームが登録されていません。</p>
            ))
            .otherwise(({ alarms }) => (
              <div className="flex flex-col items-start gap-2">
                {alarms.map((alarm) => (
                  <Button
                    key={alarm.id}
                    variant="outline"
                    size="sm"
                    onClick={() => startRinging(alarm.id)}
                  >
                    {formatAlarmTime(alarm.time)}（{formatDaysOfWeek(alarm.daysOfWeek)}）を鳴らす
                  </Button>
                ))}
              </div>
            ))}
        </div>

        <Separator />

        <Button variant="ghost" onClick={resetDemoData}>
          <RotateCcw />
          ダミーデータを初期状態に戻す
        </Button>
      </CardContent>
    </Card>
  )
}
