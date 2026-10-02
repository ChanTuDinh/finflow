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

test('cashRowFor: Business -> sổ doanh nghiệp, BM -> Ví BM, còn lại -> sổ cá nhân', () => {
  const { payment } = buildPayment({ debt: bm, kind: 'debts_bm', type: T.principal, amount: 1e6, date: '2026-10-05' })
  assert.equal(cashRowFor({ ...bm, owner: 'Business' }, payment).kind, 'business')
  assert.equal(cashRowFor({ ...bm, owner: 'Personal' }, payment).kind, 'personal')
  const c = cashRowFor(bm, payment) // bm.owner === 'BM'
  assert.deepEqual([c.kind, c.row.type, c.row.category, c.row.amount], ['bm', 'Expense', 'Trả nợ', 1e6])
})

import { ADJUST, needsAdjust, levelPayment } from './payments.js'
const loan = { id: 'd4', name: 'Vay BM #4', lender: 'Ky Nam', owner: 'BM', balance: 2e9, apr: 6.5, min_payment: 28e6, term_months: 91, status: 'Active', repay_type: REPAY.both, record_date: '2026-04-01' }

test('trả gốc 700tr, giữ tiền trả/tháng -> rút ngắn thời hạn còn khoảng 54 tháng', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: '2026-04-01', adjust: ADJUST.shorten })
  assert.equal(r.debt.balance, 1.3e9)
  assert.equal(r.debt.min_payment, 28e6)
  assert.equal(r.debt.term_months, 54)
  const prev = JSON.parse(r.payment.adjust_prev)
  assert.deepEqual([prev.min_payment, prev.term_months, prev.adjust], [28e6, 91, ADJUST.shorten])
  assert.deepEqual(prev.after, { min_payment: 28e6, term_months: 54, repay_type: REPAY.both, apr: 6.5 })
})

test('trả gốc 700tr, giữ thời hạn -> tiền trả/tháng giảm còn khoảng 18,13tr', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: '2026-04-01', adjust: ADJUST.reduce })
  assert.equal(r.debt.term_months, 91)
  assert.ok(Math.abs(r.debt.min_payment - 18_132_514) < 5, String(r.debt.min_payment))
  // đúng là khoản trả đều hết đúng 91 tháng
  assert.ok(Math.abs(levelPayment(1.3e9, 6.5, 91) - r.debt.min_payment) < 1)
})

test('Không đổi / không biết số tháng / khoản trả lãi only / trả lãi -> không tự điều chỉnh', () => {
  const none = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.none })
  assert.deepEqual([none.debt.min_payment, none.debt.term_months, none.payment.adjust_prev], [28e6, 91, ''])
  const noTerm = buildPayment({ debt: { ...loan, term_months: 0 }, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.reduce })
  assert.equal(noTerm.debt.min_payment, 28e6) // không có số tháng để giữ
  assert.equal(needsAdjust({ ...loan, repay_type: REPAY.interestOnly }, 1e8), false)
  assert.equal(needsAdjust(loan, 0), false)
  assert.equal(needsAdjust(loan, 2e9), false) // trả hết
})

test('xoá lần trả đã điều chỉnh -> hoàn lại cả dư nợ, tiền trả/tháng và số tháng', () => {
  for (const adjust of [ADJUST.shorten, ADJUST.reduce]) {
    const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust })
    const back = reversePayment(r.debt, r.payment)
    assert.deepEqual([back.balance, back.min_payment, back.term_months], [2e9, 28e6, 91])
  }
})

import { impliedApr } from './payments.js'
test('suy ngược: lãi 6,5tr/tháng trên dư nợ 1,3 tỷ ứng với 6,0%/năm; trên 1,2 tỷ ứng 6,5%', () => {
  assert.equal(impliedApr(1.3e9, 6.5e6), 6)
  assert.equal(impliedApr(1.2e9, 6.5e6), 6.5)
  assert.equal(impliedApr(0, 6.5e6), null)
})

test('trả gốc 700tr rồi chuyển sang chỉ trả lãi 6,5tr: giữ lãi suất 6,5%', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: '2026-04-01', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'keep' } })
  assert.equal(r.debt.balance, 1.3e9)
  assert.equal(r.debt.repay_type, REPAY.interestOnly)
  assert.equal(r.debt.min_payment, 6.5e6)
  assert.equal(r.debt.apr, 6.5)
  const prev = JSON.parse(r.payment.adjust_prev)
  assert.deepEqual([prev.min_payment, prev.term_months, prev.repay_type, prev.apr, prev.adjust], [28e6, 91, REPAY.both, 6.5, ADJUST.interestOnly])
  assert.deepEqual(prev.after, { min_payment: 6.5e6, term_months: 91, repay_type: REPAY.interestOnly, apr: 6.5 })
})

test('chuyển sang chỉ trả lãi và dùng lãi suất ngầm định (6,0%)', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'implied' } })
  assert.equal(r.debt.apr, 6)
  assert.equal(r.debt.min_payment, 6.5e6)
})

