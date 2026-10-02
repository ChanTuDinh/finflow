// Ghi một lần trả nợ: tách gốc/lãi, cập nhật dư nợ; hoàn lại khi xoá. Logic thuần.
import { REPAY, isInterestOnly, newId } from './schema.js'
import { computeApr, estimateTerm } from './rate.js'

// Sau khi trả bớt gốc ở khoản "Trả gốc và lãi", ngân hàng thường xử lý theo một trong hai cách:
export const ADJUST = {
  shorten: 'Giữ tiền trả mỗi tháng, rút ngắn thời hạn',
  reduce: 'Giữ thời hạn, giảm tiền trả mỗi tháng',
  interestOnly: 'Chuyển sang chỉ trả lãi',
  none: 'Không đổi',
}
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

// Tiền trả đều hàng tháng để hết balance trong n tháng với lãi suất năm apr (%)
export const levelPayment = (balance, apr, n) => (apr === 0 ? r2(balance / n) : r2((balance * (apr / 1200)) / (1 - Math.pow(1 + apr / 1200, -n))))

/** Có cần chọn cách điều chỉnh không: khoản trả gốc và lãi, lần trả có phần gốc, và chưa trả hết nợ. */
export const needsAdjust = (debt, principal) => !isInterestOnly(debt) && principal > 0 && principal < debt.balance - 0.5

/** Lãi suất ngầm định từ dư nợ và tiền lãi trả mỗi tháng (khoản chỉ trả lãi). */
export const impliedApr = (balance, interest) => computeApr({ type: REPAY.interestOnly, balance, payment: interest }).apr ?? null

/**
 * adjust: cách xử lý phần còn lại sau khi trả bớt gốc.
 * opts (chỉ cho ADJUST.interestOnly): { interest: tiền lãi trả mỗi tháng sau đó, rateMode: 'keep' | 'implied' }
 */
export function applyPayment(debt, principal, date, kind, adjust = ADJUST.none, opts = {}) {
  const next = principal > 0 ? rebalance(debt, debt.balance - principal) : { ...debt }
  if (kind === 'debts_bm') next.record_date = date
  let prev = null
  if (needsAdjust(debt, principal) && next.balance > 0) {
    if (adjust === ADJUST.shorten) {
      const t = estimateTerm({ balance: next.balance, apr: debt.apr, payment: debt.min_payment })
      if (!t.error && t.months !== debt.term_months) { prev = { min_payment: debt.min_payment, term_months: debt.term_months }; next.term_months = t.months }
    } else if (adjust === ADJUST.interestOnly) {
      // Ngân hàng chuyển sang chỉ thu lãi hàng tháng, gốc còn lại giữ nguyên tới khi tất toán
      const interest = Number(opts.interest) > 0 ? r2(Number(opts.interest)) : monthlyInterest(next.balance, debt.apr)
      prev = { min_payment: debt.min_payment, term_months: debt.term_months, repay_type: debt.repay_type || '', apr: debt.apr }
      next.repay_type = REPAY.interestOnly
      next.min_payment = interest
      const implied = impliedApr(next.balance, interest)
      if (opts.rateMode === 'implied' && implied != null) next.apr = implied
    } else if (adjust === ADJUST.reduce && debt.term_months > 0) {
      const pay = levelPayment(next.balance, debt.apr, debt.term_months)
      if (pay !== debt.min_payment) { prev = { min_payment: debt.min_payment, term_months: debt.term_months }; next.min_payment = pay }
    }
  }
  if (prev) prev = { ...prev, adjust, after: { min_payment: next.min_payment, term_months: next.term_months, repay_type: next.repay_type || '', apr: next.apr } }
  return { next, prev }
}

/** Thông tin điều chỉnh đã lưu trong một lần trả (bản ghi cũ chưa có nhãn thì suy ra từ giá trị thay đổi). */
export function adjustInfo(payment) {
  let prev = null
  try { prev = payment.adjust_prev ? JSON.parse(payment.adjust_prev) : null } catch { /* bỏ qua */ }
  if (!prev) return null
  const label = prev.adjust || (prev.repay_type !== undefined ? ADJUST.interestOnly : prev.after ? null : null)
  return { prev, after: prev.after || null, label }
}

