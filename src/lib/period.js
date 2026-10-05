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

// "Xem theo" (grain): đơn vị gom nhóm trong kỳ đang chọn.
export const GRAIN_LABEL = { day: 'Ngày', month: 'Tháng', quarter: 'Quý', year: 'Năm' }
const DEFAULT_GRAIN = { all: 'year', year: 'quarter', quarter: 'month', month: 'day' }
const VALID_GRAINS = { all: ['month', 'quarter', 'year'], year: ['month', 'quarter'], quarter: ['month'], month: ['day'] }
export const defaultGrain = (p) => DEFAULT_GRAIN[p.level]
export const validGrains = (p) => VALID_GRAINS[p.level]
// chosen: lựa chọn của người dùng (có thể không còn hợp lệ với kỳ mới) -> mặc định là cấp con liền kề
export const resolveGrain = (p, chosen) => (VALID_GRAINS[p.level].includes(chosen) ? chosen : DEFAULT_GRAIN[p.level])

export function grainKeyFn(grain) {
  if (grain === 'year') return (iso) => iso.slice(0, 4)
  if (grain === 'quarter') return quarterKey
  if (grain === 'month') return monthKey
  return (iso) => iso
}
export const childKeyFn = (p, grain = defaultGrain(p)) => grainKeyFn(grain)

// Các tháng (yyyy-mm) nằm trong kỳ. 'all': từ tháng 1 của năm đầu đến tháng 12 của năm cuối có dữ liệu.
function monthsOf(p, years) {
  const fill = (y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
  if (p.level === 'all') {
    if (!years.length) return []
    const lo = Math.min(...years), hi = Math.max(...years)
    return Array.from({ length: hi - lo + 1 }, (_, i) => fill(lo + i)).flat()
  }
  if (p.level === 'year') return fill(p.key)
  if (p.level === 'quarter') return fill(p.key.slice(0, 4)).slice((Number(p.key.slice(6)) - 1) * 3, Number(p.key.slice(6)) * 3)
  return [p.key]
}

// Danh sách kỳ theo grain (lấp số 0 cho kỳ trống). years: các năm có dữ liệu (dùng cho level 'all').
export function childKeys(p, years = [], grain = defaultGrain(p)) {
  if (grain === 'day') {
    const [y, m] = p.key.split('-').map(Number)
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return Array.from({ length: days }, (_, i) => `${p.key}-${String(i + 1).padStart(2, '0')}`)
  }
  const months = monthsOf(p, years)
  if (grain === 'month') return months
  return [...new Set(months.map((m) => (grain === 'quarter' ? quarterKey(`${m}-01`) : m.slice(0, 4))))]
}

// Số tháng trong kỳ (dùng ước tính lãi). 'all': số tháng có dữ liệu.
export function monthsIn(p, rows = []) {
  if (p.level === 'month') return 1
  if (p.level === 'quarter') return 3
  if (p.level === 'year') return 12
  return new Set(rows.filter((r) => r.date).map((r) => r.date.slice(0, 7))).size
}

// Số tháng từ tháng đầu đến tháng cuối có giao dịch (tính cả tháng trống ở giữa) — mẫu số cho trung bình / tháng
export function spanMonths(rows = []) {
  const ms = rows.filter((r) => r.date).map((r) => Number(r.date.slice(0, 4)) * 12 + Number(r.date.slice(5, 7)) - 1)
  return ms.length ? Math.max(...ms) - Math.min(...ms) + 1 : 0
}

// Khoảng tháng dùng làm mẫu số: { from: 'yyyy-mm', to: 'yyyy-mm' } (tháng của giao dịch sớm nhất và muộn nhất), hoặc null nếu không có dòng nào
export function spanRange(rows = []) {
  const ds = rows.filter((r) => r.date).map((r) => r.date.slice(0, 7)).sort()
  return ds.length ? { from: ds[0], to: ds[ds.length - 1] } : null
}
export const monthLabelShort = (ym) => `T${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`

export const dataYears = (...rowSets) => [...new Set(rowSets.flat().filter((r) => r.date).map((r) => Number(r.date.slice(0, 4))))].sort()

// Gom rows theo kỳ con của p, lấp 0 cho kỳ trống: [{ period, income, expense, net }]
export function breakdown(rows, p, years, grain = defaultGrain(p)) {
  const inP = rows.filter((r) => inPeriod(p, r.date))
  const map = new Map(summarize(inP, grainKeyFn(grain)).map((e) => [e.period, e]))
  return childKeys(p, years ?? dataYears(rows), grain).map((k) => map.get(k) || { period: k, income: 0, expense: 0, net: 0 })
}
