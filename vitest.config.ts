import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * テスト専用の設定。vite.config.ts とは分けている。
 *
 * 本体の設定には PWA・ルーター生成・Tailwind のプラグインが並んでいて、
 * どれもテストには不要（かつ Service Worker の生成など副作用がある）ため、
 * ここではエイリアスの解決だけを引き継ぐ。
 *
 * environment は node。テスト対象はエッジデバイスとの通信ロジックと純粋関数で、
 * DOM を必要としないため。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
