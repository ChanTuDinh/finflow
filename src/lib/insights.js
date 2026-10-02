// Phân tích pattern thu/chi hiện tại và gợi ý cải thiện kế hoạch trả nợ.
import { isInflow, isTransfer, isInterestOnly, DEBT_PAYMENT_CATEGORY } from './schema.js'
import { lastMonths, byMonth, expenseByCategory } from './calc.js'
import { simulate } from './forecast.js'
import { pct } from './format.js'

export function baselineFrom(rows, endYm, n = 3) {
  const ms = new Set(lastMonths(endYm, n))
  const inWin = rows.filter((r) => ms.has(r.date.slice(0, 7)))
  const income = inWin.filter(isInflow).reduce((s, r) => s + r.amount, 0) / n
  const expense = inWin.filter((r) => !isInflow(r) && !isTransfer(r) && r.category !== DEBT_PAYMENT_CATEGORY).reduce((s, r) => s + r.amount, 0) / n
  return { income, expense }
}

export function buildInsights({ rows, debts, endYm, money }) {
  const out = []
  const active = debts.filter((d) => d.status !== 'Paid' && d.balance > 0)
  const base = baselineFrom(rows, endYm)
  const minTotal = active.reduce((s, d) => s + d.min_payment, 0)
  const surplus = base.income - base.expense - minTotal

  if (base.income <= 0) return [{ level: 'info', text: 'Chưa đủ dữ liệu thu nhập 3 tháng gần nhất để phân tích.' }]

  const saveRate = (base.income - base.expense) / base.income
  out.push({ level: saveRate < 0.1 ? 'warn' : 'ok', text: `Tỷ lệ tiết kiệm trước trả nợ: ${pct(saveRate)} (thu ${money(base.income)}, chi ${money(base.expense)} / tháng).` })

  if (active.length) {
    const dsr = minTotal / base.income
    out.push({ level: dsr > 0.4 ? 'warn' : 'ok', text: `Tổng trả nợ tối thiểu chiếm ${pct(dsr)} thu nhập${dsr > 0.4 ? ' — cao hơn ngưỡng an toàn ~40%' : ''}.` })
  }

  // Xu hướng chi: 3 tháng gần nhất vs 3 tháng trước đó
  const recent = new Set(lastMonths(endYm, 3))
  const prev = new Set(lastMonths(endYm, 6).slice(0, 3))
  const cat = (set) => Object.fromEntries(expenseByCategory(rows.filter((r) => set.has(r.date.slice(0, 7)) && r.category !== DEBT_PAYMENT_CATEGORY)).map((e) => [e.category, e.amount / 3]))
  const cr = cat(recent), cp = cat(prev)
  const growth = Object.keys(cr)
    .map((k) => ({ k, delta: cr[k] - (cp[k] || 0), prev: cp[k] || 0 }))
    .filter((g) => g.prev > 0 && g.delta > 0 && g.delta / g.prev > 0.15)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
  for (const g of growth) out.push({ level: 'warn', text: `Chi "${g.k}" tăng ${money(g.delta)}/tháng (+${pct(g.delta / g.prev)}) so với 3 tháng trước — cắt lại có thể dồn vào trả nợ.` })

  const top = expenseByCategory(rows.filter((r) => recent.has(r.date.slice(0, 7)) && r.category !== DEBT_PAYMENT_CATEGORY))[0]
  if (top) out.push({ level: 'info', text: `Danh mục chi lớn nhất 3 tháng qua: "${top.category}" (${money(top.amount / 3)}/tháng).` })

  // Biến động thu nhập
  const inc = byMonth(rows.filter(isInflow)).slice(-6).map((e) => e.income)
  if (inc.length >= 4) {
    const mean = inc.reduce((s, v) => s + v, 0) / inc.length
    const sd = Math.sqrt(inc.reduce((s, v) => s + (v - mean) ** 2, 0) / inc.length)
    if (sd / mean > 0.3) out.push({ level: 'warn', text: `Thu nhập biến động mạnh (độ lệch ${pct(sd / mean)}). Nên đặt mức trả nợ theo thu nhập tháng thấp, không theo tháng cao.` })
  }

  if (active.length) {
    const worst = active.slice().sort((a, b) => b.apr - a.apr)[0]
    out.push({ level: 'info', text: `Khoản lãi cao nhất: "${worst.name}" (${worst.apr}%/năm, dư nợ ${money(worst.balance)}) — ưu tiên trả thêm vào khoản này (avalanche).` })

    const underwater = active.filter((d) => !isInterestOnly(d) && (d.balance * d.apr) / 1200 >= d.min_payment)
    for (const d of active.filter(isInterestOnly)) out.push({ level: 'info', text: `"${d.name}" chỉ trả lãi (${money(d.min_payment)}/tháng) nên dư nợ ${money(d.balance)} không giảm — trả thêm gốc khi có thể sẽ giảm tiền lãi hàng tháng.` })
    for (const d of underwater) out.push({ level: 'warn', text: `"${d.name}": mức trả tối thiểu ${money(d.min_payment)} không đủ trả lãi tháng (${money((d.balance * d.apr) / 1200)}) — dư nợ sẽ không giảm.` })

    if (surplus > 0) {
      const extra = Math.floor((surplus * 0.7) / 1000) * 1000
      const args = { debts, baseline: base, startYm: endYm, years: 5 }
      const a = simulate({ ...args, scenario: { mode: 'min', order: 'avalanche' } })
      const b = simulate({ ...args, scenario: { mode: 'extra', extra, order: 'avalanche' } })
      const saved = a.totalInterest - b.totalInterest
      out.push({ level: 'ok', text: `Thặng dư sau nợ tối thiểu ≈ ${money(surplus)}/tháng. Trả thêm ${money(extra)}/tháng (70%) → tiết kiệm ≈ ${money(saved)} tiền lãi${b.clearedAt ? `, hết nợ sau ${b.clearedAt} tháng` : ''}.` })
    } else {
      out.push({ level: 'warn', text: `Thu − chi − trả tối thiểu = ${money(surplus)}/tháng (âm). Cần giảm chi hoặc tăng thu trước khi trả nhanh; cân nhắc tái cấu trúc/thương lượng lãi.` })
    }
  }
  return out
}
