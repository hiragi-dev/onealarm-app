import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { match } from 'ts-pattern'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * 全画面ダイアログの出方。ネイティブアプリの2つの型に合わせる。
 * - sheet: 下から上がってくる。閉じるボタンが右上にある「一時的な作業」（追加・地点選び）
 * - push: 右から入ってくる。戻る矢印が左上にある「一段深い画面」（編集）
 * 全画面でないダイアログは中央で拡大するだけ（従来どおり）。
 */
export type FullScreenMotion = 'sheet' | 'push'

function DialogContent({
  className,
  children,
  showCloseButton = true,
  fullScreen = false,
  motion = 'sheet',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** 地図など画面いっぱいに使いたいダイアログ向け。角丸・余白を持たない全画面表示にする。 */
  fullScreen?: boolean
  /** fullScreen のときの出方。省略時はシート */
  motion?: FullScreenMotion
}) {
  // 全画面は 100% ぶん滑らせるので、フェードを重ねると動いている間だけ半透明になって
  // 軽く見える。滑るだけにし、フェードは中央ダイアログにだけ付ける
  const motionClass = match({ fullScreen, motion })
    .with({ fullScreen: false }, () =>
      'top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl p-6 duration-200 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
    )
    // 全画面は body の外（ポータル）に fixed で描かれ、body に付けたセーフエリアの余白が効かない。
    // ステータスバーの下に見出しが潜らないよう、自分で上端の余白を持つ。下端は各画面の
    // 最下段（フッター・ボタン列）が max(…, env(safe-area-inset-bottom)) で持つ
    .with({ fullScreen: true, motion: 'sheet' }, () =>
      'inset-0 h-full w-full pt-[env(safe-area-inset-top)] duration-300 ease-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    )
    .with({ fullScreen: true, motion: 'push' }, () =>
      'inset-0 h-full w-full pt-[env(safe-area-inset-top)] duration-300 ease-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    )
    .exhaustive()

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed z-50 flex flex-col border border-border bg-popover text-popover-foreground shadow-2xl data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none',
          motionClass,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              'absolute right-4 rounded-full p-1.5 text-muted-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none',
              // 全画面は上端にセーフエリアの余白を持つが、absolute のこのボタンはそれを見ないので自分で足す
              match(fullScreen)
                .with(true, () => 'top-[calc(1rem+env(safe-area-inset-top))]')
                .with(false, () => 'top-4')
                .exhaustive(),
            )}
          >
            <X className="size-4" />
            <span className="sr-only">閉じる</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 text-center', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base leading-none font-extrabold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
