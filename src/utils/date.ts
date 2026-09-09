export function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`)
}

export function toDateInput(value: Date | string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

export function formatDate(value: Date | string | null | undefined): string {
  const isoDate = toDateInput(value)
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
