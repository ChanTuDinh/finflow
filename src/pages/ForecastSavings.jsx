import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { addMonths } from '../lib/calc.js'
import { aggregateSeries } from '../lib/forecast.js'
import { baselineFrom } from '../lib/insights.js'
import { activeAccounts, compareDebtVsSave, goalStatus, projectSavings } from '../lib/savings.js'
import { compact, todayIso } from '../lib/format.js'
import { Chart, SERIES, Stat } from '../components/ui.jsx'

const OWNER_OF = { personal: 'Personal', business: 'Business' }
const DEFAULT_SCENARIOS = [
  { id: 'low', name: 'Thận trọng', returnDelta: -3, contribMult: 1 },
  { id: 'base', name: 'Cơ sở (như hiện tại)', returnDelta: 0, contribMult: 1 },
  { id: 'push', name: 'Góp mạnh hơn', returnDelta: 0, contribMult: 1.5 },
]
const unit = { month: 'tháng', quarter: 'quý', year: 'năm' }

export default function ForecastSavings() {
  const { data, money } = useStore()
  const [scope, setScope] = useState('all')
  const [years, setYears] = useState(5)
  const [level, setLevel] = useState('year')
  const [scs, setScs] = useState(DEFAULT_SCENARIOS)
  const patch = (id, p) => setScs(scs.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const startYm = todayIso().slice(0, 7)
  const endYm = addMonths(startYm, -1)

  const owner = OWNER_OF[scope]
  const accounts = useMemo(() => data.savings.filter((a) => !owner || a.owner === owner), [data.savings, owner])
  const goals = useMemo(() => data.goals.filter((g) => g.status !== 'Done' && (!owner || g.owner === owner)), [data.goals, owner])
  const debts = useMemo(() => data.debts.filter((d) => !owner || d.owner === owner), [data.debts, owner])
  const rows = useMemo(() => (scope === 'all' ? [...data.personal, ...data.business] : data[scope]), [data, scope])
  const baseline = useMemo(() => baselineFrom(rows, endYm), [rows, endYm])

  const results = useMemo(() => scs.map((scenario) => projectSavings({ accounts, scenario, startYm, years })), [scs, accounts, startYm, years])
  const agg = results.map((r) => aggregateSeries(r.series, level))
  const merged = agg[0].map((_, i) => Object.fromEntries([['period', agg[0][i].period], ...results.flatMap((r, j) => [[`bal_${r.scenario.id}`, agg[j][i].balance], [`add_${r.scenario.id}`, agg[j][i].payment], [`gain_${r.scenario.id}`, agg[j][i].interest]])]))
  const startBal = results[0].start

  // --- Trả nợ nhanh vs tích lũy ---
  const activeDebts = debts.filter((d) => d.status !== 'Paid' && d.balance > 0)
  const minTotal = activeDebts.reduce((s, d) => s + d.min_payment, 0)
  const contribTotal = activeAccounts(accounts).reduce((s, a) => s + a.monthly_contribution, 0)
  const surplus = baseline.income - baseline.expense - minTotal - contribTotal
  const accBal = activeAccounts(accounts).reduce((s, a) => s + a.balance, 0)
  const avgReturn = accBal > 0 ? activeAccounts(accounts).reduce((s, a) => s + a.balance * a.annual_return, 0) / accBal : 6
  const defaultExtra = Math.max(Math.floor((surplus * 0.7) / 1000) * 1000, 0)
  const [extraIn, setExtraIn] = useState(null)
  const [retIn, setRetIn] = useState(null)
  const extra = extraIn ?? defaultExtra
  const saveReturn = retIn ?? Math.round(avgReturn * 10) / 10
  const cmp = useMemo(() => compareDebtVsSave({ debts, baseline, startYm, years, extra, saveReturn }), [debts, baseline, startYm, years, extra, saveReturn])
  const cmpAgg = useMemo(() => {
    const step = level === 'month' ? 1 : level === 'quarter' ? 3 : 12
    return cmp.series.filter((_, i) => i % step === 0 || i === cmp.series.length - 1)
  }, [cmp, level])
  const maxApr = activeDebts.reduce((m, d) => Math.max(m, d.apr), 0)

  const line = (keys, title, data) => (
    <section className="card">
      <h2 className="font-semibold mb-2">{title}</h2>
      <Chart>
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="period" fontSize={11} minTickGap={40} />
          <YAxis tickFormatter={compact} fontSize={11} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend />
          {keys.map(([key, name], i) => <Line key={key} type="monotone" dataKey={key} name={name} stroke={SERIES[i]} dot={false} strokeWidth={2} />)}
        </LineChart>
      </Chart>
    </section>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="label">Phạm vi</label>
          <select className="input" value={scope} onChange={(e) => { setScope(e.target.value); setExtraIn(null); setRetIn(null) }}>
            <option value="all">Cá nhân + Doanh nghiệp</option><option value="personal">Chỉ cá nhân</option><option value="business">Chỉ doanh nghiệp</option>
          </select></div>
        <div><label className="label">Số năm</label>
          <select className="input" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[3, 4, 5].map((y) => <option key={y} value={y}>{y} năm</option>)}</select></div>
        <div><label className="label">Xem theo</label>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            {[['month', 'Tháng'], ['quarter', 'Quý'], ['year', 'Năm']].map(([k, l]) => (
              <button key={k} onClick={() => setLevel(k)} className={`px-3 py-1.5 ${level === k ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'}`}>{l}</button>
            ))}
          </div></div>
      </div>

      {!accounts.length && <div className="card text-sm text-slate-500">Chưa có khoản tích lũy trong phạm vi này — thêm ở tab <b>Tích lũy</b> để thấy dự báo.</div>}

      <h2 className="font-semibold text-lg">1. Tài sản tích lũy sau {years} năm</h2>
      <section className="card space-y-2">
        <div className="grid md:grid-cols-3 gap-3">
          {scs.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3 space-y-2" style={{ borderTop: `3px solid ${SERIES[i]}` }}>
              <div className="font-medium text-sm">{s.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Lãi ± (điểm %)</label><input type="number" step="0.5" className="input" value={s.returnDelta} onChange={(e) => patch(s.id, { returnDelta: Number(e.target.value) })} /></div>
                <div><label className="label">Mức góp ×</label><input type="number" step="0.1" min="0" className="input" value={s.contribMult} onChange={(e) => patch(s.id, { contribMult: Number(e.target.value) })} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">Kịch bản</th><th className="px-3 py-2">Hiện có</th><th className="px-3 py-2">Tổng góp thêm</th><th className="px-3 py-2">Lãi sinh ra</th><th className="px-3 py-2">Sau {years} năm</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scenario.id} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left font-medium">{r.scenario.name}</td>
                <td className="px-3 py-1.5">{money(startBal)}</td>
                <td className="px-3 py-1.5">{money(r.contributed)}</td>
                <td className="px-3 py-1.5 text-emerald-600">{money(r.gain)}</td>
                <td className="px-3 py-1.5 font-semibold">{money(r.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {line(results.map((r) => [`bal_${r.scenario.id}`, r.scenario.name]), 'Tổng tích lũy theo thời gian', merged)}
      <section className="card overflow-x-auto p-0">
        <h3 className="font-semibold px-4 pt-3">Theo {unit[level]}: số dư cuối kỳ · góp · lãi</h3>
        <table className="w-full text-sm mt-2">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">Kỳ</th>{results.map((r) => <th key={r.scenario.id} className="px-3 py-2">{r.scenario.name}</th>)}</tr></thead>
          <tbody>
            {(level === 'month' ? merged.slice(1) : merged).map((row) => (
              <tr key={row.period} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left">{row.period}</td>
                {results.map((r) => (
                  <td key={r.scenario.id} className="px-3 py-1.5 whitespace-nowrap">
                    <div>{money(row[`bal_${r.scenario.id}`])}</div>
                    <div className="text-xs text-slate-400">góp {money(row[`add_${r.scenario.id}`])} · lãi {money(row[`gain_${r.scenario.id}`])}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="font-semibold text-lg">2. Bao lâu đạt mục tiêu</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">Mục tiêu</th><th className="px-3 py-2">Đích</th>{scs.map((s) => <th key={s.id} className="px-3 py-2">{s.name}</th>)}<th className="px-3 py-2">Cần góp/tháng để kịp hạn</th></tr></thead>
          <tbody>
            {goals.map((g) => {
              const sts = scs.map((s) => goalStatus({ goal: g, accounts, startYm, scenario: s }))
              const base = sts[1] ?? sts[0]
              return (
                <tr key={g.id} className="border-t border-slate-100 text-right">
                  <td className="px-3 py-1.5 text-left font-medium">{g.name}<div className="text-xs font-normal text-slate-400">{g.target_date ? `hạn ${g.target_date}` : 'không đặt hạn'}</div></td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{money(g.target_amount)}</td>
                  {sts.map((st, i) => (
                    <td key={scs[i].id} className={`px-3 py-1.5 ${g.target_date && st.eta != null && !st.onTrack ? 'text-red-600' : ''}`}>
                      {st.eta == null ? 'Không đạt' : st.eta === 0 ? 'Đã đạt' : `${st.eta} tháng`}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 whitespace-nowrap">{base.required == null ? '—' : base.required === 0 ? 'Đã đủ' : money(base.required)}<div className="text-xs text-slate-400">đang góp {money(base.contrib)}</div></td>
                </tr>
              )
            })}
            {!goals.length && <tr><td colSpan={scs.length + 3} className="px-3 py-6 text-center text-slate-400">Chưa có mục tiêu đang theo đuổi</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-lg">3. Trả nợ nhanh hay tích lũy?</h2>
      <section className="card space-y-3">
        <p className="text-sm text-slate-500">So sánh cùng một khoản tiền thừa mỗi tháng: dồn vào <b>trả nợ trước</b> (hết nợ rồi dồn sang tích lũy) hay <b>chỉ trả tối thiểu</b> và đem tích lũy. Đối chiếu bằng tài sản ròng = quỹ tích lũy − dư nợ.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="label">Tiền thừa / tháng</label><input type="number" min="0" className="input !w-44" value={extra} onChange={(e) => setExtraIn(Number(e.target.value))} /></div>
          <div><label className="label">Lợi nhuận tích lũy (%/năm)</label><input type="number" step="0.1" className="input !w-36" value={saveReturn} onChange={(e) => setRetIn(Number(e.target.value))} /></div>
          <div className="text-xs text-slate-500">Gợi ý: thu {money(baseline.income)} − chi {money(baseline.expense)} − nợ tối thiểu {money(minTotal)} − đang góp {money(contribTotal)} = thặng dư {money(surplus)}/tháng (mặc định dùng 70%)</div>
        </div>
        {!cmp.hasDebt ? <p className="text-sm text-slate-500">Không có khoản nợ đang hoạt động trong phạm vi này — toàn bộ tiền thừa nên đi vào tích lũy.</p> : (<>
          <div className={`rounded-lg p-3 text-sm ${cmp.diff >= 0 ? 'bg-blue-50 text-blue-900' : 'bg-emerald-50 text-emerald-900'}`}>
            {Math.abs(cmp.diff) < 1
              ? 'Hai cách cho kết quả gần như bằng nhau.'
              : cmp.diff > 0
                ? <>✅ <b>Trả nợ trước</b> có lợi hơn ≈ <b>{money(cmp.diff)}</b> sau {years} năm (lãi nợ cao nhất {maxApr}%/năm so với lợi nhuận tích lũy {saveReturn}%/năm).</>
                : <>✅ <b>Tích lũy trước</b> có lợi hơn ≈ <b>{money(-cmp.diff)}</b> sau {years} năm (lợi nhuận {saveReturn}%/năm cao hơn lãi nợ {maxApr}%/năm). Lưu ý: lợi nhuận đầu tư không chắc chắn, còn lãi nợ là chi phí chắc chắn.</>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Trả nợ trước: tài sản ròng" value={money(cmp.pay.endNet)} tone={cmp.pay.endNet < 0 ? 'neg' : 'pos'} sub={`Hết nợ: ${cmp.pay.sim.clearedAt ? `${cmp.pay.sim.clearedAt} tháng` : 'chưa'}`} />
            <Stat label="Tích lũy trước: tài sản ròng" value={money(cmp.save.endNet)} tone={cmp.save.endNet < 0 ? 'neg' : 'pos'} sub={`Hết nợ: ${cmp.save.sim.clearedAt ? `${cmp.save.sim.clearedAt} tháng` : 'chưa'}`} />
            <Stat label="Lãi nợ phải trả (trả nợ trước)" value={money(cmp.pay.sim.totalInterest)} />
            <Stat label="Lãi nợ phải trả (tích lũy trước)" value={money(cmp.save.sim.totalInterest)} />
          </div>
          {line([['netPay', 'Trả nợ trước'], ['netSave', 'Tích lũy trước']], 'Tài sản ròng (tích lũy − dư nợ)', cmpAgg)}
        </>)}
      </section>
    </div>
  )
}
