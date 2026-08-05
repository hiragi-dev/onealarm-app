/**
 * ブローカーへの接続状況・エッジデバイスの生存状況から
 * 「今アラーム関連の操作（追加/編集/削除/停止方法の割り当て）を行ってよいか」を
 * 一意に導出するための代数的データ型（discriminated union）と導出関数。
 *
 * ブローカー接続とエッジデバイスの生存は別物として扱う。ブローカーに繋がっていても
 * デバイス自体が電源offやフリーズで応答しないことがあるため。
 */

/** ブローカーへの接続状態 */
export type BrokerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** エッジデバイス自体の生存状況（ブローカー未接続の間は判定できないので unknown） */
export type EdgeDeviceStatus = 'unknown' | 'online' | 'offline'

export type BrokerConnection = { kind: BrokerStatus }

export function brokerConnectionFromStatus(status: BrokerStatus): BrokerConnection {
  return { kind: status }
}

/** UIで表示するブロック理由 */
export type BlockReason = { kind: 'broker-not-connected' } | { kind: 'edge-offline' }

export function blockReasonLabel(reason: BlockReason): string {
  switch (reason.kind) {
    case 'broker-not-connected':
      return 'ブローカーに接続していません'
    case 'edge-offline':
      return 'エッジデバイスがオフラインです'
  }
}

/** アラーム関連の操作が行えるかどうか */
export type AlarmManagementReadiness =
  | { kind: 'ready' }
  | { kind: 'blocked'; reasons: BlockReason[] }

export function deriveAlarmManagementReadiness(
  broker: BrokerConnection,
  edge: EdgeDeviceStatus,
): AlarmManagementReadiness {
  const reasons: BlockReason[] = []
  if (broker.kind !== 'connected') {
    reasons.push({ kind: 'broker-not-connected' })
  } else if (edge !== 'online') {
    reasons.push({ kind: 'edge-offline' })
  }
  return reasons.length > 0 ? { kind: 'blocked', reasons } : { kind: 'ready' }
}
