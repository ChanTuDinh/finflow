import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { compareByMonth, lastMonths, totals } from '../lib/calc.js'
import { compact, todayIso } from '../lib/format.js'
import { Chart, COLORS, Stat } from '../components/ui.jsx'

export default function Dashboard() {
  const { data, money } = useStore()
  const ym = todayIso().slice(0, 7)
  const month = (rows) => totals(rows.filter((r) => r.date.startsWith(ym)))
  const year = (rows) => totals(rows.filter((r) => r.date.startsWith(ym.slice(0, 4))))
  const cmp = useMemo(() => compareByMonth(data.personal, data.business, lastMonths(ym, 12)), [data, ym])
  const debt = (owner) => data.debts.filter((d) => d.status !== 'Paid' && d.owner === owner).reduce((s, d) => s + d.balance, 0)

  const blocks = [
    ['Cá nhân', COLORS.personal, month(data.personal), year(data.personal), debt('Personal'), 'Thu nhập'],
    ['Doanh nghiệp', COLORS.business, month(data.business), year(data.business), debt('Business'), 'Doanh thu'],
  ]
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {blocks.map(([name, color, m, y, d, inLabel]) => (
          <section key={name} className="card space-y-3" style={{ borderTop: `3px solid ${color}` }}>
            <h2 className="font-semibold">{name} <span className="text-xs font-normal text-slate-400">tháng {ym}</span></h2>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={inLabel} value={money(m.income)} />
              <Stat label="Chi" value={money(m.expense)} />
              <Stat label="Ròng" value={money(m.net)} tone={m.net < 0 ? 'neg' : 'pos'} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={`Ròng lũy kế năm ${ym.slice(0, 4)}`} value={money(y.net)} tone={y.net < 0 ? 'neg' : 'pos'} />
              <Stat label="Dư nợ" value={money(d)} />
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <h2 className="font-semibold mb-2">Dòng tiền ròng 12 tháng: cá nhân vs doanh nghiệp</h2>
        <Chart>
          <BarChart data={cmp}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="period" fontSize={11} />
            <YAxis tickFormatter={compact} fontSize={11} />
            <Tooltip formatter={(v) => money(v)} />
            <Legend />
            <Bar dataKey="personalNet" name="Cá nhân" fill={COLORS.personal} radius={[3, 3, 0, 0]} />
            <Bar dataKey="businessNet" name="Doanh nghiệp" fill={COLORS.business} radius={[3, 3, 0, 0]} />
          </BarChart>
        </Chart>
      </section>
      <p className="text-xs text-slate-400">Cá nhân và doanh nghiệp được tách riêng, không cộng gộp.</p>
    </div>
  )
}
