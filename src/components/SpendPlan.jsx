import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { BUCKETS, HORIZONS, resolveHorizon, resolvePcts, sumPcts, buildPlan } from '../lib/spendPlan.js'
import { Chart } from './ui.jsx'
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
  const horizon = resolveHorizon(saved.horizon)
  const plan = buildPlan(income, pcts, todayIso().slice(0, 7), horizon)
  const slices = BUCKETS.filter((b) => pcts[b.key] > 0).map((b) => ({ ...b, value: pcts[b.key] / (total || 1) * 100, amount: plan.per[b.key] }))
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
                    <td className="text-right">{money(plan.per[b.key] * 12)}</td>
                  </tr>))}
                <tr className="border-t border-slate-300 font-semibold">
                  <td /><td>Tổng</td>
                  <td className={total === 100 ? '' : 'text-red-600'}>{total}%</td>
                  <td className="pr-3 text-right">{money(plan.months[0].total)}</td>
                  <td className="text-right">{money(plan.months[0].total * 12)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {total !== 100 && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Tổng tỷ lệ đang là {total}% (nên là 100%). {total > 100 ? `Vượt thu nhập ${money(plan.months[0].total - income)}/tháng.` : `Còn chưa phân bổ ${money(income - plan.months[0].total)}/tháng.`}</div>}
          {income > 0
            ? <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-1">Cơ cấu phân bổ (%)</div>
                    <Chart height={260}>
                      <PieChart margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
                        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={44} outerRadius={80} paddingAngle={2} stroke="#fcfcfb" strokeWidth={2}
                          label={({ x, y, textAnchor, name, value }) => <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b">{name} {+value.toFixed(1)}%</text>} labelLine={false} isAnimationActive={false}>
                          {slices.map((x) => <Cell key={x.key} fill={x.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n, { payload }) => [`${+v.toFixed(1)}% · ${money(payload.amount)}/tháng`, n]} />
                      </PieChart>
                    </Chart>
                  </div>
                  <ul className="text-sm space-y-1">
                    {slices.map((x) => (
                      <li key={x.key} className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: x.color }} />
                        <span className="w-24 font-medium">{x.name}</span>
                        <span className="w-14 text-right">{+x.value.toFixed(1)}%</span>
                        <span className="ml-auto text-slate-600">{money(x.amount)}/tháng</span>
                      </li>))}
                  </ul>
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-medium text-slate-700">Timeline theo tháng — {horizon} tháng tới</div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-slate-500 mr-1">Horizon:</span>
                      {HORIZONS.map((h) => (
                        <button key={h} onClick={() => patch({ horizon: h })} className={`rounded-lg px-2.5 py-1 border ${h === horizon ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 bg-white hover:bg-slate-100'}`}>
                          {h % 12 === 0 ? `${h / 12} năm` : `${h} tháng`}
                        </button>))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="sticky left-0 z-[1] bg-white py-1 pr-4 text-left">Quỹ</th>
                          {plan.months.map((r) => <th key={r.month} className="px-3 text-right font-semibold">{r.month.slice(5)}/{r.month.slice(0, 4)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {BUCKETS.map((b) => (
                          <tr key={b.key} className="border-t border-slate-100">
                            <td className="sticky left-0 z-[1] bg-white py-1 pr-4 font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.name}</td>
                            {plan.months.map((r) => <td key={r.month} className="px-3 text-right">{money(r.amounts[b.key])}</td>)}
                          </tr>))}
                        <tr className="border-t border-slate-300 font-semibold">
                          <td className="sticky left-0 z-[1] bg-white py-1 pr-4">Tổng</td>
                          {plan.months.map((r) => <td key={r.month} className="px-3 text-right">{money(r.total)}</td>)}
                        </tr>
                        <tr className="border-t border-slate-100 text-slate-600">
                          <td className="sticky left-0 z-[1] bg-white py-1 pr-4">Lũy kế</td>
                          {plan.months.map((r) => <td key={r.month} className="px-3 text-right">{money(r.cumulative)}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            : <div className="text-sm text-slate-400">Nhập thu nhập trung bình để xem forecast từng tháng.</div>}
          <div className="text-xs text-slate-400">Thiết lập lưu trong trình duyệt này (không nằm trong file sao lưu).</div>
        </div>)}
    </section>
  )
}
