import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { ReactNode } from 'react'

export function FormSection({
  number,
  title,
  hint,
  children,
}: {
  number?: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <header>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          {number ? `${number}. ` : ''}
          {title}
        </h2>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