/** Một dòng mô tả để hiện trong lịch sử, vd. "Chuyển sang chỉ trả lãi: 6.500.000 ₫/tháng · lãi suất 6.5% → 6%". */
export function adjustSummary(payment, money) {
  const info = adjustInfo(payment)
  if (!info) return null
  const { prev, after, label } = info
  if (!after) return label ? `${label}` : 'Đã điều chỉnh tiền trả/thời hạn (xem khoản nợ)'
  if (label === ADJUST.interestOnly) return `Chuyển sang chỉ trả lãi: ${money(after.min_payment)}/tháng${after.apr !== prev.apr ? ` · lãi suất ${prev.apr}% → ${after.apr}%` : ''}`
  if (label === ADJUST.shorten) return `Rút ngắn thời hạn: ${prev.term_months || '?'} → ${after.term_months} tháng (trả ${money(after.min_payment)}/tháng)`
  if (label === ADJUST.reduce) return `Giảm tiền trả: ${money(prev.min_payment)} → ${money(after.min_payment)}/tháng (thời hạn ${after.term_months} tháng)`
  return null
}

/** Giá trị điền sẵn vào form khi sửa một lần trả. */
export function adjustFormValues(payment) {
  const info = adjustInfo(payment)
  if (!info || !info.label) return { adjust: ADJUST.none, interest: '', rateMode: 'keep' }
  const { prev, after, label } = info
  return { adjust: label, interest: label === ADJUST.interestOnly && after ? String(after.min_payment) : '', rateMode: label === ADJUST.interestOnly && after && after.apr !== prev.apr ? 'implied' : 'keep' }
}

export function reversePayment(debt, payment) {
  const back = payment.principal > 0 ? rebalance(debt, debt.balance + payment.principal) : { ...debt }
  try { // hoàn lại tiền trả/tháng và số tháng nếu lần trả này đã làm tool điều chỉnh
    const prev = payment.adjust_prev ? JSON.parse(payment.adjust_prev) : null
    if (prev) {
      back.min_payment = prev.min_payment; back.term_months = prev.term_months
      if (prev.repay_type !== undefined) back.repay_type = prev.repay_type // chuyển sang chỉ trả lãi: hoàn lại hình thức và lãi suất cũ
      if (prev.apr !== undefined) back.apr = prev.apr
    }
  } catch { /* dữ liệu cũ/hỏng: bỏ qua */ }
  return back
}

/** Trả { payment, debt } (bản ghi lịch sử + khoản nợ sau khi cập nhật) hoặc { error }. */
export function buildPayment({ debt, kind, type, amount, date, note = '', createdBy = 'me', adjust = ADJUST.none, adjustOpts = {}, id }) {
  const split = splitPayment({ type, amount, balance: debt.balance, apr: debt.apr })
  if (split.error) return { error: split.error }
  const { next, prev } = applyPayment(debt, split.principal, date, kind, adjust, adjustOpts)
  return {
    debt: next,
    payment: {
      id: id || newId(), date, source: kind, debt_id: debt.id, debt_name: debt.name, type,
      amount: r2(Number(amount)), principal: split.principal, interest: split.interest,
      balance_after: next.balance, note, created_by: createdBy, adjust_prev: prev ? JSON.stringify(prev) : '',
    },
  }
}

/** Dòng chi "Trả nợ" tương ứng trong sổ dòng tiền (khoản của Business -> sổ doanh nghiệp, còn lại -> sổ cá nhân). */
export function cashRowFor(debt, payment) {
  const kind = debt.owner === 'Business' ? 'business' : 'personal'
  const row = { id: newId(), date: payment.date, type: 'Expense', category: 'Trả nợ', amount: payment.amount, note: `Trả nợ: ${debt.name}`, created_by: payment.created_by, ref: '' }
  return { kind, row: kind === 'business' ? { ...row, counterparty: debt.lender || '', account: '' } : { ...row, account: '' } }
}

/**
 * Dư nợ "giả định": hoàn lại các lần trả bị bỏ tick (excludedIds) khỏi khoản nợ đang ghi nhận.
 * Hoàn từ lần trả mới nhất về cũ nhất; mỗi lần trả được hoàn cả phần gốc lẫn điều chỉnh đi kèm.
 * payments: theo thứ tự ghi (cũ → mới). Khoản nợ không bị ảnh hưởng thì trả về nguyên bản.
 */
export function effectiveDebts(debts, payments, excludedIds) {
  if (!excludedIds.length) return debts
  return debts.map((d) => {
    const undone = payments.filter((x) => x.debt_id === d.id && excludedIds.includes(x.id)).reverse()
    if (!undone.length) return d
    return undone.reduce((cur, x) => reversePayment(cur, x), d)
  })
}
