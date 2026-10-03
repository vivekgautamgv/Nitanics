import type { ReactNode } from 'react'

interface ContentAreaProps {
  children: ReactNode
  fullBleed?: boolean
}

export default function ContentArea({ children, fullBleed = false }: ContentAreaProps) {
  return (
    <div className={`content-area ${fullBleed ? 'content-area-bleed' : ''}`}>
      {children}
    </div>
  )
}
