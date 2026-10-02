// Suy ra lãi suất năm (%) từ dư nợ và số tiền trả mỗi tháng. Lãi suất danh nghĩa (lãi tháng × 12),
// cùng quy ước với mô phỏng trả nợ (APR / 12 mỗi tháng).
import { REPAY } from './schema.js'

const payment = (P, i, n) => (i === 0 ? P / n : (P * i) / (1 - Math.pow(1 + i, -n)))

/**
 * type: REPAY.both (trả gốc và lãi, trả đều hàng tháng) | REPAY.interestOnly (mỗi tháng chỉ trả lãi)
 * Trả { apr } hoặc { error } (thông báo tiếng Việt).
 */
export function computeApr({ type, balance, payment: M, term }) {
  const P = Number(balance), pay = Number(M), n = Math.round(Number(term))
  if (!(P > 0)) return { error: 'Nhập dư nợ hiện tại' }
  if (!(pay > 0)) return { error: 'Nhập số tiền trả mỗi tháng' }

  if (type === REPAY.interestOnly) return { apr: round2((12 * pay * 100) / P) } // lãi tháng = P × r/12 = tiền trả

  if (!(n > 0)) return { error: 'Nhập số tháng còn lại của khoản vay' }
  if (pay * n < P - 0.5) return { error: `Trả ${n} tháng × mỗi tháng là chưa đủ trả hết dư nợ — kiểm tra lại số tiền, số tháng hoặc dư nợ` }
  if (Math.abs(pay * n - P) <= 0.5) return { apr: 0 }

  // payment(i) tăng theo i: tìm i (lãi tháng) sao cho payment(i) = pay bằng chia đôi
  let lo = 0, hi = 1
  while (payment(P, hi, n) < pay && hi < 1e4) hi *= 2
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (payment(P, mid, n) < pay) lo = mid
    else hi = mid
  }
  return { apr: round2(((lo + hi) / 2) * 12 * 100) }
}

const round2 = (x) => Math.round(x * 100) / 100

/**
 * Ngược lại với computeApr: biết dư nợ, lãi suất năm (%) và số tiền trả đều mỗi tháng (trả gốc và lãi, niên kim)
 * -> ước tính còn bao nhiêu tháng và tổng tiền lãi sẽ trả. Trả { months, totalInterest } hoặc { error }.
 */
export function estimateTerm({ balance, apr, payment: M }) {
  const P = Number(balance), r = Number(apr), pay = Number(M)
  if (!(P > 0) || !(pay > 0)) return { error: 'Nhập dư nợ và số tiền trả mỗi tháng' }
  if (!(r >= 0)) return { error: 'Nhập lãi suất' }
  const i = r / 1200
  if (i === 0) { const n = Math.ceil(P / pay - 1e-9); return { months: n, totalInterest: 0 } }
  const x = 1 - (P * i) / pay
  if (x <= 0) return { error: `Mỗi tháng chỉ trả ${Math.round(pay).toLocaleString('vi-VN')} nhưng riêng tiền lãi đã ≈ ${Math.round(P * i).toLocaleString('vi-VN')} — dư nợ sẽ không bao giờ giảm hết` }
  const n = -Math.log(x) / Math.log(1 + i)
  const months = Math.ceil(n - 1e-9)
  return { months, exact: n, totalInterest: Math.max(pay * n - P, 0) }
}

/**
 * Kịch bản trả gốc và lãi đều hàng tháng (niên kim) trong `months` tháng với lãi suất năm `apr` (%).
 * Trả { monthly, total, interest } (làm tròn đồng); dư nợ <= 0 -> toàn số 0.
 */
export function scenarioPayoff({ balance, apr, months }) {
  const P = Number(balance), n = Math.round(Number(months)), r = Number(apr)
  if (!(P > 0) || !(n > 0)) return { monthly: 0, total: 0, interest: 0 }
  const monthly = payment(P, r > 0 ? r / 1200 : 0, n)
  const total = monthly * n
  return { monthly: Math.round(monthly), total: Math.round(total), interest: Math.round(Math.max(total - P, 0)) }
}
