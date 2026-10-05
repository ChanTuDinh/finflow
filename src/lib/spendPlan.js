// Forecast chi tiêu cá nhân: chia thu nhập trung bình theo tỷ lệ từng quỹ (Need, Want, ...).
import { tagBreakdown } from './tags.js'
// Forecast cho 5 năm dương lịch kể từ năm hiện tại (mỗi năm đủ 12 tháng T1–T12)
export const YEARS_AHEAD = 5

export const BUCKETS = [
  { key: 'need', name: 'Need', pct: 60, color: '#2a78d6' },
  { key: 'want', name: 'Want', pct: 10, color: '#eb6834' },
  { key: 'edu', name: 'Edu', pct: 10, color: '#1baf7a' },
  { key: 'reserve', name: 'Reserve', pct: 10, color: '#eda100' },
  { key: 'investment', name: 'Investment', pct: 5, color: '#e87ba4' },
  { key: 'giving', name: 'Giving', pct: 5, color: '#008300' },
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

/** Thu nhập trung bình / tháng dự kiến của một năm. Dữ liệu cũ (một số chung `monthlyIncome`) được coi là của năm hiện tại. */
export function incomeForYear(saved, year, currentYear) {
  const v = saved?.incomeByYear?.[year]
  if (v !== undefined && v !== null && v !== '') return Math.max(0, Number(v) || 0)
  return String(year) === String(currentYear) ? Math.max(0, Number(saved?.monthlyIncome) || 0) : 0
}

/** Bản forecast: mỗi tháng một dòng { month, amounts, total, cumulative }. incomeOf(year) -> thu nhập trung bình / tháng của năm đó. */
export function buildPlan(incomeOf, pcts, startMonth, n = 12) {
  const per = {} // cache theo năm
  let cum = 0
  const months = monthList(startMonth, n).map((month) => {
    const y = month.slice(0, 4)
    per[y] = per[y] || allocate(Math.max(0, Number(incomeOf(y)) || 0), pcts)
    const amounts = per[y]
    const total = Object.values(amounts).reduce((a, b) => a + b, 0)
    cum += total
    return { month, amounts, total, cumulative: cum }
  })
  return { months, total: cum }
}

/** Lọc các dòng chi thực tế theo bộ lọc của board forecast: years (khi year = 'all'), year, month, untilMonth (mỗi năm chỉ lấy từ T1 đến hết tháng đó). */
export function filterActual(rows, { years = [], year = 'all', month = 'all', untilMonth = '' } = {}) {
  return rows.filter((r) => {
    const y = (r.date || '').slice(0, 4), m = (r.date || '').slice(5, 7)
    if (year === 'all' ? !years.includes(y) : y !== year) return false
    if (month !== 'all' && m !== month) return false
    if (untilMonth && Number(m) > Number(untilMonth)) return false
    return true
  })
}

/**
 * Chi tiêu THỰC TẾ theo quỹ: rows = các dòng chi cá nhân (đã loại Trả nợ, Chuyển ví, chuyển khoản), danh mục trùng tên quỹ (Need, Want, ...).
 * Bộ lọc như `filterActual`. Danh mục khác (dòng cũ chưa phân quỹ) vào `unassigned`. Trả { per, unassigned, total, count }.
 */
export function actualByFund(rows, opts = {}) {
  const per = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]))
  const byName = Object.fromEntries(BUCKETS.map((b) => [b.name, b.key]))
  let unassigned = 0, count = 0
  for (const r of filterActual(rows, opts)) {
    const amt = Number(r.amount) || 0
    const k = byName[r.category]
    if (k) per[k] += amt; else unassigned += amt
    count++
  }
  return { per, unassigned, total: Object.values(per).reduce((a, b) => a + b, 0) + unassigned, count }
}

/** Các tag con của một quỹ (fundKey = key quỹ, hoặc '__un' = chưa phân quỹ): cùng định dạng `tagBreakdown` (số tiền, % trên tổng của quỹ đó). */
export function actualFundTags(rows, opts, fundKey) {
  const names = Object.fromEntries(BUCKETS.map((b) => [b.name, b.key]))
  const inFund = filterActual(rows, opts).filter((r) => (fundKey === '__un' ? !names[r.category] : names[r.category] === fundKey))
  return tagBreakdown(inFund)
}
