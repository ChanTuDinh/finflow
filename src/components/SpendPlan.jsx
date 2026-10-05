import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { BUCKETS, resolvePcts, sumPcts, buildPlan } from '../lib/spendPlan.js'
import { todayIso } from '../lib/format.js'

const num = (v) => (v === '' ? 0 : Number(String(v).replace(/[^\d.]/g, '')) || 0)

/** Chi tiêu cá nhân forecast (cuối trang Ví cá nhân): nhập thu nhập trung bình, chia theo tỷ lệ từng quỹ, ra bảng 12 tháng. */
export default function SpendPlan({ actualMonthly = 0 }) {
  const { settings, setSettings, money } = useStore()
  const [open, setOpen] = useState(false)
  const saved = settings.spendPlan || {}
  const income = Number(saved.monthlyIncome) || 0
  const pcts = resolvePcts(saved.pcts)
  const total = sumPcts(pcts)
  const plan = buildPlan(income, pcts, todayIso().slice(0, 7))
  const patch = (p) => setSettings((s) => ({ ...s, spendPlan: { ...(s.spendPlan || {}), ...p } }))
  const setPct = (key, v) => patch({ pcts: { ...pcts, [key]: v === '' ? 0 : Math.max(0, Number(v) || 0) } })

  return (
    <section className="space-y-2">
      <div className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-slate-100" onClick={() => setOpen((v) => !v)}>
        <h3 className="flex items-center gap-2 font-semibold text-slate-700">
          <span className="inline-block w-4 text-slate-400">{open ? '▾' : '▸'}</span>📊 Chi tiêu cá nhân forecast
          {!open && income > 0 && <span className="text-xs font-normal text-slate-400">Thu nhập {money(income)}/tháng · Need {money(plan.per.need)}/tháng</span>}
        </h3>
      </div>
      {open && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">Thu nhập trung bình / tháng
              <input className="input mt-1" inputMode="numeric" value={income || ''} placeholder="0" onChange={(e) => patch({ monthlyIncome: num(e.target.value) })} />
            </label>
            <label className="text-sm">Thu nhập trung bình / năm
              <input className="input mt-1" inputMode="numeric" value={income ? income * 12 : ''} placeholder="0" onChange={(e) => patch({ monthlyIncome: Math.round(num(e.target.value) / 12) })} />
            </label>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            Nhập tháng hoặc năm đều được (năm = tháng × 12).
            {actualMonthly > 0 && <button className="text-blue-600" onClick={() => patch({ monthlyIncome: actualMonthly })}>Lấy từ dữ liệu thực tế: {money(actualMonthly)}/tháng</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500"><tr><th className="py-1 pr-3">TT</th><th className="pr-3">Quỹ</th><th className="pr-3">% đề xuất</th><th className="pr-3 text-right">/ tháng</th><th className="text-right">/ năm</th></tr></thead>
              <tbody>
                {BUCKETS.map((b, i) => (
                  <tr key={b.key} className="border-t border-slate-100">
                    <td className="py-1 pr-3">{i + 1}</td>
                    <td className="pr-3 font-medium">{b.name}</td>
                    <td className="pr-3"><input className="input !w-20" inputMode="decimal" value={pcts[b.key]} onChange={(e) => setPct(b.key, e.target.value)} /></td>
                    <td className="pr-3 text-right">{money(plan.per[b.key])}</td>
                    <td className="text-right">{money(plan.totals[b.key])}</td>
                  </tr>))}
                <tr className="border-t border-slate-300 font-semibold">
                  <td /><td>Tổng</td>
                  <td className={total === 100 ? '' : 'text-red-600'}>{total}%</td>
                  <td className="pr-3 text-right">{money(plan.months[0].total)}</td>
                  <td className="text-right">{money(plan.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {total !== 100 && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Tổng tỷ lệ đang là {total}% (nên là 100%). {total > 100 ? `Vượt thu nhập ${money(plan.months[0].total - income)}/tháng.` : `Còn chưa phân bổ ${money(income - plan.months[0].total)}/tháng.`}</div>}
          {income > 0
            ? <div className="overflow-x-auto">
                <div className="text-sm font-medium text-slate-700 mb-1">Forecast 12 tháng tới</div>
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="text-left text-slate-500"><tr><th className="py-1 pr-3">Tháng</th>{BUCKETS.map((b) => <th key={b.key} className="pr-3 text-right">{b.name}</th>)}<th className="text-right">Tổng</th></tr></thead>
                  <tbody>
                    {plan.months.map((r) => (
                      <tr key={r.month} className="border-t border-slate-100">
                        <td className="py-1 pr-3">{r.month.slice(5)}/{r.month.slice(0, 4)}</td>
                        {BUCKETS.map((b) => <td key={b.key} className="pr-3 text-right">{money(r.amounts[b.key])}</td>)}
                        <td className="text-right font-medium">{money(r.total)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            : <div className="text-sm text-slate-400">Nhập thu nhập trung bình để xem forecast từng tháng.</div>}
          <div className="text-xs text-slate-400">Thiết lập lưu trong trình duyệt này (không nằm trong file sao lưu).</div>
        </div>)}
    </section>
  )
}
