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
