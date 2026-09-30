import { isInflow } from './schema.js'
import { monthKey, quarterKey } from './format.js'

// Gom theo kỳ. keyFn: monthKey | quarterKey. Trả về mảng sắp theo thời gian.
export function summarize(rows, keyFn) {
  const map = new Map()
  for (const r of rows) {
    if (!r.date) continue
    const k = keyFn(r.date)
    const e = map.get(k) || { period: k, income: 0, expense: 0 }
    if (isInflow(r)) e.income += r.amount
    else e.expense += r.amount
    map.set(k, e)
  }
  return [...map.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((e) => ({ ...e, net: e.income - e.expense }))
}

export const byMonth = (rows) => summarize(rows, monthKey)
export const byQuarter = (rows) => summarize(rows, quarterKey)

export function totals(rows) {
  const income = rows.filter(isInflow).reduce((s, r) => s + r.amount, 0)
  const expense = rows.filter((r) => !isInflow(r)).reduce((s, r) => s + r.amount, 0)
  return { income, expense, net: income - expense }
}

export function expenseByCategory(rows) {
  const m = {}
  for (const r of rows) if (!isInflow(r)) m[r.category || 'Khác'] = (m[r.category || 'Khác'] || 0) + r.amount
  return Object.entries(m).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

// Danh sách N tháng gần nhất kết thúc tại `endYm` (bao gồm)
export function lastMonths(endYm, n) {
  return Array.from({ length: n }, (_, i) => addMonths(endYm, i - n + 1))
}

// Gộp 2 nguồn theo tháng để so sánh cá nhân vs doanh nghiệp
export function compareByMonth(personal, business, months) {
  const p = new Map(byMonth(personal).map((e) => [e.period, e]))
  const b = new Map(byMonth(business).map((e) => [e.period, e]))
  return months.map((m) => ({
    period: m,
    personalNet: p.get(m)?.net || 0,
    businessNet: b.get(m)?.net || 0,
    personalIncome: p.get(m)?.income || 0,
    businessIncome: b.get(m)?.income || 0,
  }))
}
