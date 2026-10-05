import test from 'node:test'
import assert from 'node:assert/strict'
import { HORIZONS, resolveHorizon, incomeForYear, BUCKETS, resolvePcts, sumPcts, allocate, monthList, buildPlan } from './spendPlan.js'

const def = resolvePcts()
test('tỷ lệ mặc định cộng đúng 100%', () => assert.equal(sumPcts(def), 100))
test('resolvePcts bỏ giá trị sai, giữ giá trị hợp lệ', () => {
  const r = resolvePcts({ need: -1, want: 'x', edu: 15 })
  assert.deepEqual([r.need, r.want, r.edu], [60, 10, 15])
})
test('allocate khớp tổng khi tỷ lệ 100%', () => {
  const a = allocate(33333333, def)
  assert.equal(Object.values(a).reduce((x, y) => x + y, 0), 33333333)
  assert.equal(a.investment, Math.round(33333333 * 0.05))
})
test('allocate không ép tổng khi tỷ lệ khác 100%', () => assert.equal(allocate(1000, { ...def, need: 50 }).need, 500))
test('monthList qua năm', () => assert.deepEqual(monthList('2026-11', 3), ['2026-11', '2026-12', '2027-01']))
test('buildPlan 12 tháng', () => {
  const p = buildPlan(() => 40000000, def, '2026-01')
  assert.equal(p.months.length, 12)
  assert.equal(p.months[0].amounts.need, 24000000)
  assert.equal(p.total, 40000000 * 12)
})
test('buildPlan: thu nhập khác nhau theo năm, lũy kế cộng dồn', () => {
  const inc = { 2026: 10000000, 2027: 20000000 }
  const p = buildPlan((y) => inc[y], def, '2026-01', 24)
  assert.equal(p.months[11].cumulative, 10000000 * 12)
  assert.equal(p.months[12].total, 20000000)
  assert.equal(p.total, 10000000 * 12 + 20000000 * 12)
})
test('incomeForYear: theo năm, số cũ chỉ áp cho năm hiện tại', () => {
  const saved = { monthlyIncome: 30000000, incomeByYear: { 2027: 45000000 } }
  assert.equal(incomeForYear(saved, '2027', '2026'), 45000000)
  assert.equal(incomeForYear(saved, '2026', '2026'), 30000000)
  assert.equal(incomeForYear(saved, '2028', '2026'), 0)
  assert.equal(incomeForYear({ incomeByYear: { 2026: 5 }, monthlyIncome: 9 }, '2026', '2026'), 5)
})
test('horizon: giá trị lạ về 1; đổi giá trị cũ theo tháng', () => {
  assert.equal(resolveHorizon(7), 1)
  assert.equal(resolveHorizon('3'), 3)
  assert.equal(resolveHorizon(36), 3)
  assert.ok(HORIZONS.includes(5))
})
test('thu nhập âm/rỗng -> 0', () => assert.equal(buildPlan(() => '', def, '2026-10').total, 0))
