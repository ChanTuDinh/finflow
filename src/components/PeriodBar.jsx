import { usePeriod } from '../lib/period.jsx'
import { ALL, crumbs, labelOf, shift } from '../lib/period.js'

// Breadcrumb Tất cả › Năm › Quý › Tháng (bấm để lên cấp) + nút ‹ › chuyển kỳ liền kề.
export default function PeriodBar() {
  const { period, setPeriod } = usePeriod()
  const trail = crumbs(period)
  const can = period.level !== 'all'
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <button className="btn-ghost !px-2.5" disabled={!can} onClick={() => setPeriod(shift(period, -1))} aria-label="Kỳ trước">‹</button>
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {trail.map((c, i) => (
          <span key={c.level} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">›</span>}
            <button onClick={() => setPeriod(c)} className={`px-2 py-1 rounded-md ${c === period ? 'bg-slate-900 text-white' : 'hover:bg-slate-200'}`}>{labelOf(c)}</button>
          </span>
        ))}
      </div>
      <button className="btn-ghost !px-2.5" disabled={!can} onClick={() => setPeriod(shift(period, 1))} aria-label="Kỳ sau">›</button>
      {period !== ALL && <span className="text-xs text-slate-400 w-full sm:w-auto">Bấm cột/dòng trong Báo cáo để xem chi tiết kỳ con</span>}
    </div>
  )
}
