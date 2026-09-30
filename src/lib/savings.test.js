import test from 'node:test'
import assert from 'node:assert/strict'
import { projectSavings, requiredMonthly, goalStatus, compareDebtVsSave, monthsUntil } from './savings.js'

const acc = (o) => ({ id: 'a', status: 'Active', balance: 1000, monthly_contribution: 0, annual_return: 12, goal_id: '', ...o })

test('lãi kép hàng tháng', () => {
  const r = projectSavings({ accounts: [acc()], startYm: '2026-01', years: 1 })
  assert.ok(Math.abs(r.end - 1000 * Math.pow(1.01, 12)) < 1e-6)
  assert.equal(r.contributed, 0)
})

test('góp hàng tháng + kịch bản lãi/góp', () => {
  const base = projectSavings({ accounts: [acc({ annual_return: 0, monthly_contribution: 100 })], startYm: '2026-01', years: 1 })
  assert.equal(base.end, 2200)
  const more = projectSavings({ accounts: [acc({ annual_return: 0, monthly_contribution: 100 })], scenario: { contribMult: 1.5 }, startYm: '2026-01', years: 1 })
  assert.equal(more.end, 2800)
  const worse = projectSavings({ accounts: [acc()], scenario: { returnDelta: -12 }, startYm: '2026-01', years: 1 })
  assert.equal(worse.end, 1000)
})

test('requiredMonthly khớp mô phỏng', () => {
  const need = requiredMonthly({ balance: 1000, target: 10000, ratePct: 6, months: 36 })
  const r = projectSavings({ accounts: [acc({ annual_return: 6, monthly_contribution: need })], startYm: '2026-01', years: 3 })
  assert.ok(Math.abs(r.end - 10000) < 0.01)
  assert.equal(requiredMonthly({ balance: 10, target: 5, ratePct: 5, months: 10 }), 0)
  assert.equal(requiredMonthly({ balance: 0, target: 1200, ratePct: 0, months: 12 }), 100)
})

test('goalStatus: ETA và onTrack', () => {
  const goal = { id: 'g', target_amount: 2000, target_date: '2026-12-31' }
  const accounts = [acc({ goal_id: 'g', annual_return: 0, monthly_contribution: 100 })]
  const s = goalStatus({ goal, accounts, startYm: '2026-01' })
  assert.equal(s.eta, 10)
  assert.equal(monthsUntil('2026-01', '2026-12-31'), 11)
  assert.ok(s.onTrack)
  const late = goalStatus({ goal: { ...goal, target_date: '2026-06-30' }, accounts, startYm: '2026-01' })
  assert.ok(!late.onTrack && late.required > 100)
  assert.equal(goalStatus({ goal, accounts: [], startYm: '2026-01' }).eta, null)
})

const debt = (o) => ({ id: 'd', status: 'Active', balance: 10000, apr: 20, min_payment: 300, ...o })
const args = { baseline: { income: 5000, expense: 2000 }, startYm: '2026-01', years: 5, extra: 500 }

test('nợ lãi cao hơn lợi nhuận -> trả nợ trước có lợi', () => {
  const r = compareDebtVsSave({ ...args, debts: [debt({ apr: 20 })], saveReturn: 5 })
  assert.ok(r.diff > 0)
})
test('lợi nhuận cao hơn lãi nợ -> tích lũy trước có lợi', () => {
  const r = compareDebtVsSave({ ...args, debts: [debt({ apr: 3 })], saveReturn: 15 })
  assert.ok(r.diff < 0)
})
test('không có nợ -> hasDebt false, hai chiến lược bằng nhau', () => {
  const r = compareDebtVsSave({ ...args, debts: [], saveReturn: 5 })
  assert.equal(r.hasDebt, false)
  assert.ok(Math.abs(r.diff) < 1e-6)
})
