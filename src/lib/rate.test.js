import test from 'node:test'
import assert from 'node:assert/strict'
import { computeApr } from './rate.js'
import { REPAY } from './schema.js'
import { simulate } from './forecast.js'

const both = REPAY.both, only = REPAY.interestOnly
const pmt = (P, i, n) => (P * i) / (1 - Math.pow(1 + i, -n))

test('chỉ trả lãi: lãi suất = 12 × tiền trả ÷ dư nợ', () => {
  assert.equal(computeApr({ type: only, balance: 100_000_000, payment: 1_000_000 }).apr, 12)
  assert.equal(computeApr({ type: only, balance: 90_000_000, payment: 900_000 }).apr, 12)
})

test('trả gốc và lãi: suy ngược đúng lãi suất từ tiền trả đều và số tháng', () => {
  for (const [apr, n] of [[12, 12], [11, 70], [30, 24], [8.5, 240], [0.5, 36]]) {
    const P = 180_000_000, M = pmt(P, apr / 1200, n)
    const r = computeApr({ type: both, balance: P, payment: M, term: n })
    assert.ok(Math.abs(r.apr - apr) < 0.01, `${apr}% / ${n} tháng -> ${r.apr}`)
  }
})

test('trả gốc và lãi: 0% khi tiền trả × tháng = dư nợ; báo lỗi khi không đủ trả hết', () => {
  assert.equal(computeApr({ type: both, balance: 12_000_000, payment: 1_000_000, term: 12 }).apr, 0)
  assert.match(computeApr({ type: both, balance: 12_000_000, payment: 900_000, term: 12 }).error, /chưa đủ/)
})

test('thiếu thông tin thì báo lỗi dễ hiểu', () => {
  assert.match(computeApr({ type: both, balance: 0, payment: 1 }).error, /dư nợ/)
  assert.match(computeApr({ type: both, balance: 1000, payment: 0 }).error, /trả mỗi tháng/)
  assert.match(computeApr({ type: both, balance: 1000, payment: 100 }).error, /số tháng/)
  assert.ok(computeApr({ type: only, balance: 1000, payment: 100 }).apr > 0) // chỉ trả lãi không cần số tháng
})

test('lãi suất suy ra khớp mô phỏng: hết nợ đúng sau n tháng', () => {
  const P = 60_000_000, n = 24, M = pmt(P, 0.015, n)
  const { apr } = computeApr({ type: both, balance: P, payment: M, term: n })
  const r = simulate({ debts: [{ id: 'a', status: 'Active', balance: P, apr, min_payment: M, repay_type: both }], scenario: { mode: 'min' }, baseline: { income: 0, expense: 0 }, startYm: '2026-01', years: 3 })
  assert.equal(r.clearedAt, n)
})

test('forecast: khoản chỉ trả lãi không giảm dư nợ, trả thêm gốc thì giảm lãi', () => {
  const d = { id: 'a', status: 'Active', balance: 100_000_000, apr: 12, min_payment: 1_000_000, repay_type: only }
  const args = { debts: [d], baseline: { income: 0, expense: 0 }, startYm: '2026-01', years: 2 }
  const min = simulate({ ...args, scenario: { mode: 'min' } })
  assert.ok(Math.abs(min.endBalance - 100_000_000) < 1)
  assert.equal(min.clearedAt, null)
  const extra = simulate({ ...args, scenario: { mode: 'extra', extra: 5_000_000, order: 'avalanche' } })
  assert.ok(extra.endBalance < 100_000_000 && extra.totalInterest < min.totalInterest)
  // tiền lãi phải trả hàng tháng giảm theo dư nợ
  const pays = extra.series.slice(1, 6).map((s) => s.interest)
  assert.ok(pays[4] < pays[0])
})
