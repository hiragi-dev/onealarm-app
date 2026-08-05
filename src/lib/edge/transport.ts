import type { Effect, Queue } from 'effect'

import type { BrokerUnreachableError } from '@/lib/errors'

/**
 * エッジデバイスとの通信路（ポート）。
 *
 * 本番では MQTT over WebSocket、テストでは fake-transport.ts の実装が入る。
 * ここに現れるのは「繋ぐ・切る・購読する・送る・受け取る」だけで、
 * QoS・clientId・retain・再接続間隔といった MQTT 固有の設定は実装側の内側に閉じる。
 * DECISION.md の通り QoS は 2 固定・セッション永続なしで運用するため、
 * 呼び出し側が選ぶ余地を作らない。
 *
 * 接続の切れ目は connect/disconnect の戻り値ではなく events に流す。
 * MQTT クライアントは自動再接続でアプリの与り知らぬところで繋ぎ直すので、
 * 「誰が繋いだか」に関係なく接続イベントを一本の流れで扱えるようにするため。
 */

export type TransportEvent =
  | { readonly kind: 'connected' }
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'message'; readonly topic: string; readonly payload: string }

export type EdgeTransport = {
  /** 接続イベントと受信メッセージ。購読者は EdgeClient の常駐ループ1つだけ */
  readonly events: Queue.Dequeue<TransportEvent>
  readonly connect: Effect.Effect<void, BrokerUnreachableError>
  readonly disconnect: Effect.Effect<void>
  /**
   * 購読。切断で失われるので、接続のたびに呼び直す必要がある。
   * これは実装の都合ではなく前提で、ブローカーに購読を覚えさせない
   * （= clean session）方針を型ではなく運用で守る箇所。
   */
  readonly subscribe: (topic: string) => Effect.Effect<void>
  /** 未接続のときは黙って捨てられる。送信待ちのキューは持たない */
  readonly publish: (topic: string, payload: string) => Effect.Effect<void>
}
