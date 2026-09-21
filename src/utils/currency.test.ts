import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatCurrency } from './currency'

test('formatCurrency renders BRL and falls back to em dash when absent', () => {
  assert.match(formatCurrency(1500.5), /^R\$\s*1\.500,50$/)
  assert.equal(formatCurrency(null), '—')
  assert.equal(formatCurrency(undefined), '—')
})
