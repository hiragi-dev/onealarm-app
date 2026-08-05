import { match } from 'ts-pattern'
import { Power } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useDemo } from '@/contexts/demo-context'
import { useRunEffect } from '@/lib/effect-react'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'

type BadgeVariant = 'secondary' | 'warning' | 'success' | 'destructive'

const statusMeta: Record<BrokerStatus, { label: string; variant: BadgeVariant }> = {
  disconnected: { label: '未接続', variant: 'secondary' },
  connecting: { label: '接続中…', variant: 'warning' },
  connected: { label: '接続済み', variant: 'success' },
  error: { label: 'エラー', variant: 'destructive' },
}

const edgeStatusMeta: Record<EdgeDeviceStatus, { label: string; variant: BadgeVariant }> = {
  unknown: { label: 'edge: 確認中', variant: 'secondary' },
  online: { label: 'edge: オンライン', variant: 'success' },
  offline: { label: 'edge: オフライン', variant: 'destructive' },
}

/**
 * 「設定」タブの接続設定。ブローカーの接続先とデバイスID、コマンド送信、ログを扱う。
 * この再構成では実際の通信は行わず、demo-provider のダミー状態を相手にしている。
 */
export function ConnectionSettings() {
  const {
    settings,
    updateSetting,
    status,
    edgeStatus,
    connect,
    disconnect,
    log,
    sendPowerCommand,
  } = useDemo()
  const run = useRunEffect()

  const meta = statusMeta[status]
  const edgeMeta = edgeStatusMeta[edgeStatus]
  const connected = status === 'connected'
  const editable = status === 'disconnected'

  const fields = [
    {
      key: 'brokerUrl' as const,
      label: 'ブローカー URL (WebSocket)',
      placeholder: 'wss://xxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt',
      help: 'HiveMQ Cloud の WebSocket エンドポイント（TLS: 8884, パス /mqtt）',
      type: 'text',
    },
    {
      key: 'deviceId' as const,
      label: 'デバイスID',
      placeholder: 'onealarm-demo-01',
      help: 'エッジデバイス側の DEVICE_ID と一致させてください',
      type: 'text',
    },
    {
      key: 'username' as const,
      label: 'ユーザー名',
      placeholder: '',
      help: '',
      type: 'text',
    },
    {
      key: 'password' as const,
      label: 'パスワード',
      placeholder: '',
      help: '',
      type: 'password',
    },
  ]

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>接続設定</CardTitle>
          <div className="flex gap-1.5">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Badge variant={edgeMeta.variant}>{edgeMeta.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`mqtt-${field.key}`}>{field.label}</Label>
              <Input
                id={`mqtt-${field.key}`}
                type={field.type}
                value={settings[field.key]}
                onChange={(e) => updateSetting(field.key, e.target.value)}
                disabled={!editable}
                placeholder={field.placeholder}
                autoComplete="off"
              />
              {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => void run(connect)}
              disabled={status === 'connecting' || connected || !settings.deviceId || !settings.brokerUrl}
            >
              {status === 'connecting' && <Spinner className="size-4" />}
              {match(status)
                .with('connecting', () => '接続中…')
                .otherwise(() => '接続')}
            </Button>
            <Button variant="outline" onClick={disconnect} disabled={status === 'disconnected'}>
              切断
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>コマンド送信</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            className="flex-1 bg-success text-success-foreground hover:bg-success/90"
            onClick={() => void run(sendPowerCommand('on'))}
            disabled={!connected}
          >
            <Power />
            ON
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => void run(sendPowerCommand('off'))}
            disabled={!connected}
          >
            <Power />
            OFF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ログ</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-65 overflow-auto text-xs leading-relaxed break-all whitespace-pre-wrap text-muted-foreground">
            {match(log)
              .with([], () => '（まだログはありません）')
              .otherwise((entries) => entries.map((e) => `${e.time}  ${e.text}`).join('\n'))}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
