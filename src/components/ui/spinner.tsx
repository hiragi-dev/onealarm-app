import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/** サイズ既定 16px の読み込みスピナー。size ユーティリティで上書きできる。 */
function Spinner({ className, ...props }: React.ComponentProps<typeof LoaderCircle>) {
  return (
    <LoaderCircle
      role="status"
      aria-label="読み込み中"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
