// Kỳ đang xem: { level: 'all'|'year'|'quarter'|'month', key }
// key: '' (all) | '2026' | '2026-Q3' | '2026-09'. Logic thuần, không phụ thuộc React.
import { addMonths, summarize } from './calc.js'
import { monthKey, quarterKey } from './format.js'

export const ALL = { level: 'all', key: '' }
export const yearPeriod = (y) => ({ level: 'year', key: String(y) })
export const currentPeriod = (today = new Date().toISOString().slice(0, 10)) => yearPeriod(today.slice(0, 4))

// '2026' | '2026-Q3' | '2026-09' -> period; khác (vd. một ngày) -> null
export function fromKey(key) {
  if (/^\d{4}$/.test(key)) return { level: 'year', key }
  if (/^\d{4}-Q[1-4]$/.test(key)) return { level: 'quarter', key }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return { level: 'month', key }
  return null
}

export function inPeriod(p, iso) {
  if (!iso) return false
  switch (p.level) {
    case 'all': return true
    case 'year': case 'month': return iso.startsWith(p.key)
    default: return quarterKey(iso) === p.key
  }
}

export function parent(p) {
  if (p.level === 'month') return { level: 'quarter', key: quarterKey(`${p.key}-01`) }
  if (p.level === 'quarter') return { level: 'year', key: p.key.slice(0, 4) }
  return ALL
}

// Từ "Tất cả" đến kỳ hiện tại, vd. [ALL, 2026, 2026-Q3, 2026-09]
export function crumbs(p) {
  const out = [p]
  while (out[0].level !== 'all') out.unshift(parent(out[0]))
  return out
}

export function labelOf(p) {
  if (p.level === 'all') return 'Tất cả năm'
  if (p.level === 'year') return p.key
  if (p.level === 'quarter') return p.key.slice(5)
  return `Tháng ${Number(p.key.slice(5))}`
}

export const levelName = { all: 'Tất cả năm', year: 'Năm', quarter: 'Quý', month: 'Tháng' }

export function shift(p, d) {
  if (p.level === 'year') return yearPeriod(Number(p.key) + d)
  if (p.level === 'month') return { level: 'month', key: addMonths(p.key, d) }
  if (p.level === 'quarter') {
    const y = Number(p.key.slice(0, 4)), idx = y * 4 + (Number(p.key.slice(6)) - 1) + d
    return { level: 'quarter', key: `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}` }
  }
  return p
}

// Hàm gom nhóm theo kỳ con: all -> năm, năm -> quý, quý -> tháng, tháng -> ngày
export function childKeyFn(p) {
  if (p.level === 'all') return (iso) => iso.slice(0, 4)
  if (p.level === 'year') return quarterKey
  if (p.level === 'quarter') return monthKey
  return (iso) => iso
}

// Danh sách kỳ con (lấp số 0 cho kỳ trống). years: các năm có dữ liệu (dùng cho level 'all').
export function childKeys(p, years = []) {
  if (p.level === 'all') {
    if (!years.length) return []
    const lo = Math.min(...years), hi = Math.max(...years)
    return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))
  }
  if (p.level === 'year') return [1, 2, 3, 4].map((q) => `${p.key}-Q${q}`)
  if (p.level === 'quarter') {
    const y = p.key.slice(0, 4), q = Number(p.key.slice(6))
    return [0, 1, 2].map((i) => `${y}-${String((q - 1) * 3 + i + 1).padStart(2, '0')}`)
  }
  const [y, m] = p.key.split('-').map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: days }, (_, i) => `${p.key}-${String(i + 1).padStart(2, '0')}`)
}

// Số tháng trong kỳ (dùng ước tính lãi). 'all': số tháng có dữ liệu.
export function monthsIn(p, rows = []) {
  if (p.level === 'month') return 1
  if (p.level === 'quarter') return 3
  if (p.level === 'year') return 12
  return new Set(rows.filter((r) => r.date).map((r) => r.date.slice(0, 7))).size
}

export const dataYears = (...rowSets) => [...new Set(rowSets.flat().filter((r) => r.date).map((r) => Number(r.date.slice(0, 4))))].sort()

// Gom rows theo kỳ con của p, lấp 0 cho kỳ trống: [{ period, income, expense, net }]
export function breakdown(rows, p, years) {
  const inP = rows.filter((r) => inPeriod(p, r.date))
  const map = new Map(summarize(inP, childKeyFn(p)).map((e) => [e.period, e]))
  return childKeys(p, years ?? dataYears(rows)).map((k) => map.get(k) || { period: k, income: 0, expense: 0, net: 0 })
}
