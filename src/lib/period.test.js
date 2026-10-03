import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL, fromKey, inPeriod, parent, crumbs, shift, childKeys, childKeyFn, monthsIn } from './period.js'
import { byYear, byMonth } from './calc.js'

test('fromKey nhận đúng cấp, từ chối ngày', () => {
  assert.equal(fromKey('2026').level, 'year')
  assert.equal(fromKey('2026-Q3').level, 'quarter')
  assert.equal(fromKey('2026-09').level, 'month')
  assert.equal(fromKey('2026-09-05'), null)
  assert.equal(fromKey('2026-13'), null)
})

test('inPeriod ở ranh giới quý/năm', () => {
  const q = fromKey('2026-Q3')
  assert.ok(inPeriod(q, '2026-07-01') && inPeriod(q, '2026-09-30'))
  assert.ok(!inPeriod(q, '2026-06-30') && !inPeriod(q, '2026-10-01'))
  assert.ok(inPeriod(fromKey('2026'), '2026-12-31') && !inPeriod(fromKey('2026'), '2027-01-01'))
  assert.ok(inPeriod(ALL, '1999-01-01'))
})

test('parent và breadcrumb', () => {
  assert.deepEqual(parent(fromKey('2026-09')), fromKey('2026-Q3'))
  assert.deepEqual(parent(fromKey('2026-Q3')), fromKey('2026'))
  assert.deepEqual(parent(fromKey('2026')), ALL)
  assert.deepEqual(crumbs(fromKey('2026-09')).map((c) => c.key), ['', '2026', '2026-Q3', '2026-09'])
})

test('shift qua ranh giới năm', () => {
  assert.equal(shift(fromKey('2026-Q1'), -1).key, '2025-Q4')
  assert.equal(shift(fromKey('2026-Q4'), 1).key, '2027-Q1')
  assert.equal(shift(fromKey('2026-01'), -1).key, '2025-12')
  assert.equal(shift(fromKey('2026'), 1).key, '2027')
})

test('childKeys lấp kỳ trống và khớp childKeyFn', () => {
  assert.deepEqual(childKeys(fromKey('2026')), ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
  assert.deepEqual(childKeys(fromKey('2026-Q4')), ['2026-10', '2026-11', '2026-12'])
  assert.equal(childKeys(fromKey('2024-02')).length, 29)
  assert.deepEqual(childKeys(ALL, [2024, 2026]), ['2024', '2025', '2026'])
  assert.equal(childKeyFn(fromKey('2026'))('2026-08-15'), '2026-Q3')
  assert.equal(childKeyFn(ALL)('2026-08-15'), '2026')
})

test('byYear và monthsIn', () => {
  const rows = [{ date: '2025-12-31', type: 'Income', amount: 10 }, { date: '2026-01-01', type: 'Expense', amount: 4 }]
  assert.deepEqual(byYear(rows).map((r) => [r.period, r.net]), [['2025', 10], ['2026', -4]])
  assert.equal(byMonth(rows).length, 2)
  assert.equal(monthsIn(ALL, rows), 2)
  assert.equal(monthsIn(fromKey('2026-Q1')), 3)
})

import { breakdown } from './period.js'
test('breakdown lấp kỳ trống và chỉ lấy trong kỳ', () => {
  const rows = [
    { date: '2026-02-10', type: 'Income', amount: 100 },
    { date: '2026-08-10', type: 'Expense', amount: 30 },
    { date: '2025-08-10', type: 'Income', amount: 999 },
  ]
  const b = breakdown(rows, fromKey('2026'))
  assert.deepEqual(b.map((e) => e.net), [100, 0, -30, 0]) // Q1..Q4, năm 2025 bị loại
  assert.equal(b.length, 4)
  assert.equal(breakdown(rows, ALL).length, 2)
})

import { resolveGrain, validGrains, childKeys as ck } from './period.js'
test('grain: hợp lệ theo kỳ, rơi về mặc định khi không còn hợp lệ', () => {
  assert.deepEqual(validGrains(fromKey('2026')), ['month', 'quarter'])
  assert.equal(resolveGrain(fromKey('2026'), 'month'), 'month')
  assert.equal(resolveGrain(fromKey('2026-Q2'), 'quarter'), 'month') // quý không chia theo quý
  assert.equal(resolveGrain(ALL, null), 'year')
  assert.equal(resolveGrain(fromKey('2026-05'), 'month'), 'day')
})
test('childKeys theo grain tường minh', () => {
  assert.equal(ck(fromKey('2026'), [], 'month').length, 12)
  assert.deepEqual(ck(ALL, [2025, 2026], 'quarter'), ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
  assert.equal(ck(ALL, [2024, 2026], 'month').length, 36)
  assert.deepEqual(ck(fromKey('2026-Q2'), [], 'month'), ['2026-04', '2026-05', '2026-06'])
})
test('breakdown theo tháng trong một năm', () => {
  const rows = [{ date: '2026-03-05', type: 'Income', amount: 10 }, { date: '2026-03-20', type: 'Expense', amount: 4 }]
  const b = breakdown(rows, fromKey('2026'), undefined, 'month')
  assert.equal(b.length, 12)
  assert.equal(b[2].net, 6)
  assert.equal(b.filter((e) => e.net !== 0).length, 1)
})

test('Transfer không tính vào thu/chi', async () => {
  const { totals, byMonth, expenseByCategory } = await import('./calc.js')
  const rows = [
    { date: '2026-03-01', type: 'Income', category: 'Lương', amount: 100 },
    { date: '2026-03-02', type: 'Expense', category: 'Khác', amount: 30 },
    { date: '2026-03-03', type: 'Transfer', category: 'Chuyển nội bộ', amount: 500 },
    { date: '2026-03-03', type: 'Transfer', category: 'Chuyển nội bộ', amount: 500 },
  ]
  assert.deepEqual(totals(rows), { income: 100, expense: 30, net: 70 })
  assert.equal(byMonth(rows)[0].expense, 30)
  assert.deepEqual(expenseByCategory(rows).map((e) => e.category), ['Khác'])
})

test('kỳ mặc định là Tất cả năm, xem theo Năm', () => {
  assert.deepEqual(ALL, { level: 'all', key: '' })
  assert.equal(resolveGrain(ALL, null), 'year')
  assert.ok(inPeriod(ALL, '2019-01-01') && inPeriod(ALL, '2031-12-31'))
})

test('spanMonths: số tháng từ đầu đến cuối, tính cả tháng trống', async () => {
  const { spanMonths } = await import('./period.js')
  assert.equal(spanMonths([]), 0)
  assert.equal(spanMonths([{ date: '2026-03-10' }]), 1)
  assert.equal(spanMonths([{ date: '2026-01-31' }, { date: '2026-03-01' }, { date: '2026-09-30' }]), 9)
  assert.equal(spanMonths([{ date: '2025-11-02' }, { date: '2026-02-01' }]), 4)
})
