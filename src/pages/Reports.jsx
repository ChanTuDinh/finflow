import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { usePeriod } from '../lib/period.jsx'
import { breakdown, fromKey, labelOf, levelName, dataYears } from '../lib/period.js'
import { compact } from '../lib/format.js'
import { Chart, COLORS } from '../components/ui.jsx'

const childLabel = { all: 'Năm', year: 'Quý', quarter: 'Tháng', month: 'Ngày' }

export default function Reports() {
  const { data, money } = useStore()
  const { period, drill } = usePeriod()
  const [scope, setScope] = useState('personal')
  const rows = breakdown(data[scope], period, dataYears(data.personal, data.business))
  const inLabel = scope === 'personal' ? 'Thu nhập' : 'Doanh thu'
  const canDrill = (k) => !!fromKey(k)
  const onBar = (d) => { const k = d?.period ?? d?.payload?.period; if (k) drill(k) }
  const total = rows.reduce((t, r) => ({ income: t.income + r.income, expense: t.expense + r.expense, net: t.net + r.net }), { income: 0, expense: 0, net: 0 })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="personal">Cá nhân</option><option value="business">Doanh nghiệp</option>
        </select>
        <span className="text-sm text-slate-500">Đang xem: <b>{period.level === 'all' ? levelName.all : `${levelName[period.level]} ${labelOf(period)}`}</b> · chia theo {childLabel[period.level].toLowerCase()}</span>
      </div>
      <section className="card">
        <Chart>
          <BarChart data={rows}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="period" fontSize={11} tickFormatter={(k) => (period.level === 'month' ? k.slice(8) : k)} minTickGap={12} />
            <YAxis tickFormatter={compact} fontSize={11} />
            <Tooltip formatter={(v) => money(v)} />
            <Legend />
            <Bar dataKey="income" name={inLabel} fill={COLORS.income} radius={[3, 3, 0, 0]} cursor="pointer" onClick={onBar} />
            <Bar dataKey="expense" name="Chi" fill={COLORS.expense} radius={[3, 3, 0, 0]} cursor="pointer" onClick={onBar} />
            <Bar dataKey="net" name="Ròng" fill={COLORS.net} radius={[3, 3, 0, 0]} cursor="pointer" onClick={onBar} />
          </BarChart>
        </Chart>
      </section>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">{childLabel[period.level]}</th><th className="px-3 py-2">{inLabel}</th><th className="px-3 py-2">Chi</th><th className="px-3 py-2">Ròng</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left whitespace-nowrap">
                  {canDrill(r.period) ? <button className="text-blue-600 underline-offset-2 hover:underline" onClick={() => drill(r.period)}>{r.period}</button> : r.period}
                </td>
                <td className="px-3 py-1.5">{money(r.income)}</td>
                <td className="px-3 py-1.5">{money(r.expense)}</td>
                <td className={`px-3 py-1.5 font-medium ${r.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(r.net)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-slate-200 text-right font-semibold">
                <td className="px-3 py-1.5 text-left">Tổng</td><td className="px-3 py-1.5">{money(total.income)}</td><td className="px-3 py-1.5">{money(total.expense)}</td>
                <td className={`px-3 py-1.5 ${total.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(total.net)}</td>
              </tr>
            )}
            {!rows.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
