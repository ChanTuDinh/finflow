// Phân tích thu / chi của một sổ (dùng cho Ví BM): gom theo danh mục, lọc theo năm.
import { isInflow, isTransfer } from './schema.js'

/** Các năm có dữ liệu, mới nhất trước: ['2026', '2025'] */
export const yearsOf = (rows) => [...new Set(rows.filter((r) => r.date).map((r) => r.date.slice(0, 4)))].sort().reverse()

/** Lọc theo năm ('all' = tất cả) và bỏ chuyển khoản nội bộ. */
export const forYear = (rows, year = 'all') => rows.filter((r) => r.date && !isTransfer(r) && (year === 'all' || r.date.startsWith(year)))

/**
 * Gom các dòng theo danh mục thành các lát biểu đồ tròn: tối đa maxSlices danh mục lớn nhất, phần còn lại gộp một lát "rest" (kèm children).
 * Trả { total, count, slices: [{ key, kind: 'cat' | 'rest', name, amount, pct, count, children? }] }.
 */
export function categorySlices(rows, maxSlices = 7) {
  const m = new Map()
  let total = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    const name = (r.category || '').trim() || '(không có danh mục)'
    const e = m.get(name) || { key: name, kind: 'cat', name, amount: 0, count: 0 }
    e.amount += amt; e.count++; total += amt
    m.set(name, e)
  }
  const all = [...m.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'vi')).map((e) => ({ ...e, pct: total > 0 ? e.amount / total : 0 }))
  if (all.length <= maxSlices) return { total, count: rows.length, slices: all }
  const head = all.slice(0, maxSlices - 1), tail = all.slice(maxSlices - 1)
  const rest = { key: '__rest', kind: 'rest', name: `Các danh mục nhỏ khác (${tail.length})`, amount: tail.reduce((a, x) => a + x.amount, 0), count: tail.reduce((a, x) => a + x.count, 0), children: tail }
  rest.pct = total > 0 ? rest.amount / total : 0
  return { total, count: rows.length, slices: [...head, rest] }
}

/** Tổng thu / chi / ròng và hai bộ lát cho biểu đồ tròn. */
export function analyze(rows, year = 'all') {
  const rs = forYear(rows, year)
  const inc = rs.filter(isInflow), exp = rs.filter((r) => !isInflow(r))
  const income = categorySlices(inc), expense = categorySlices(exp)
  return { income, expense, net: income.total - expense.total }
}
