// Phân tích thu / chi của một sổ (dùng cho Ví BM): gom theo tag, lọc theo năm.
import { isInflow, isTransfer } from './schema.js'
import { tagBreakdown, pieSlices } from './tags.js'

/** Các năm có dữ liệu, mới nhất trước: ['2026', '2025'] */
export const yearsOf = (rows) => [...new Set(rows.filter((r) => r.date).map((r) => r.date.slice(0, 4)))].sort().reverse()

/** Lọc theo năm ('all' = tất cả) và bỏ chuyển khoản nội bộ. */
export const forYear = (rows, year = 'all') => rows.filter((r) => r.date && !isTransfer(r) && (year === 'all' || r.date.startsWith(year)))

/**
 * Gom các dòng theo TAG thành các lát biểu đồ tròn: tối đa maxSlices lát (các tag lớn nhất; tag nhỏ hơn gộp một lát "rest" kèm children; dòng chưa gắn tag là lát "none").
 * Giao dịch nhiều tag được chia đều tiền cho các tag đó (để tổng các lát = tổng).
 * Trả { total, count, slices: [{ key, kind: 'tag' | 'rest' | 'none', name, amount, pct, count, children? }] }.
 */
export function tagSlices(rows, maxTags = 7) {
  const b = tagBreakdown(rows)
  return { total: b.total, count: b.count, slices: b.total > 0 ? pieSlices(b, maxTags) : [] }
}

/** Tổng thu / chi / ròng và hai bộ lát cho biểu đồ tròn. */
export function analyze(rows, year = 'all') {
  const rs = forYear(rows, year)
  const inc = rs.filter(isInflow), exp = rs.filter((r) => !isInflow(r))
  const income = tagSlices(inc), expense = tagSlices(exp)
  return { income, expense, net: income.total - expense.total }
}
