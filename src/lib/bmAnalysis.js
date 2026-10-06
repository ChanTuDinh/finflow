// Phân tích thu / chi của một sổ (dùng cho Ví BM): gom theo tag, lọc theo năm.
import { isInflow, isTransfer } from './schema.js'
import { tagBreakdown, pieSlices, parseTags } from './tags.js'

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

/**
 * Chi tiết của các tag đã chọn: phân theo DANH MỤC. keys = key các tag (tên tag, không phân biệt hoa thường) hoặc '__none' (chưa gắn tag).
 * Giao dịch nhiều tag chia đều tiền cho các tag, chỉ phần thuộc tag đã chọn được tính. pct = tỷ lệ trong phần đã chọn.
 * Trả { total, count, items: [{ category, amount, count, pct }] } (lớn nhất trước).
 */
export function categoriesForTags(rows, keys = []) {
  const want = new Set(keys.map((k) => (k === '__none' ? k : String(k).toLowerCase())))
  const m = new Map(), seen = new Set(), rowsHit = new Set()
  let total = 0
  rows.forEach((r, i) => {
    const amt = Number(r.amount) || 0
    const tags = parseTags(r.tag)
    const parts = tags.length ? tags.map((t) => [t.toLowerCase(), amt / tags.length]) : [['__none', amt]]
    const cat = (r.category || '').trim() || '(không có danh mục)'
    for (const [k, share] of parts) {
      if (!want.has(k)) continue
      const e = m.get(cat) || { category: cat, amount: 0, count: 0 }
      e.amount += share; total += share; rowsHit.add(r.id ?? i)
      if (!seen.has(`${cat}|${r.id ?? i}`)) { seen.add(`${cat}|${r.id ?? i}`); e.count++ }
      m.set(cat, e)
    }
  })
  const items = [...m.values()].map((e) => ({ ...e, amount: Math.round(e.amount) })).sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'vi')).map((e) => ({ ...e, pct: total > 0 ? e.amount / total : 0 }))
  return { total: Math.round(total), count: rowsHit.size, items }
}
