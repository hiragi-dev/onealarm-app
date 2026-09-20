import { Effect, Queue, type Scope } from 'effect'
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt'

import { BrokerUnreachableError } from '@/lib/errors'
import type { EdgeTransport, TransportEvent } from '@/lib/edge/transport'

/**
 * 本番の通信路。MQTT over WebSocket（mqtt.js）で transport.ts のポートを埋める。
 *
 * DECISION.md の方針どおり、QoS 2 固定・clean session・retain 無し。
 * これらはここで決め打ちにして上の層に選ばせない。
 *
 * 1 つの transport は「接続の試行 1 回と、その後の自動再接続」を担う。
 * 最初の試行に失敗したらクライアントを畳んで失敗を返し、再試行は
 * 呼び出し側（AppProvider）が transport を作り直して行う。最初から
 * 裏で再試行し続けると、「失敗した」と伝えた後に勝手に繋がって
 * 表示と食い違うため。繋がった後の切断は mqtt.js の自動再接続に任せ、
 * 接続イベントは events に流すだけにする（EdgeClient が購読と全状態取得をやり直す）。
 */

export type MqttTransportOptions = {
  readonly brokerUrl: string
  readonly username: string
  readonly password: string
}

/** 最初の接続試行を待つ上限 */
const CONNECT_TIMEOUT_MS = 10_000
/** 繋がった後に切れたときの再接続間隔 */
const RECONNECT_MS = 3_000
const KEEPALIVE_SEC = 30

/**
 * CONNACK の拒否理由のうち認証に関するもの。
 * MQTT 3.1.1: 4 = bad user name or password, 5 = not authorized。
 * MQTT 5: 0x86 (134) = bad user name or password, 0x87 (135) = not authorized。
 */
const AUTH_ERROR_CODES = new Set([4, 5, 134, 135])

function isAuthError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return typeof code === 'number' && AUTH_ERROR_CODES.has(code)
}

/** 接続のたびに変える。同じ clientId で二重に繋ぐとブローカーが古いほうを切る */
function randomClientId(): string {
  return `onealarm-app-${Math.random().toString(36).slice(2, 10)}`
}

export function makeMqttTransport(
  options: MqttTransportOptions,
): Effect.Effect<EdgeTransport, never, Scope.Scope> {
  return Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Queue.unbounded<TransportEvent>(), Queue.shutdown)

    const clientOptions: IClientOptions = {
      manualConnect: true,
      clean: true,
      clientId: randomClientId(),
      username: options.username || undefined,
      password: options.password || undefined,
      keepalive: KEEPALIVE_SEC,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectPeriod: RECONNECT_MS,
    }
    const client: MqttClient = mqtt.connect(options.brokerUrl, clientOptions)

    // 「繋がっている」を自分でも持つ。mqtt.js の close は最初の失敗でも
    // 再接続の途中でも鳴るので、繋がっていた時だけ disconnected を流すため
    let connected = false
    const offer = (event: TransportEvent) => {
      Queue.unsafeOffer(events, event)
    }

    client.on('connect', () => {
      connected = true
      offer({ kind: 'connected' })
    })
    client.on('close', () => {
      if (!connected) return
      connected = false
      offer({ kind: 'disconnected' })
    })
    client.on('message', (topic, payload) => {
      offer({ kind: 'message', topic, payload: payload.toString() })
    })
    // 最初の試行の失敗は connect が拾う。それ以外（再接続中の失敗）は
    // mqtt.js が再試行するので、ここでは握って落とさないだけ
    client.on('error', () => {})

    const end = Effect.async<void>((resume) => {
      client.end(true, {}, () => resume(Effect.void))
    })
    yield* Effect.addFinalizer(() => end)

    const connect = Effect.async<void, BrokerUnreachableError>((resume) => {
      const cleanup = () => {
        client.off('connect', onConnect)
        client.off('error', onError)
        client.off('close', onClose)
      }
      const fail = (reason: 'network' | 'auth') => {
        cleanup()
        // 畳んでおかないと、失敗を伝えた後も裏で再試行して勝手に繋がる
        client.end(true)
        resume(Effect.fail(new BrokerUnreachableError({ reason })))
      }
      const onConnect = () => {
        cleanup()
        resume(Effect.void)
      }
      const onError = (error: Error) => fail(isAuthError(error) ? 'auth' : 'network')
      const onClose = () => fail('network')

      client.on('connect', onConnect)
      client.on('error', onError)
      client.on('close', onClose)
      client.connect()

      return Effect.sync(cleanup)
    })

    const transport: EdgeTransport = {
      events,
      connect,
      disconnect: end,
      subscribe: (topic) =>
        Effect.async<void>((resume) => {
          // 未接続なら何もしない。購読は接続のたびに張り直す前提（transport.ts）
          if (!client.connected) return resume(Effect.void)
          client.subscribe(topic, { qos: 2 }, () => resume(Effect.void))
        }),
      publish: (topic, payload) =>
        Effect.sync(() => {
          // mqtt.js は未接続の QoS>0 publish を溜めて再接続後に送るが、
          // ポートの前提は「未接続なら捨てる」なので、ここで止める
          if (!client.connected) return
          client.publish(topic, payload, { qos: 2 })
        }),
    }

    return transport
  })
}
