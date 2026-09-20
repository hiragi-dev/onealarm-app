import { match } from 'ts-pattern'

import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'

/**
 * 接続経路の図に何色を塗るかを、接続状態から一意に導く純粋関数。
 *
 * 図の見た目は案ごとに変えて比較したいが、「どこまで通っているか」の判断自体は
 * 案によって変わってはいけない。判断だけコンポーネントから引き剥がして
 * DOM 無しで固定しておく（`ringing-view.ts` と同じ狙い）。
 */

export type Tone = 'neutral' | 'success' | 'warning' | 'destructive'

export type ConnectionTones = {
  /** アプリ自身。経路が端まで通ったときだけ点灯させる */
  app: Tone
  /** アプリ → ブローカー の区間。ブローカーのノードもこの色に従う */
  brokerLink: Tone
  /** ブローカー → エッジ の区間。エッジのノードもこの色に従う */
  edgeLink: Tone
  /** 接続の途中経過を脈動で示すか */
  brokerPending: boolean
  edgePending: boolean
  /** ブローカー未接続時はエッジの生死を判定できないので、区間ごと薄くする */
  edgeUnreachable: boolean
}

export function deriveConnectionTones(input: {
  broker: BrokerStatus
  edge: EdgeDeviceStatus
}): ConnectionTones {
  const connected = input.broker === 'connected'

  const brokerLink = match(input.broker)
    .with('connected', () => 'success' as const)
    .with('connecting', () => 'warning' as const)
    .with('error', () => 'destructive' as const)
    .with('disconnected', () => 'neutral' as const)
    .exhaustive()

  const edgeLink = match({ connected, edge: input.edge })
    .with({ connected: false }, () => 'neutral' as const)
    .with({ connected: true, edge: 'online' }, () => 'success' as const)
    .with({ connected: true, edge: 'offline' }, () => 'destructive' as const)
    .with({ connected: true, edge: 'unknown' }, () => 'neutral' as const)
    .exhaustive()

  return {
    app: match({ connected, edge: input.edge })
      .with({ connected: true, edge: 'online' }, () => 'success' as const)
      .otherwise(() => 'neutral' as const),
    brokerLink,
    edgeLink,
    brokerPending: input.broker === 'connecting',
    // 接続済みなのに生死が返ってきていない間だけが「確認中」。未接続時は待っていない
    edgePending: connected && input.edge === 'unknown',
    edgeUnreachable: !connected,
  }
}

/**
 * 接続ボタンが今どの操作を担うか。
 *
 * 「繋がっていないから接続」「一度失敗したから接続し直し」「ブローカーには繋がったが
 * エッジが応答しないから繋ぎ直し」を区別する。特に最後は broker が connected のままなので、
 * 「接続済みなら押せない」という素直な条件だと手動で立て直す手段が無くなる。
 * 設定画面のボタンと、アラーム一覧を覆うオーバーレイのボタンが同じ判断を使う。
 */
export type ConnectAction =
  /** 接続先が未設定。押せない */
  | { kind: 'unconfigured' }
  /** 接続処理の途中。押せない */
  | { kind: 'busy' }
  /** 端まで通っている。することが無い */
  | { kind: 'connected' }
  /** まだ繋いでいない。新規に接続する */
  | { kind: 'connect' }
  /** 失敗した、またはエッジが応答しない。切ってから繋ぎ直す */
  | { kind: 'reconnect' }

export function deriveConnectAction(input: {
  broker: BrokerStatus
  edge: EdgeDeviceStatus
  configured: boolean
}): ConnectAction {
  if (!input.configured) return { kind: 'unconfigured' }
  return match(input)
    .with({ broker: 'connecting' }, () => ({ kind: 'busy' }) as const)
    .with({ broker: 'connected', edge: 'online' }, () => ({ kind: 'connected' }) as const)
    // 繋がった直後の unknown は応答待ちであって失敗ではない。ここで繋ぎ直させると
    // 届きかけの全状態を自分で捨てることになる
    .with({ broker: 'connected', edge: 'unknown' }, () => ({ kind: 'busy' }) as const)
    .with({ broker: 'connected', edge: 'offline' }, () => ({ kind: 'reconnect' }) as const)
    .with({ broker: 'error' }, () => ({ kind: 'reconnect' }) as const)
    .with({ broker: 'disconnected' }, () => ({ kind: 'connect' }) as const)
    .exhaustive()
}
