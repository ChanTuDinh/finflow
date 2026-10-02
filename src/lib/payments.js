// Ghi một lần trả nợ: tách gốc/lãi, cập nhật dư nợ; hoàn lại khi xoá. Logic thuần.
import { isInterestOnly, newId } from './schema.js'

export const PAY_TYPES = { principal: 'Trả gốc', interest: 'Trả lãi', both: 'Gốc + lãi' }
const r2 = (x) => Math.round(x * 100) / 100
export const monthlyInterest = (balance, apr) => r2((balance * apr) / 1200)

/**
 * Một con số tổng -> gốc và lãi:
 *  - Trả gốc: toàn bộ vào gốc
 *  - Trả lãi: toàn bộ là lãi, dư nợ không đổi
 *  - Gốc + lãi: trước hết trả lãi một tháng (dư nợ × lãi suất / 12), phần còn lại vào gốc
 */
export function splitPayment({ type, amount, balance, apr }) {
  const a = Number(amount)
  if (!(a > 0)) return { error: 'Nhập số tiền đã trả' }
  if (type === PAY_TYPES.interest) return { principal: 0, interest: r2(a) }
  if (type === PAY_TYPES.principal) {
    if (a > balance + 0.5) return { error: 'Số tiền trả gốc lớn hơn dư nợ hiện tại' }
    return { principal: r2(Math.min(a, balance)), interest: 0 }
  }
  const interest = r2(Math.min(a, monthlyInterest(balance, apr)))
  const principal = r2(a - interest)
  if (principal > balance + 0.5) return { error: 'Số tiền lớn hơn dư nợ cộng lãi tháng này' }
  return { principal: Math.min(principal, balance), interest }
}

// Khoản trả khiến dư nợ đổi: khoản "Trả lãi only" tính lại tiền lãi hàng tháng theo dư nợ mới; hết nợ thì đánh dấu Paid.
function rebalance(debt, balance) {
  const next = { ...debt, balance: balance <= 0.5 ? 0 : r2(balance) }
  next.status = next.balance === 0 ? 'Paid' : debt.status === 'Paid' ? 'Active' : debt.status
  if (isInterestOnly(debt) && next.balance > 0) next.min_payment = monthlyInterest(next.balance, debt.apr)
  return next
}

export function applyPayment(debt, principal, date, kind) {
  const next = principal > 0 ? rebalance(debt, debt.balance - principal) : { ...debt }
  if (kind === 'debts_bm') next.record_date = date
  return next
}

export function reversePayment(debt, payment) {
  return payment.principal > 0 ? rebalance(debt, debt.balance + payment.principal) : { ...debt }
}

/** Trả { payment, debt } (bản ghi lịch sử + khoản nợ sau khi cập nhật) hoặc { error }. */
export function buildPayment({ debt, kind, type, amount, date, note = '', createdBy = 'me' }) {
  const split = splitPayment({ type, amount, balance: debt.balance, apr: debt.apr })
  if (split.error) return { error: split.error }
  const next = applyPayment(debt, split.principal, date, kind)
  return {
    debt: next,
    payment: {
      id: newId(), date, source: kind, debt_id: debt.id, debt_name: debt.name, type,
      amount: r2(Number(amount)), principal: split.principal, interest: split.interest,
      balance_after: next.balance, note, created_by: createdBy,
    },
  }
}

/** Dòng chi "Trả nợ" tương ứng trong sổ dòng tiền (khoản của Business -> sổ doanh nghiệp, còn lại -> sổ cá nhân). */
export function cashRowFor(debt, payment) {
  const kind = debt.owner === 'Business' ? 'business' : 'personal'
  const row = { id: newId(), date: payment.date, type: 'Expense', category: 'Trả nợ', amount: payment.amount, note: `Trả nợ: ${debt.name}`, created_by: payment.created_by, ref: '' }
  return { kind, row: kind === 'business' ? { ...row, counterparty: debt.lender || '', account: '' } : { ...row, account: '' } }
}
