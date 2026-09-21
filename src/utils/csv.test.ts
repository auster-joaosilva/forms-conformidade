import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toCsv } from './csv'

test('toCsv quotes fields containing commas, quotes or newlines', () => {
  const csv = toCsv([
    ['Número', 'Descrição'],
    ['001/2026', 'Vazamento, causou "atraso"\nna entrega'],
  ])

  assert.equal(
    csv,
    'Número,Descrição\r\n001/2026,"Vazamento, causou ""atraso""\nna entrega"',
  )
})
