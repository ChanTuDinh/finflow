import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { BUCKETS, HORIZONS, resolveHorizon, resolvePcts, sumPcts, allocate, incomeForYear, buildPlan } from '../lib/spendPlan.js'
import { Chart, SelectField, FilterRow } from './ui.jsx'
import { todayIso } from '../lib/format.js'

const num = (v) => (v === '' ? 0 : Number(String(v).replace(/[^\d.]/g, '')) || 0)

/** Board 2 (cuối trang Ví cá nhân): Chi tiêu cá nhân forecast, có bộ lọc Năm / Tháng riêng, tách khỏi bộ lọc kỳ của board 1. */
export default function SpendPlan({ actualMonthly = 0 }) {
  const { settings, setSettings, money } = useStore()
  const [fYear, setFYear] = useState('all') // bộ lọc riêng của board forecast
  const [fMonth, setFMonth] = useState('all')
  const saved = settings.spendPlan || {}
  const curYear = todayIso().slice(0, 4)
  const incomeOf = (y) => incomeForYear(saved, y, curYear) // thu nhập TB / tháng dự kiến của từng năm
  const pcts = resolvePcts(saved.pcts)
  const total = sumPcts(pcts)
  const horizon = resolveHorizon(saved.horizon) // số năm
  const plan = buildPlan(incomeOf, pcts, `${curYear}-01`, horizon * 12) // theo năm dương lịch: mỗi năm đủ 12 tháng (T1–T12)
  const years = [...new Set(plan.months.map((r) => r.month.slice(0, 4)))]
  const year = years.includes(fYear) ? fYear : 'all' // đổi horizon làm mất năm đang chọn -> về Tất cả
  const refYear = year === 'all' ? years[0] : year // năm dùng cho bảng quỹ và biểu đồ
  const income = incomeOf(refYear)
  const per = allocate(income, pcts)
  const perTotal = Object.values(per).reduce((a, b) => a + b, 0)
  const slices = BUCKETS.filter((b) => pcts[b.key] > 0).map((b) => ({ ...b, value: pcts[b.key] / (total || 1) * 100, amount: per[b.key] }))
  const inYear = plan.months.filter((r) => year === 'all' || r.month.startsWith(year))
  const monthNums = [...new Set(inYear.map((r) => r.month.slice(5)))].sort()
  const month = monthNums.includes(fMonth) ? fMonth : 'all'
  const shown = inYear.filter((r) => month === 'all' || r.month.endsWith(`-${month}`))
  const patch = (p) => setSettings((s) => ({ ...s, spendPlan: { ...(s.spendPlan || {}), ...p } }))
  const setIncome = (y, v) => patch({ incomeByYear: { ...(saved.incomeByYear || {}), [y]: v } })
  const incomeRow = (y) => {
    const m = incomeOf(y), prev = incomeOf(String(Number(y) - 1))
    return (
      <div key={y} className="space-y-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">Thu nhập trung bình / tháng — {y}
            <input className="input mt-1" inputMode="numeric" value={m || ''} placeholder="0" onChange={(e) => setIncome(y, num(e.target.value))} />
          </label>
          <label className="text-sm">Thu nhập trung bình / năm — {y}
            <input className="input mt-1" inputMode="numeric" value={m ? m * 12 : ''} placeholder="0" onChange={(e) => setIncome(y, Math.round(num(e.target.value) / 12))} />
          </label>
        </div>
        {!m && <div className="text-xs text-amber-800">Chưa nhập thu nhập dự kiến năm {y}.{prev > 0 && <> <button className="text-blue-600" onClick={() => setIncome(y, prev)}>Dùng số năm {Number(y) - 1}: {money(prev)}/tháng</button></>}</div>}
      </div>
    )
  }
  const setPct = (key, v) => patch({ pcts: { ...pcts, [key]: v === '' ? 0 : Math.max(0, Number(v) || 0) } })

  return (
    <section className="space-y-3 rounded-xl border border-teal-300 bg-teal-100 p-4">
      <h3 className="font-semibold text-slate-700">📊 Chi tiêu cá nhân forecast <span className="text-xs font-normal text-slate-600">Board 2 — bộ lọc riêng, không theo Năm / Quý / Tháng phía trên</span></h3>
      <FilterRow>
        <SelectField label="Năm" value={year} onChange={(v) => { setFYear(v); setFMonth('all') }} options={[{ value: 'all', label: 'Tất cả năm' }, ...years.map((y) => ({ value: y, label: y }))]} />
        <SelectField label="Tháng" value={month} onChange={setFMonth} options={[{ value: 'all', label: 'Cả năm' }, ...monthNums.map((m) => ({ value: m, label: `Tháng ${Number(m)}` }))]} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-700">Horizon</span>
          <div className="flex items-center gap-1 text-sm">
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => patch({ horizon: h })} className={`rounded-lg px-2.5 py-1.5 border ${h === horizon ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 bg-white hover:bg-slate-100'}`}>{h} năm</button>))}
          </div>
        </div>
      </FilterRow>
      <div className="space-y-4">
          {(year === 'all' ? years : [year]).map(incomeRow)}
          <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
            Thu nhập nhập riêng cho từng năm (năm = tháng × 12). {year === 'all' ? 'Chọn một năm ở bộ lọc để chỉ nhập năm đó.' : ''}
            {actualMonthly > 0 && <button className="text-blue-600" onClick={() => setIncome(refYear, actualMonthly)}>Lấy từ dữ liệu thực tế cho {refYear}: {money(actualMonthly)}/tháng</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-700"><tr><th className="py-1 pr-3">TT</th><th className="pr-3">Quỹ</th><th className="pr-3">% đề xuất</th><th className="pr-3 text-right">/ tháng ({refYear})</th><th className="text-right">/ năm ({refYear})</th></tr></thead>
              <tbody>
                {BUCKETS.map((b, i) => (
                  <tr key={b.key} className="border-t border-teal-200">
                    <td className="py-1 pr-3">{i + 1}</td>
                    <td className="pr-3 font-medium">{b.name}</td>
                    <td className="pr-3"><input className="input !w-20" inputMode="decimal" value={pcts[b.key]} onChange={(e) => setPct(b.key, e.target.value)} /></td>
                    <td className="pr-3 text-right">{money(per[b.key])}</td>
                    <td className="text-right">{money(per[b.key] * 12)}</td>
                  </tr>))}
                <tr className="border-t border-teal-400 font-semibold">
                  <td /><td>Tổng</td>
                  <td className={total === 100 ? '' : 'text-red-600'}>{total}%</td>
                  <td className="pr-3 text-right">{money(perTotal)}</td>
                  <td className="text-right">{money(perTotal * 12)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {total !== 100 && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Tổng tỷ lệ đang là {total}% (nên là 100%). {total > 100 ? `Vượt thu nhập ${money(perTotal - income)}/tháng.` : `Còn chưa phân bổ ${money(income - perTotal)}/tháng.`}</div>}
          {plan.total > 0
            ? <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-1">Cơ cấu phân bổ (%) — {refYear}</div>
                    <Chart height={260}>
                      <PieChart margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
                        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={44} outerRadius={80} paddingAngle={2} stroke="#ccfbf1" strokeWidth={2}
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
                    <div className="text-sm font-medium text-slate-700">Timeline theo tháng — {shown.length} tháng · {horizon} năm từ T1/{years[0]}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="text-slate-700">
                        <tr>
                          <th className="sticky left-0 z-[1] bg-teal-100 py-1 pr-4 text-left">Quỹ</th>
                          {shown.map((r) => <th key={r.month} className="px-3 text-right font-semibold">{r.month.slice(5)}/{r.month.slice(0, 4)}</th>)}
                          <th className="pl-4 text-right font-semibold text-slate-900">Tổng {shown.length} tháng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {BUCKETS.map((b) => (
                          <tr key={b.key} className="border-t border-teal-200">
                            <td className="sticky left-0 z-[1] bg-teal-100 py-1 pr-4 font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.name}</td>
                            {shown.map((r) => <td key={r.month} className="px-3 text-right">{money(r.amounts[b.key])}</td>)}
                            <td className="pl-4 text-right font-semibold">{money(shown.reduce((a, r) => a + r.amounts[b.key], 0))}</td>
                          </tr>))}
                        <tr className="border-t border-teal-400 font-semibold">
                          <td className="sticky left-0 z-[1] bg-teal-100 py-1 pr-4">Tổng</td>
                          {shown.map((r) => <td key={r.month} className="px-3 text-right">{money(r.total)}</td>)}
                          <td className="pl-4 text-right">{money(shown.reduce((a, r) => a + r.total, 0))}</td>
                        </tr>
                        <tr className="border-t border-teal-200 text-slate-600">
                          <td className="sticky left-0 z-[1] bg-teal-100 py-1 pr-4">Lũy kế</td>
                          {shown.map((r) => <td key={r.month} className="px-3 text-right">{money(r.cumulative)}</td>)}
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            : <div className="text-sm text-slate-600">Nhập thu nhập trung bình dự kiến của từng năm để xem forecast từng tháng.</div>}
          <div className="text-xs text-slate-600">Thiết lập lưu trong trình duyệt này (không nằm trong file sao lưu).</div>
        </div>
    </section>
  )
}
