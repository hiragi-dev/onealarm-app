import { describe, expect, it } from 'vitest'

import { deriveTabTransition } from '@/lib/tabs'

describe('deriveTabTransition', () => {
  it('右のタブへ移るなら forward、左へ戻るなら back', () => {
    expect(deriveTabTransition('/', '/stop')).toBe('forward')
    expect(deriveTabTransition('/settings', '/stop')).toBe('forward')
    expect(deriveTabTransition('/stop', '/')).toBe('back')
    expect(deriveTabTransition('/', '/settings')).toBe('back')
  })

  it('同じタブ・タブ以外・初回表示は向きを持たない', () => {
    expect(deriveTabTransition('/', '/')).toBeNull()
    expect(deriveTabTransition('/', '/nowhere')).toBeNull()
    expect(deriveTabTransition(undefined, '/')).toBeNull()
  })
})
