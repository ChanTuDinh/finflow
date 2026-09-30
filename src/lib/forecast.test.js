import test from 'node:test'
import assert from 'node:assert/strict'
import { simulate } from './forecast.js'

const debt = (o) => ({ id: 'a', status: 'Active', balance: 1200, apr: 12, min_payment: 100, ...o })
const baseline = { income: 1000, expense: 500 }

test('lãi cộng dồn hàng tháng, trả tối thiểu hết nợ', () => {
  const r = simulate({ debts: [debt()], scenario: { mode: 'min' }, baseline, startYm: '2026-01', years: 3 })
  assert.ok(r.clearedAt > 12 && r.clearedAt < 14)
  assert.ok(r.totalInterest > 0)
  assert.ok(Math.abs(r.totalPaid - (1200 + r.totalInterest)) < 0.01)
})

test('trả nhanh tốn ít lãi hơn tối thiểu', () => {
  const min = simulate({ debts: [debt()], scenario: { mode: 'min' }, baseline, startYm: '2026-01' })
  const fast = simulate({ debts: [debt()], scenario: { mode: 'extra', extra: 200 }, baseline, startYm: '2026-01' })
  assert.ok(fast.totalInterest < min.totalInterest)
  assert.ok(fast.clearedAt < min.clearedAt)
})

test('avalanche dồn tiền vào khoản lãi cao', () => {
  const debts = [debt({ id: 'low', apr: 5, balance: 1000 }), debt({ id: 'high', apr: 25, balance: 1000 })]
  const r = simulate({ debts, scenario: { mode: 'extra', extra: 300, order: 'avalanche' }, baseline, startYm: '2026-01' })
  assert.ok(r.payoffMonth.high < r.payoffMonth.low)
})

test('min payment thấp hơn lãi -> không hết nợ', () => {
  const r = simulate({ debts: [debt({ balance: 100000, min_payment: 100 })], scenario: { mode: 'min' }, baseline, startYm: '2026-01' })
  assert.equal(r.clearedAt, null)
  assert.ok(r.endBalance > 100000)
})
