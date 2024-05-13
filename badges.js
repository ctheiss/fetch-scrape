#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises'
import { makeBadge } from 'badge-maker'

console.log('\nGenerating badges:')

console.log('  tests')
const tests = JSON.parse(await readFile('build/tests/mochawesome.json', 'utf8'))
await writeFile('build/tests.svg', makeBadge({
  label: 'tests',
  message: `${tests.stats.passes}/${tests.stats.tests} passing`,
  color: tests.stats.failures === 0 ? 'success' : 'critical'
}))

console.log('  coverage')
const coverage = JSON.parse(await readFile('build/coverage/coverage-summary.json', 'utf8'))
await writeFile('build/coverage.svg', makeBadge({
  label: 'coverage',
  message: `${coverage.total.statements.pct}%`,
  color: coverage.total.statements.pct === 100 ? 'success' : 'critical'
}))

console.log('  code style')
await writeFile('build/style.svg', makeBadge({
  label: 'code style',
  message: 'standard',
  color: 'informational'
}))

console.log('  node requirement')
await writeFile('build/node.svg', makeBadge({
  label: 'node',
  message: '≥ 18.0.0',
  color: 'informational'
}))

console.log()
