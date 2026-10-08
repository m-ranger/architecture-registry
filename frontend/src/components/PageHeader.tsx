import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
}

/** Единый заголовок страницы реестра: название, пояснение и панель действий. */
export default function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className='page-head'>
      <div className='page-head-text'>
        <h1 className='page-title'>{title}</h1>
        {subtitle ? <div className='page-sub'>{subtitle}</div> : null}
      </div>
      {extra ? <div className='page-head-actions'>{extra}</div> : null}
    </div>
  )
}
