// Forecast chi tiêu cá nhân: chia thu nhập trung bình theo tỷ lệ từng quỹ (Need, Want, ...).
export const BUCKETS = [
  { key: 'need', name: 'Need', pct: 60 },
  { key: 'want', name: 'Want', pct: 10 },
  { key: 'edu', name: 'Edu', pct: 10 },
  { key: 'reserve', name: 'Reserve', pct: 10 },
  { key: 'investment', name: 'Investment', pct: 5 },
  { key: 'giving', name: 'Giving', pct: 5 },
]

/** Tỷ lệ đang dùng: lấy giá trị đã lưu (nếu hợp lệ), thiếu thì dùng mặc định. -> { need: 60, ... } */
export function resolvePcts(saved) {
  const out = {}
  for (const b of BUCKETS) {
    const v = Number(saved?.[b.key])
    out[b.key] = Number.isFinite(v) && v >= 0 ? v : b.pct
  }
  return out
}

export const sumPcts = (pcts) => Math.round(BUCKETS.reduce((s, b) => s + (pcts[b.key] || 0), 0) * 100) / 100

/** Chia một số tiền theo tỷ lệ; làm tròn đồng, phần lệch do làm tròn dồn vào quỹ lớn nhất để tổng khớp khi tỷ lệ = 100%. */
export function allocate(amount, pcts) {
  const out = {}
  let used = 0
  for (const b of BUCKETS) { out[b.key] = Math.round((amount * (pcts[b.key] || 0)) / 100); used += out[b.key] }
  if (sumPcts(pcts) === 100) {
    const big = BUCKETS.reduce((m, b) => ((pcts[b.key] || 0) > (pcts[m.key] || 0) ? b : m), BUCKETS[0])
    out[big.key] += Math.round(amount) - used
  }
  return out
}

/** Danh sách n tháng 'yyyy-mm' bắt đầu từ startMonth. */
export function monthList(startMonth, n = 12) {
  let [y, m] = startMonth.split('-').map(Number)
  const out = []
  for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++ } }
  return out
}

/** Bản forecast: mỗi tháng một dòng { month, amounts, total }, cộng cả kỳ ở totals. */
export function buildPlan(monthlyIncome, pcts, startMonth, n = 12) {
  const income = Math.max(0, Number(monthlyIncome) || 0)
  const per = allocate(income, pcts)
  const months = monthList(startMonth, n).map((month) => ({ month, amounts: per, total: Object.values(per).reduce((a, b) => a + b, 0) }))
  const totals = {}
  for (const b of BUCKETS) totals[b.key] = per[b.key] * n
  return { per, months, totals, total: months.reduce((s, r) => s + r.total, 0) }
}
