import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatDate, parseDateInput, toDateInput } from '@/utils/date'

test('date input survives a round trip in America/Sao_Paulo', () => {
  process.env.TZ = 'America/Sao_Paulo'
  for (const value of ['2026-01-01', '2026-03-31', '2026-12-31']) {
    assert.equal(toDateInput(parseDateInput(value)), value)
  }
})

test('date input survives a round trip east of UTC', () => {
  process.env.TZ = 'Asia/Tokyo'
  assert.equal(toDateInput(parseDateInput('2026-06-15')), '2026-06-15')
})

test('formatDate renders dd/mm/yyyy and handles empty values', () => {
  assert.equal(formatDate(parseDateInput('2026-09-09')), '09/09/2026')
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate(undefined), '—')
})
