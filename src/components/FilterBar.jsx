import { useMemo } from 'react'
import { usePeriod } from '../lib/period.jsx'
import { useStore } from '../lib/store.jsx'
import { ALL, dataYears, GRAIN_LABEL, validGrains, yearPeriod } from '../lib/period.js'
import { quarterKey } from '../lib/format.js'
import { SelectField, Segmented, FilterRow } from './ui.jsx'

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

// Thanh bộ lọc dùng chung: [điều khiển riêng của tab] Năm · Quý · Tháng · (Xem theo).
// Chọn Năm/Quý/Tháng để lọc kỳ; "Xem theo" là đơn vị gom nhóm trong kỳ (chỉ tab có biểu đồ).
export default function FilterBar({ lead, action, grain: showGrain = false }) {
  const { period, setPeriod, grain, setGrain } = usePeriod()
  const { data } = useStore()
  const years = useMemo(() => {
    const ys = new Set(dataYears(data.personal, data.business, data.bm))
    ys.add(Number(new Date().toISOString().slice(0, 4)))
    return [...ys].sort((a, b) => b - a)
  }, [data])

  const isAll = period.level === 'all'
  const year = isAll ? 'all' : period.key.slice(0, 4)
  const quarter = period.level === 'quarter' ? period.key.slice(5) : period.level === 'month' ? quarterKey(`${period.key}-01`).slice(5) : ''
  const month = period.level === 'month' ? period.key.slice(5) : ''
  const qIdx = quarter ? Number(quarter.slice(1)) : 0
  const monthOptions = (qIdx ? MONTHS.slice((qIdx - 1) * 3, qIdx * 3) : MONTHS).map((m) => ({ value: m, label: `Tháng ${Number(m)}` }))

  const pickYear = (v) => {
    if (v === 'all') return setPeriod(ALL)
    if (period.level === 'quarter') setPeriod({ level: 'quarter', key: `${v}-${quarter}` }) // giữ quý/tháng khi đổi năm
    else if (period.level === 'month') setPeriod({ level: 'month', key: `${v}-${month}` })
    else setPeriod(yearPeriod(v))
  }
  const pickQuarter = (v) => setPeriod(v ? { level: 'quarter', key: `${year}-${v}` } : yearPeriod(year))
  const pickMonth = (v) => setPeriod(v ? { level: 'month', key: `${year}-${v}` } : quarter ? { level: 'quarter', key: `${year}-${quarter}` } : yearPeriod(year))

  return (
    <FilterRow>
      {lead}
      <SelectField label="Năm" value={year} onChange={pickYear} options={[{ value: 'all', label: 'Tất cả năm' }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} />
      <SelectField label="Quý" value={quarter} disabled={isAll} onChange={pickQuarter} options={[{ value: '', label: 'Cả năm' }, ...['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ value: q, label: q }))]} />
      <SelectField label="Tháng" value={month} disabled={isAll} onChange={pickMonth} options={[{ value: '', label: quarter ? 'Cả quý' : 'Cả năm' }, ...monthOptions]} />
      {showGrain && <Segmented label="Xem theo" value={grain} onChange={setGrain} options={validGrains(period).map((g) => ({ value: g, label: GRAIN_LABEL[g] }))} />}
      {action && <div className="ml-auto">{action}</div>}
    </FilterRow>
  )
}
