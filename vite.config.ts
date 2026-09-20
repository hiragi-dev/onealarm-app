import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * dev サーバーの HTTPS。certificates/ に自己署名証明書（scripts/renew-cert.sh）があれば使う。
 * スマホ実機の位置情報・加速度センサーはセキュアコンテキストでしか動かないため、
 * 同じ Wi-Fi のスマホから PC の IP で開くには HTTPS が要る。無ければ従来どおり HTTP
 */
function devHttps() {
  const dir = path.resolve(import.meta.dirname, 'certificates')
  const key = path.join(dir, 'localhost-key.pem')
  const cert = path.join(dir, 'localhost.pem')
  if (!fs.existsSync(key) || !fs.existsSync(cert)) return undefined
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

/**
 * 配信先のパス。GitHub Pages のプロジェクトサイトは https://<user>.github.io/<repo>/ の
 * サブパスになるので、deploy.yml が BASE_PATH=/onealarm-app/ を渡す。手元は '/'。
 * 絶対パスで書いた場所（PWA のマニフェスト、Leaflet のマーカー画像、ルーターの basepath）は
 * すべてここから導く
 */
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  server: { https: devHttps() },
  // 本番ビルドの配信（npm run preview）も同じ証明書で HTTPS にする。
  // 開発ツールを含まない状態でスマホから使うための経路
  preview: { https: devHttps(), host: true, port: 4173 },
  plugins: [
    // tanstackRouter must run before the react plugin.
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 登録は SwStatus (useRegisterSW) 側で行うため自動注入は無効化する。
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'OneAlarm',
        short_name: 'OneAlarm',
        description: 'ひとつだけのアラーム',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // フォント（woff2）は precache に含めない。同梱している丸ゴシック体は 1 ウェイトが
        // 約 3MB・127 分割で、全部を初回インストール時に取り込むと重すぎる。
        // 実際に表示した文字ぶんの分割だけが要求されるので、下の runtimeCaching で
        // 取りに行ったものだけを溜める
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /\.woff2?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA fallback so deep links work offline.
        navigateFallback: 'index.html',
      },
      devOptions: {
        // Service worker を dev サーバーでも有効にする（PWA 挙動の確認用）。
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