test('không nhập tiền lãi -> mặc định dư nợ mới × lãi suất / 12', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.interestOnly })
  assert.ok(Math.abs(r.debt.min_payment - 7_041_666.67) < 1, String(r.debt.min_payment))
})

test('xoá lần trả đã chuyển sang chỉ trả lãi -> hoàn lại hình thức, lãi suất, tiền trả/tháng, số tháng và dư nợ', () => {
  for (const rateMode of ['keep', 'implied']) {
    const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode } })
    const back = reversePayment(r.debt, r.payment)
    assert.deepEqual([back.balance, back.repay_type, back.apr, back.min_payment, back.term_months], [2e9, REPAY.both, 6.5, 28e6, 91])
  }
})

test('chuyển sang chỉ trả lãi: Forecast không giảm dư nợ, mỗi tháng trả đúng lãi', async () => {
  const { simulate } = await import('./forecast.js')
  const { debt } = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'keep' } })
  const r = simulate({ debts: [debt], scenario: { mode: 'min' }, baseline: { income: 0, expense: 0 }, startYm: '2026-04', years: 1 })
  assert.ok(Math.abs(r.endBalance - 1.3e9) < 1)
  assert.ok(Math.abs(r.series[1].payment - 1.3e9 * 0.065 / 12) < 1) // 7,04tr: lãi thực theo lãi suất đang lưu
})

import { adjustSummary, adjustFormValues } from './payments.js'
const m = (x) => `${Math.round(x)}đ`

test('mô tả điều chỉnh để hiện trong lịch sử, và điền lại form khi sửa', () => {
  const io = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'implied' } })
  assert.match(adjustSummary(io.payment, m), /Chuyển sang chỉ trả lãi: 6500000đ\/tháng · lãi suất 6.5% → 6%/)
  assert.deepEqual(adjustFormValues(io.payment), { adjust: ADJUST.interestOnly, interest: '6500000', rateMode: 'implied', apr: '' })
  const sh = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.shorten })
  assert.match(adjustSummary(sh.payment, m), /Rút ngắn thời hạn: 91 → 54 tháng/)
  const rd = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.reduce })
  assert.match(adjustSummary(rd.payment, m), /Giảm tiền trả: 28000000đ → 18132514đ\/tháng/)
  const none = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd' })
  assert.equal(adjustSummary(none.payment, m), null)
  assert.deepEqual(adjustFormValues(none.payment), { adjust: ADJUST.none, interest: '', rateMode: 'keep', apr: '' })
})

test('sửa một lần trả = hoàn lại rồi áp lại với số mới, giữ nguyên id', () => {
  const first = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: '2026-04-01', adjust: ADJUST.none })
  const base = reversePayment(first.debt, first.payment) // quay về khoản nợ trước lần trả
  assert.deepEqual([base.balance, base.min_payment, base.term_months], [2e9, 28e6, 91])
  const edited = buildPayment({ debt: base, kind: 'debts_bm', type: T.principal, amount: 800e6, date: '2026-04-01', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'keep' }, id: first.payment.id })
  assert.equal(edited.payment.id, first.payment.id)
  assert.deepEqual([edited.debt.balance, edited.debt.repay_type, edited.debt.min_payment, edited.debt.apr], [1.2e9, REPAY.interestOnly, 6.5e6, 6.5])
  assert.equal(impliedApr(edited.debt.balance, edited.debt.min_payment), 6.5) // 800tr gốc -> lãi 6,5tr khớp đúng 6,5%
})

import { effectiveDebts } from './payments.js'
test('dư nợ giả định: bỏ tick lần trả thì dư nợ như chưa trả; tick lại thì như cũ', () => {
  const r = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: '2026-04-01', adjust: ADJUST.interestOnly, adjustOpts: { interest: 6.5e6, rateMode: 'implied' } })
  const stored = r.debt // 1,3 tỷ, chỉ trả lãi 6,5tr, lãi 6%
  assert.equal(effectiveDebts([stored], [r.payment], [])[0], stored) // không bỏ lần nào: nguyên bản
  const [eff] = effectiveDebts([stored], [r.payment], [r.payment.id])
  assert.deepEqual([eff.balance, eff.repay_type, eff.apr, eff.min_payment, eff.term_months], [2e9, REPAY.both, 6.5, 28e6, 91])
  assert.equal(stored.balance, 1.3e9) // dữ liệu gốc không bị đổi
})

test('dư nợ giả định với nhiều lần trả: bỏ một lần thì chỉ cộng lại gốc lần đó', () => {
  const a = buildPayment({ debt: loan, kind: 'debts', type: T.principal, amount: 100e6, date: 'd1', adjust: ADJUST.none })
  const b = buildPayment({ debt: a.debt, kind: 'debts', type: T.principal, amount: 300e6, date: 'd2', adjust: ADJUST.none })
  const pays = [a.payment, b.payment]
  assert.equal(b.debt.balance, 1.6e9)
  assert.equal(effectiveDebts([b.debt], pays, [a.payment.id])[0].balance, 1.7e9) // bỏ lần 100tr
  assert.equal(effectiveDebts([b.debt], pays, [b.payment.id])[0].balance, 1.9e9) // bỏ lần 300tr
  assert.equal(effectiveDebts([b.debt], pays, [a.payment.id, b.payment.id])[0].balance, 2e9) // bỏ cả hai
})

