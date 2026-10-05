import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { tagBreakdown } from '../lib/tags.js'

const pctLabel = (p) => `${(p * 100).toFixed(1)}%`

/** Dropdown "Phân tích chi tiêu cá nhân": số tiền chi và % theo tag, trên các dòng chi đang được tính (đúng kỳ lọc và đang tick). */
export default function TagAnalysis({ rows }) {
  const { money } = useStore()
  const [open, setOpen] = useState(false) // mặc định đóng
  const b = tagBreakdown(rows)
  const multi = rows.some((r) => String(r.tag ?? '').includes(','))
  const line = (key, label, amount, count, pct, muted) => (
    <tr key={key} className="border-t border-slate-100">
      <td className={`py-1.5 pr-3 font-medium ${muted ? 'text-slate-500' : ''}`}>{label}</td>
      <td className="pr-3 text-right whitespace-nowrap text-red-600">{money(amount)}</td>
      <td className="pr-3 text-right whitespace-nowrap">{pctLabel(pct)}</td>
      <td className="pr-3 w-40 sm:w-64">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${muted ? 'bg-slate-300' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
      </td>
      <td className="text-right text-slate-500">{count}</td>
    </tr>
  )
  return (
    <section className="space-y-2">
      <div className="flex cursor-pointer select-none items-baseline justify-between gap-2 rounded-lg px-1 py-1 hover:bg-slate-100" onClick={() => setOpen((v) => !v)}>
        <h3 className="font-semibold text-slate-700">
          <span className="mr-1 inline-block w-4 text-slate-400">{open ? '▾' : '▸'}</span>🏷 Phân tích chi tiêu cá nhân
          <span className="ml-2 text-xs font-normal text-slate-400">theo tag · {b.items.length} tag</span>
        </h3>
        <span className="text-sm font-medium text-red-600">{money(b.total)}</span>
      </div>
      {open && (
        <div className="card">
          {b.count === 0
            ? <div className="text-sm text-slate-400">Chưa có khoản chi nào trong kỳ đang chọn.</div>
            : <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500"><tr><th className="py-1 pr-3">Tag</th><th className="pr-3 text-right">Số tiền chi</th><th className="pr-3 text-right">% tổng chi</th><th className="pr-3" /><th className="text-right">Số GD</th></tr></thead>
                    <tbody>
                      {b.items.map((x) => line(x.tag, x.tag, x.amount, x.count, x.pct, false))}
                      {b.untagged.count > 0 && line('__none', 'Chưa gắn tag', b.untagged.amount, b.untagged.count, b.untagged.pct, true)}
                      <tr className="border-t border-slate-300 font-semibold">
                        <td className="py-1.5 pr-3">Tổng chi</td>
                        <td className="pr-3 text-right whitespace-nowrap text-red-600">{money(b.total)}</td>
                        <td className="pr-3 text-right">100%</td><td /><td className="text-right text-slate-500">{b.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Theo kỳ lọc Năm / Quý / Tháng phía trên và chỉ các dòng đang tick; tổng chi khớp thẻ "Chi".
                  {multi && ' Giao dịch có nhiều tag được tính đủ số tiền cho từng tag nên tổng % các tag có thể vượt 100%.'}
                </div>
              </>}
        </div>)}
    </section>
  )
}
