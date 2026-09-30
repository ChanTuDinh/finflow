// Mô phỏng trả nợ theo tháng, lãi tính riêng từng khoản (APR/12, cộng dồn hàng tháng).
import { addMonths } from './calc.js'

/**
 * scenario = {
 *   id, name,
 *   mode: 'min' | 'extra' | 'pct',
 *   extra: số tiền trả thêm mỗi tháng (mode 'extra'),
 *   pct: 0..1, % thu nhập dành cho nợ (mode 'pct'),
 *   order: 'avalanche' (lãi cao trước) | 'snowball' (dư nợ nhỏ trước)
 * }
 * baseline = { income, expense } trung bình mỗi tháng (expense KHÔNG gồm tiền trả nợ)
 */
export function simulate({ debts, scenario, baseline, startYm, years = 5, incomeGrowth = 0 }) {
  const active = debts.filter((d) => d.status !== 'Paid' && d.balance > 0).map((d) => ({ ...d, bal: d.balance }))
  const months = years * 12
  const minTotal0 = active.reduce((s, d) => s + d.min_payment, 0)
  const priority = (a, b) => (scenario.order === 'snowball' ? a.bal - b.bal : b.apr - a.apr)

  const series = []
  let cumInterest = 0
  let cumPaid = 0
  let cash = 0
  const payoffMonth = {}
  const monthlyGrowth = Math.pow(1 + incomeGrowth, 1 / 12) - 1

  series.push({ month: 0, period: startYm, balance: sum(active), interest: 0, payment: 0, cumInterest: 0, cash: 0 })

  for (let m = 1; m <= months; m++) {
    const income = baseline.income * Math.pow(1 + monthlyGrowth, m)
    let interest = 0
    for (const d of active) {
      if (d.bal <= 0) continue
      const i = (d.bal * d.apr) / 100 / 12
      d.bal += i
      interest += i
    }
    const live = active.filter((d) => d.bal > 0.005)
    const minDue = live.reduce((s, d) => s + Math.min(d.min_payment, d.bal), 0)

    let budget
    if (scenario.mode === 'min') budget = minDue
    else if (scenario.mode === 'extra') budget = Math.max(minTotal0 + (scenario.extra || 0), minDue)
    else budget = Math.max(income * (scenario.pct || 0), minDue)

    let paid = 0
    for (const d of live) {
      const p = Math.min(d.min_payment, d.bal)
      d.bal -= p
      paid += p
    }
    if (scenario.mode !== 'min') {
      let extra = budget - paid
      for (const d of live.slice().sort(priority)) {
        if (extra <= 0.005) break
        const p = Math.min(extra, d.bal)
        d.bal -= p
        extra -= p
        paid += p
      }
    }
    for (const d of active) {
      if (d.bal <= 0.005) {
        d.bal = 0
        payoffMonth[d.id] ??= m
      }
    }

    cumInterest += interest
    cumPaid += paid
    cash += income - baseline.expense - paid
    series.push({ month: m, period: addMonths(startYm, m), balance: sum(active), interest, payment: paid, cumInterest, cash })
  }

  const clearedAt = series.find((s) => s.month > 0 && s.balance <= 0.5)?.month ?? null
  return { scenario, series, payoffMonth, clearedAt, totalInterest: cumInterest, totalPaid: cumPaid, endBalance: series.at(-1).balance, endCash: cash }
}

const sum = (ds) => ds.reduce((s, d) => s + d.bal, 0)

export function defaultScenarios(baseline, minTotal) {
  const surplus = Math.max(baseline.income - baseline.expense - minTotal, 0)
  return [
    { id: 'min', name: 'Trả tối thiểu', mode: 'min', order: 'avalanche' },
    { id: 'fast', name: 'Trả nhanh (thêm tiền/tháng)', mode: 'extra', extra: Math.round((surplus * 0.7) / 1000) * 1000, order: 'avalanche' },
    { id: 'pct', name: 'Trả theo % thu nhập', mode: 'pct', pct: 0.3, order: 'avalanche' },
  ]
}
