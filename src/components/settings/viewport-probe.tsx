import * as React from 'react'

/**
 * 実機で表示領域の数値を読むための開発ツール（dev 専用）。
 * セーフエリアや画面のずれは手元のブラウザでは再現できず、iPhone のホーム画面から
 * 開いた PWA でしか起きないので、そこで読める形にしておく。
 * env() は JS から直接読めないため、padding に env() を当てた要素の computed style から取る。
 */
export function ViewportProbe() {
  const probeRef = React.useRef<HTMLDivElement | null>(null)
  const [values, setValues] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    const read = () => {
      const probe = probeRef.current
      const style = probe ? getComputedStyle(probe) : null
      const vv = window.visualViewport
      setValues({
        'inner (w×h)': `${window.innerWidth}×${window.innerHeight}`,
        'visualViewport (h / offsetTop)': vv ? `${Math.round(vv.height)} / ${Math.round(vv.offsetTop)}` : '-',
        'scrollY / body.scrollTop': `${window.scrollY} / ${document.body.scrollTop}`,
        'safe-area top / bottom': style ? `${style.paddingTop} / ${style.paddingBottom}` : '-',
        standalone: String(window.matchMedia('(display-mode: standalone)').matches),
        'html / body height': `${document.documentElement.clientHeight} / ${document.body.clientHeight}`,
      })
    }
    read()
    const id = setInterval(read, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      <div
        ref={probeRef}
        aria-hidden
        className="pointer-events-none absolute size-0 opacity-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      />
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-3">
          <span>{key}</span>
          <span className="font-mono">{value}</span>
        </div>
      ))}
    </div>
  )
}
