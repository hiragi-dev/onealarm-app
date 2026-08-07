import { describe, expect, it } from 'vitest'

import { deriveConnectionTones } from '@/lib/connection-view'

describe('deriveConnectionTones', () => {
  it('未接続ならエッジ側の区間は判定不能として扱う', () => {
    const tones = deriveConnectionTones({ broker: 'disconnected', edge: 'online' })

    // ブローカーに繋がっていない間の edge は前回の残り値でしかないので、
    // online が来ていても success で塗ってはいけない
    expect(tones.edgeLink).toBe('neutral')
    expect(tones.edgeUnreachable).toBe(true)
    expect(tones.edgePending).toBe(false)
    expect(tones.app).toBe('neutral')
  })

  it('端まで通ったときだけアプリのノードが点灯する', () => {
    expect(deriveConnectionTones({ broker: 'connected', edge: 'online' }).app).toBe('success')
    expect(deriveConnectionTones({ broker: 'connected', edge: 'unknown' }).app).toBe('neutral')
    expect(deriveConnectionTones({ broker: 'connected', edge: 'offline' }).app).toBe('neutral')
  })

  it('接続中は脈動、エラーは destructive で示す', () => {
    const connecting = deriveConnectionTones({ broker: 'connecting', edge: 'unknown' })
    expect(connecting.brokerLink).toBe('warning')
    expect(connecting.brokerPending).toBe(true)

    const failed = deriveConnectionTones({ broker: 'error', edge: 'unknown' })
    expect(failed.brokerLink).toBe('destructive')
    expect(failed.brokerPending).toBe(false)
  })

  it('接続済みでエッジの応答待ちの間だけエッジ側が脈動する', () => {
    expect(deriveConnectionTones({ broker: 'connected', edge: 'unknown' }).edgePending).toBe(true)
    expect(deriveConnectionTones({ broker: 'connected', edge: 'online' }).edgePending).toBe(false)
  })

  it('接続済みでエッジから応答がなければ経路の末端だけが赤くなる', () => {
    const tones = deriveConnectionTones({ broker: 'connected', edge: 'offline' })

    expect(tones.brokerLink).toBe('success')
    expect(tones.edgeLink).toBe('destructive')
    expect(tones.edgeUnreachable).toBe(false)
  })
})
