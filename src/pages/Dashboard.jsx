import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { usePeriod } from '../lib/period.jsx'
import { breakdown, dataYears, inPeriod, labelOf, levelName } from '../lib/period.js'
import { totals } from '../lib/calc.js'
import { compact, pct } from '../lib/format.js'
import { Chart, COLORS, Stat } from '../components/ui.jsx'

export default function Dashboard() {
  const { data, money } = useStore()
  const { period, drill } = usePeriod()
  const years = dataYears(data.personal, data.business)
  const inP = (rows) => totals(rows.filter((r) => inPeriod(period, r.date)))
  const p = breakdown(data.personal, period, years)
  const b = breakdown(data.business, period, years)
  const cmp = p.map((e, i) => ({ period: e.period, personalNet: e.net, businessNet: b[i].net }))
  const debt = (owner) => data.debts.filter((d) => d.status !== 'Paid' && d.owner === owner).reduce((s, d) => s + d.balance, 0)
  const title = period.level === 'all' ? levelName.all : `${levelName[period.level]} ${labelOf(period)}`
  const onBar = (d) => { const k = d?.period ?? d?.payload?.period; if (k) drill(k) }

  const blocks = [
    ['Cá nhân', COLORS.personal, inP(data.personal), debt('Personal'), 'Thu nhập'],
    ['Doanh nghiệp', COLORS.business, inP(data.business), debt('Business'), 'Doanh thu'],
  ]
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {blocks.map(([name, color, t, d, inLabel]) => (
          <section key={name} className="card space-y-3" style={{ borderTop: `3px solid ${color}` }}>
            <h2 className="font-semibold">{name} <span className="text-xs font-normal text-slate-400">{title}</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Stat label={inLabel} value={money(t.income)} />
              <Stat label="Chi" value={money(t.expense)} />
              <Stat label="Ròng" value={money(t.net)} tone={t.net < 0 ? 'neg' : 'pos'} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Stat label="Tỷ lệ giữ lại (ròng / thu)" value={t.income > 0 ? pct(t.net / t.income) : '—'} tone={t.net < 0 ? 'neg' : undefined} />
              <Stat label="Dư nợ hiện tại" value={money(d)} />
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <h2 className="font-semibold mb-2">Dòng tiền ròng — {title}: cá nhân vs doanh nghiệp</h2>
        <Chart>
          <BarChart data={cmp}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="period" fontSize={11} tickFormatter={(k) => (period.level === 'month' ? k.slice(8) : k)} minTickGap={12} />
            <YAxis tickFormatter={compact} fontSize={11} />
            <Tooltip formatter={(v) => money(v)} />
            <Legend />
            <Bar dataKey="personalNet" name="Cá nhân" fill={COLORS.personal} radius={[3, 3, 0, 0]} cursor="pointer" onClick={onBar} />
            <Bar dataKey="businessNet" name="Doanh nghiệp" fill={COLORS.business} radius={[3, 3, 0, 0]} cursor="pointer" onClick={onBar} />
          </BarChart>
        </Chart>
      </section>
      <p className="text-xs text-slate-400">Cá nhân và doanh nghiệp được tách riêng, không cộng gộp. Bấm vào cột để xem chi tiết kỳ con.</p>
    </div>
  )
}