test('dư nợ giả định: lần trả lãi (không có gốc) bỏ tick không đổi gì; lần trả hết nợ bỏ tick thì mở lại khoản nợ', () => {
  const i = buildPayment({ debt: loan, kind: 'debts', type: T.interest, amount: 5e6, date: 'd' })
  assert.equal(effectiveDebts([i.debt], [i.payment], [i.payment.id])[0].balance, 2e9)
  const all = buildPayment({ debt: loan, kind: 'debts', type: T.principal, amount: 2e9, date: 'd' })
  assert.equal(all.debt.status, 'Paid')
  const [eff] = effectiveDebts([all.debt], [all.payment], [all.payment.id])
  assert.deepEqual([eff.balance, eff.status], [2e9, 'Active'])
})

import { canAdjustRate, adjustChoices } from './payments.js'
// Vay BM #3: đang chỉ trả lãi, dư nợ 1,3 tỷ, lãi 6,5%
const bm3 = { id: 'd3', name: 'Vay BM #3', lender: 'CH', owner: 'BM', balance: 1.3e9, apr: 6.5, min_payment: 7_041_666.67, term_months: 0, status: 'Active', repay_type: REPAY.interestOnly, record_date: '2025-01-01' }

test('khoản đã chỉ trả lãi: trả gốc 1 tỷ rồi đổi lãi suất sang 7% -> tiền lãi tính theo lãi mới', () => {
  assert.equal(canAdjustRate(bm3, 1e9), true)
  assert.equal(canAdjustRate(bm3, 0), false)
  assert.deepEqual(adjustChoices(bm3), [ADJUST.rate, ADJUST.none])
  const r = buildPayment({ debt: bm3, kind: 'debts_bm', type: T.principal, amount: 1e9, date: '2025-04-01', adjust: ADJUST.rate, adjustOpts: { rateMode: 'custom', apr: 7 } })
  assert.deepEqual([r.debt.balance, r.debt.apr, r.debt.min_payment, r.debt.repay_type], [300e6, 7, 1_750_000, REPAY.interestOnly])
  assert.match(adjustSummary(r.payment, m), /Điều chỉnh lãi suất \/ tiền lãi: lãi suất 6.5% → 7% · trả 1750000đ\/tháng/)
  assert.deepEqual(adjustFormValues(r.payment), { adjust: ADJUST.rate, interest: '1750000', rateMode: 'custom', apr: '7' })
})

test('khoản đã chỉ trả lãi: để mặc định (không đổi) thì lãi suất giữ nguyên, tiền lãi tự tính theo dư nợ mới', () => {
  const r = buildPayment({ debt: bm3, kind: 'debts_bm', type: T.principal, amount: 1e9, date: 'd', adjust: ADJUST.none })
  assert.deepEqual([r.debt.balance, r.debt.apr, r.payment.adjust_prev], [300e6, 6.5, ''])
  assert.ok(Math.abs(r.debt.min_payment - 1_625_000) < 1) // 300tr × 6,5% / 12
})

test('khoản đã chỉ trả lãi: nhập tay tiền lãi + giữ lãi suất, hoặc dùng lãi suất ngầm định', () => {
  const keep = buildPayment({ debt: bm3, kind: 'debts_bm', type: T.principal, amount: 1e9, date: 'd', adjust: ADJUST.rate, adjustOpts: { interest: 1.75e6, rateMode: 'keep' } })
  assert.deepEqual([keep.debt.apr, keep.debt.min_payment], [6.5, 1.75e6])
  const implied = buildPayment({ debt: bm3, kind: 'debts_bm', type: T.principal, amount: 1e9, date: 'd', adjust: ADJUST.rate, adjustOpts: { interest: 1.75e6, rateMode: 'implied' } })
  assert.deepEqual([implied.debt.apr, implied.debt.min_payment], [7, 1.75e6])
})

test('xoá lần trả đã đổi lãi suất -> hoàn lại lãi suất và tiền lãi cũ; ADJUST.rate bị bỏ qua với khoản gốc + lãi', () => {
  const r = buildPayment({ debt: bm3, kind: 'debts_bm', type: T.principal, amount: 1e9, date: 'd', adjust: ADJUST.rate, adjustOpts: { rateMode: 'custom', apr: 7 } })
  const back = reversePayment(r.debt, r.payment)
  assert.deepEqual([back.balance, back.apr], [1.3e9, 6.5])
  assert.ok(Math.abs(back.min_payment - 7_041_666.67) < 0.01)
  const amort = buildPayment({ debt: loan, kind: 'debts_bm', type: T.principal, amount: 700e6, date: 'd', adjust: ADJUST.rate, adjustOpts: { rateMode: 'custom', apr: 9 } })
  assert.deepEqual([amort.debt.repay_type, amort.debt.apr, amort.debt.min_payment], [REPAY.both, 6.5, 28e6]) // không áp dụng cho khoản gốc + lãi
})
