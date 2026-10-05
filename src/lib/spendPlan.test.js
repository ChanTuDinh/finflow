import test from 'node:test'
import assert from 'node:assert/strict'
import { BUCKETS, resolvePcts, sumPcts, allocate, monthList, buildPlan } from './spendPlan.js'

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
  const p = buildPlan(40000000, def, '2026-10')
  assert.equal(p.months.length, 12)
  assert.equal(p.per.need, 24000000)
  assert.equal(p.total, 40000000 * 12)
  assert.equal(p.totals.giving, 2000000 * 12)
  assert.equal(BUCKETS.length, 6)
})
test('thu nhập âm/rỗng -> 0', () => assert.equal(buildPlan('', def, '2026-10').total, 0))
