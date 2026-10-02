import test from 'node:test'
import assert from 'node:assert/strict'
import { PAY_TYPES as T, splitPayment, buildPayment, reversePayment, cashRowFor } from './payments.js'
import { REPAY } from './schema.js'

const bm = { id: 'd1', name: 'Vay BM #1', lender: 'AT', owner: 'BM', balance: 500_000_000, apr: 12, min_payment: 5_000_000, status: 'Active', repay_type: REPAY.interestOnly, record_date: '2025-01-01' }

test('Trả gốc: toàn bộ vào gốc; không được lớn hơn dư nợ', () => {
  assert.deepEqual(splitPayment({ type: T.principal, amount: 50e6, balance: 500e6, apr: 12 }), { principal: 50e6, interest: 0 })
  assert.match(splitPayment({ type: T.principal, amount: 600e6, balance: 500e6, apr: 12 }).error, /lớn hơn dư nợ/)
  assert.match(splitPayment({ type: T.principal, amount: 0, balance: 1, apr: 1 }).error, /số tiền/)
})

test('Trả lãi: dư nợ không đổi', () => {
  assert.deepEqual(splitPayment({ type: T.interest, amount: 5e6, balance: 500e6, apr: 12 }), { principal: 0, interest: 5e6 })
})

test('Gốc + lãi: trả lãi một tháng trước, phần còn lại vào gốc', () => {
  // lãi tháng = 500tr × 12% / 12 = 5tr
  assert.deepEqual(splitPayment({ type: T.both, amount: 55e6, balance: 500e6, apr: 12 }), { principal: 50e6, interest: 5e6 })
  assert.deepEqual(splitPayment({ type: T.both, amount: 3e6, balance: 500e6, apr: 12 }), { principal: 0, interest: 3e6 }) // chưa đủ trả lãi
})

test('buildPayment: cập nhật dư nợ, ngày ghi nhận (Nợ BM), tính lại tiền lãi tháng cho khoản Trả lãi only', () => {
  const r = buildPayment({ debt: bm, kind: 'debts_bm', type: T.principal, amount: 50e6, date: '2026-10-05', note: 'đập gốc' })
  assert.equal(r.debt.balance, 450e6)
  assert.equal(r.debt.min_payment, 4_500_000) // 450tr × 12% / 12
  assert.equal(r.debt.record_date, '2026-10-05')
  assert.equal(r.debt.apr, 12) // lãi suất giữ nguyên
  assert.deepEqual([r.payment.amount, r.payment.principal, r.payment.interest, r.payment.balance_after, r.payment.debt_id, r.payment.source], [50e6, 50e6, 0, 450e6, 'd1', 'debts_bm'])
})

test('khoản trả gốc và lãi: giữ nguyên số tiền trả mỗi tháng; Nợ chính không có record_date', () => {
  const d = { ...bm, repay_type: REPAY.both, min_payment: 8e6 }
  const r = buildPayment({ debt: d, kind: 'debts', type: T.principal, amount: 100e6, date: '2026-10-05' })
  assert.equal(r.debt.min_payment, 8e6)
  assert.equal(r.debt.record_date, '2025-01-01') // không đổi ở tab Nợ chính
})

test('trả hết dư nợ -> Paid; xoá lần trả -> hoàn lại và Active', () => {
  const r = buildPayment({ debt: bm, kind: 'debts_bm', type: T.principal, amount: 500e6, date: '2026-10-05' })
  assert.deepEqual([r.debt.balance, r.debt.status], [0, 'Paid'])
  const back = reversePayment(r.debt, r.payment)
  assert.deepEqual([back.balance, back.status, back.min_payment], [500e6, 'Active', 5e6])
})

test('trả lãi không đổi dư nợ / tiền lãi tháng', () => {
  const r = buildPayment({ debt: bm, kind: 'debts_bm', type: T.interest, amount: 5e6, date: '2026-10-05' })
  assert.equal(r.debt.balance, 500e6)
  assert.equal(r.debt.min_payment, 5e6)
  assert.equal(r.payment.balance_after, 500e6)
})

test('cashRowFor: Business -> sổ doanh nghiệp, còn lại -> sổ cá nhân', () => {
  const { payment } = buildPayment({ debt: bm, kind: 'debts_bm', type: T.principal, amount: 1e6, date: '2026-10-05' })
  assert.equal(cashRowFor({ ...bm, owner: 'Business' }, payment).kind, 'business')
  const c = cashRowFor(bm, payment)
  assert.deepEqual([c.kind, c.row.type, c.row.category, c.row.amount], ['personal', 'Expense', 'Trả nợ', 1e6])
})
