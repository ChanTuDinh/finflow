// Mô phỏng tích lũy: lãi kép hàng tháng (annual_return/12) + góp đều hàng tháng.
import { simulate } from './forecast.js'
import { addMonths } from './calc.js'

export const activeAccounts = (accounts) => accounts.filter((a) => a.status !== 'Closed')

/** scenario = { returnDelta: điểm % cộng vào lãi suất từng tài khoản, contribMult: hệ số nhân mức góp } */
export function projectSavings({ accounts, scenario = {}, startYm, years = 5 }) {
  const { returnDelta = 0, contribMult = 1 } = scenario
  const accs = activeAccounts(accounts).map((a) => ({
    bal: a.balance,
    rate: Math.max((a.annual_return + returnDelta) / 1200, -0.5),
    add: a.monthly_contribution * contribMult,
  }))
  const total = () => accs.reduce((s, a) => s + a.bal, 0)
  const series = [{ month: 0, period: startYm, balance: total(), interest: 0, payment: 0, cumInterest: 0, cash: 0 }]
  let cum = 0, contributed = 0
  for (let m = 1; m <= years * 12; m++) {
    let gain = 0, put = 0
    for (const a of accs) {
      const g = a.bal * a.rate
      a.bal += g + a.add
      gain += g
      put += a.add
    }
    cum += gain
    contributed += put
    series.push({ month: m, period: addMonths(startYm, m), balance: total(), interest: gain, payment: put, cumInterest: cum, cash: 0 })
  }
  return { scenario, series, start: series[0].balance, end: series.at(-1).balance, contributed, gain: cum }
}

export function monthsUntil(startYm, isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}/.test(isoDate)) return null
  return (Number(isoDate.slice(0, 4)) - Number(startYm.slice(0, 4))) * 12 + Number(isoDate.slice(5, 7)) - Number(startYm.slice(5, 7))
}

// Số tiền cần góp mỗi tháng để từ `balance` đạt `target` sau n tháng với lãi suất năm `ratePct`.
export function requiredMonthly({ balance, target, ratePct, months }) {
  if (balance >= target) return 0
  if (months <= 0) return target - balance
  const i = ratePct / 1200
  const growth = Math.pow(1 + i, months)
  const shortfall = target - balance * growth
  if (shortfall <= 0) return 0
  return i === 0 ? shortfall / months : (shortfall * i) / (growth - 1)
}

/** Tiến độ một mục tiêu dựa trên các tài khoản gắn goal_id. */
export function goalStatus({ goal, accounts, startYm, scenario = {}, maxMonths = 600 }) {
  const linked = activeAccounts(accounts).filter((a) => a.goal_id === goal.id)
  const balance = linked.reduce((s, a) => s + a.balance, 0)
  const contrib = linked.reduce((s, a) => s + a.monthly_contribution, 0)
  const ratePct = balance > 0
    ? linked.reduce((s, a) => s + a.balance * a.annual_return, 0) / balance
    : linked.length ? linked.reduce((s, a) => s + a.annual_return, 0) / linked.length : 0
  const months = monthsUntil(startYm, goal.target_date)

  let eta = null
  if (balance >= goal.target_amount) eta = 0
  else if (linked.length) {
    const r = projectSavings({ accounts: linked, scenario, startYm, years: maxMonths / 12 })
    eta = r.series.find((s) => s.balance >= goal.target_amount)?.month ?? null
  }
  const required = goal.target_date ? requiredMonthly({ balance, target: goal.target_amount, ratePct, months: months ?? 0 }) : null
  return {
    linked, balance, contrib, ratePct, eta, months, required,
    pct: goal.target_amount > 0 ? Math.min(balance / goal.target_amount, 1) : 0,
    onTrack: eta != null && (months == null || eta <= months),
  }
}

/**
 * Cùng một ngân sách hàng tháng (tổng tối thiểu + extra):
 *  A) Trả nợ nhanh trước: dồn extra vào nợ, phần còn dư (kể cả sau khi hết nợ) vào tích lũy.
 *  B) Tích lũy trước: chỉ trả tối thiểu, phần còn lại vào tích lũy.
 * So sánh tài sản ròng = quỹ tích lũy (từ khoản extra) − dư nợ.
 */
export function compareDebtVsSave({ debts, baseline, startYm, years = 5, extra, saveReturn, order = 'avalanche' }) {
  const active = debts.filter((d) => d.status !== 'Paid' && d.balance > 0)
  const budget = active.reduce((s, d) => s + d.min_payment, 0) + extra
  const i = saveReturn / 1200
  const run = (scenario) => {
    const sim = simulate({ debts, scenario: { ...scenario, order }, baseline, startYm, years })
    let save = 0, put = 0
    const pts = sim.series.map((s) => {
      if (s.month > 0) { const add = Math.max(budget - s.payment, 0); save = save * (1 + i) + add; put += add }
      return { period: s.period, debt: s.balance, save, net: save - s.balance }
    })
    return { sim, pts, endSave: save, contributed: put, saveGain: save - put, endNet: save - sim.endBalance }
  }
  const pay = run({ mode: 'extra', extra })
  const save = run({ mode: 'min' })
  return {
    pay, save, hasDebt: active.length > 0,
    series: pay.pts.map((p, k) => ({ period: p.period, netPay: p.net, netSave: save.pts[k].net, debtPay: p.debt, debtSave: save.pts[k].debt })),
    diff: pay.endNet - save.endNet, // >0: trả nợ trước có lợi hơn
  }
}
