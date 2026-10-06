import test from 'node:test'
import assert from 'node:assert/strict'
import { yearsOf, forYear, categorySlices, analyze } from './bmAnalysis.js'

const rows = [
  { date: '2026-03-01', type: 'Income', category: 'Quỹ BM', amount: 600 },
  { date: '2026-04-01', type: 'Income', category: 'Chuyển ví', amount: 400 },
  { date: '2026-05-01', type: 'Expense', category: 'Chi phí sống', amount: 300 },
  { date: '2026-05-02', type: 'Expense', category: 'Trả nợ', amount: 100 },
  { date: '2026-06-01', type: 'Transfer', category: 'Chuyển nội bộ', amount: 999 },
  { date: '2025-12-31', type: 'Income', category: 'Quỹ BM', amount: 50 },
  { type: 'Expense', category: 'Không ngày', amount: 7 },
]

test('yearsOf: mới nhất trước; forYear lọc năm và bỏ chuyển nội bộ / dòng không ngày', () => {
  assert.deepEqual(yearsOf(rows), ['2026', '2025'])
  assert.equal(forYear(rows, '2026').length, 4)
  assert.equal(forYear(rows, 'all').length, 5)
})

test('analyze: thu, chi, ròng và % theo danh mục', () => {
  const a = analyze(rows, '2026')
  assert.equal(a.income.total, 1000)
  assert.equal(a.expense.total, 400)
  assert.equal(a.net, 600)
  assert.deepEqual(a.income.slices.map((s) => [s.name, s.amount, s.pct]), [['Quỹ BM', 600, 0.6], ['Chuyển ví', 400, 0.4]])
  assert.deepEqual(a.expense.slices.map((s) => [s.name, s.pct]), [['Chi phí sống', 0.75], ['Trả nợ', 0.25]])
  assert.equal(analyze(rows, 'all').income.total, 1050)
})

test('categorySlices: gộp danh mục nhỏ, tổng % = 1, không mất danh mục', () => {
  const rs = [...'abcdefghij'].map((c, i) => ({ category: c, amount: 100 - i }))
  const r = categorySlices(rs, 7)
  assert.equal(r.slices.length, 7)
  assert.equal(r.slices[6].kind, 'rest')
  assert.deepEqual(r.slices[6].children.map((x) => x.name), ['g', 'h', 'i', 'j'])
  assert.ok(Math.abs(r.slices.reduce((a, s) => a + s.pct, 0) - 1) < 1e-9)
  assert.deepEqual(categorySlices([], 7), { total: 0, count: 0, slices: [] })
})
