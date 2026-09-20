import { describe, expect, it } from 'vitest'

import { deriveConnectAction, deriveConnectionTones } from '@/lib/connection-view'

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

describe('deriveConnectAction', () => {
  const configured = true

  it('接続先が未設定なら押せない', () => {
    expect(deriveConnectAction({ broker: 'disconnected', edge: 'unknown', configured: false })).toEqual(
      { kind: 'unconfigured' },
    )
  })

  it('未接続なら新規接続、失敗後は繋ぎ直しになる（失敗したままで手詰まりにしない）', () => {
    expect(deriveConnectAction({ broker: 'disconnected', edge: 'unknown', configured })).toEqual({
      kind: 'connect',
    })
    expect(deriveConnectAction({ broker: 'error', edge: 'unknown', configured })).toEqual({
      kind: 'reconnect',
    })
  })

  it('ブローカーに繋がったままエッジが応答しない場合も繋ぎ直せる', () => {
    expect(deriveConnectAction({ broker: 'connected', edge: 'offline', configured })).toEqual({
      kind: 'reconnect',
    })
  })

  it('接続中と、繋がった直後の応答待ちは押せない', () => {
    expect(deriveConnectAction({ broker: 'connecting', edge: 'unknown', configured })).toEqual({
      kind: 'busy',
    })
    expect(deriveConnectAction({ broker: 'connected', edge: 'unknown', configured })).toEqual({
      kind: 'busy',
    })
  })

  it('端まで通っていればすることが無い', () => {
    expect(deriveConnectAction({ broker: 'connected', edge: 'online', configured })).toEqual({
      kind: 'connected',
    })
  })
})
