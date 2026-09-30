import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { byMonth, byQuarter } from '../lib/calc.js'
import { compact } from '../lib/format.js'
import { Chart, COLORS } from '../components/ui.jsx'

export default function Reports() {
  const { data, money } = useStore()
  const [scope, setScope] = useState('personal')
  const [gran, setGran] = useState('month')
  const rows = (gran === 'month' ? byMonth : byQuarter)(data[scope])
  const inLabel = scope === 'personal' ? 'Thu nhập' : 'Doanh thu'

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="input !w-auto" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="personal">Cá nhân</option><option value="business">Doanh nghiệp</option>
        </select>
        <select className="input !w-auto" value={gran} onChange={(e) => setGran(e.target.value)}>
          <option value="month">Theo tháng</option><option value="quarter">Theo quý</option>
        </select>
      </div>
      <section className="card">
        <Chart>
          <BarChart data={rows}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="period" fontSize={11} />
            <YAxis tickFormatter={compact} fontSize={11} />
            <Tooltip formatter={(v) => money(v)} />
            <Legend />
            <Bar dataKey="income" name={inLabel} fill={COLORS.income} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Chi" fill={COLORS.expense} radius={[3, 3, 0, 0]} />
            <Bar dataKey="net" name="Ròng" fill={COLORS.net} radius={[3, 3, 0, 0]} />
          </BarChart>
        </Chart>
      </section>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">Kỳ</th><th className="px-3 py-2">{inLabel}</th><th className="px-3 py-2">Chi</th><th className="px-3 py-2">Ròng</th></tr></thead>
          <tbody>
            {rows.slice().reverse().map((r) => (
              <tr key={r.period} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left">{r.period}</td>
                <td className="px-3 py-1.5">{money(r.income)}</td>
                <td className="px-3 py-1.5">{money(r.expense)}</td>
                <td className={`px-3 py-1.5 font-medium ${r.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
