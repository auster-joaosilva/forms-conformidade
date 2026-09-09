import assert from 'node:assert/strict'
import { test } from 'node:test'

import { matchesAnyPattern, parsePatternList } from '@/utils/pattern'

test('exact match is case and whitespace insensitive', () => {
  assert.equal(matchesAnyPattern('Fiscal', ['fiscal']), true)
  assert.equal(matchesAnyPattern(' Fiscal ', ['Fiscal']), true)
  assert.equal(matchesAnyPattern('Fiscal', ['Fisca']), false)
  assert.equal(matchesAnyPattern('Fiscal', []), false)
})

test('wildcard matches prefix, suffix and middle', () => {
  assert.equal(matchesAnyPattern('authentik Admins', ['authentik *']), true)
  assert.equal(matchesAnyPattern('authentik Read-only', ['authentik *']), true)
  assert.equal(matchesAnyPattern('Fiscal', ['authentik *']), false)
  assert.equal(
    matchesAnyPattern('joao@fornecedor.com.br', ['*@fornecedor.com.br']),
    true,
  )
  assert.equal(
    matchesAnyPattern('joao@austercontabil.com.br', ['*@fornecedor.com.br']),
    false,
  )
  assert.equal(matchesAnyPattern('svc-authentik', ['svc-*']), true)
})

test('a bare wildcard matches everything', () => {
  assert.equal(matchesAnyPattern('qualquer coisa', ['*']), true)
})

test('regex metacharacters in a pattern are literal', () => {
  assert.equal(matchesAnyPattern('a.b', ['a.b']), true)
  assert.equal(matchesAnyPattern('axb', ['a.b']), false)
  assert.equal(matchesAnyPattern('Financeiro (SP)', ['Financeiro (SP)']), true)
  assert.equal(matchesAnyPattern('Financeiro (SP)', ['Financeiro (*)']), true)
})

test('parsePatternList trims and drops empty entries', () => {
  assert.deepEqual(parsePatternList('a, b ,,c,'), ['a', 'b', 'c'])
  assert.deepEqual(parsePatternList(''), [])
  assert.deepEqual(parsePatternList('  '), [])
})
