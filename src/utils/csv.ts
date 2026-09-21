function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: Array<Array<string>>): string {
  return rows
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\r\n')
}
