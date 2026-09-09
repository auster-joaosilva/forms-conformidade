function toRegExp(pattern: string) {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

// ponytail: glob de um nível (só `*`), suficiente para nomes de grupo e e-mail.
export function matchesAnyPattern(
  value: string,
  patterns: Array<string>,
): boolean {
  const target = value.trim().toLowerCase()
  return patterns.some((pattern) => {
    const normalized = pattern.trim().toLowerCase()
    if (!normalized) return false
    if (!normalized.includes('*')) return normalized === target
    return toRegExp(normalized).test(target)
  })
}

export function parsePatternList(value: string): Array<string> {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
