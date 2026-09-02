import { describe, expect, it } from 'vitest'

import { isEditIntent, type EditIntentKey } from '@/lib/edit-intent'

function key(k: string, mods: Partial<EditIntentKey> = {}): EditIntentKey {
  return { key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods }
}

describe('isEditIntent', () => {
  it('文字を打つのは編集の試み', () => {
    expect(isEditIntent(key('a'))).toBe(true)
    expect(isEditIntent(key('あ'))).toBe(true)
    expect(isEditIntent(key(' '))).toBe(true)
    expect(isEditIntent(key('/'))).toBe(true)
  })

  it('消すキーは修飾キーの有無を問わず編集の試み', () => {
    expect(isEditIntent(key('Backspace'))).toBe(true)
    expect(isEditIntent(key('Delete'))).toBe(true)
    // Alt+Backspace は単語ごと、Cmd+Backspace は行ごと消す
    expect(isEditIntent(key('Backspace', { altKey: true }))).toBe(true)
    expect(isEditIntent(key('Backspace', { metaKey: true }))).toBe(true)
  })

  it('貼り付け・切り取り・取り消しは編集の試み', () => {
    for (const mod of [{ metaKey: true }, { ctrlKey: true }]) {
      expect(isEditIntent(key('v', mod))).toBe(true)
      expect(isEditIntent(key('x', mod))).toBe(true)
      expect(isEditIntent(key('z', mod))).toBe(true)
    }
    // 大文字（Shift 併用）でも同じ扱いにする
    expect(isEditIntent(key('V', { metaKey: true }))).toBe(true)
  })

  it('読むだけの操作は拾わない', () => {
    // コピー・全選択は値を確認するための操作
    expect(isEditIntent(key('c', { metaKey: true }))).toBe(false)
    expect(isEditIntent(key('a', { metaKey: true }))).toBe(false)
    expect(isEditIntent(key('c', { ctrlKey: true }))).toBe(false)
  })

  it('移動・選択のキーは拾わない', () => {
    for (const k of [
      'Tab',
      'Shift',
      'Control',
      'Meta',
      'Alt',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'CapsLock',
      'F5',
    ]) {
      expect(isEditIntent(key(k)), k).toBe(false)
    }
  })

  it('Option+文字は文字入力なので拾う', () => {
    // macOS の Option+a は「å」を入力する。修飾キー付きでも入力は入力
    expect(isEditIntent(key('å', { altKey: true }))).toBe(true)
  })
})
