import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { deriveTabTransition } from '@/lib/tabs'
import './index.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // タブ切り替えを View Transitions で動かす。向き（forward / back）を type として渡し、
  // index.css がそれを見てページを左右どちらに流すか決める。
  // タブ間の移動でなければ false を返してアニメーションしない
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) => {
      const direction = deriveTabTransition(fromLocation?.pathname, toLocation.pathname)
      return direction === null ? false : [direction]
    },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root が見つかりません')

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
