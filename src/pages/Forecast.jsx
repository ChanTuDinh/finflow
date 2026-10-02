import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { addMonths } from '../lib/calc.js'
import { simulate, defaultScenarios, aggregateSeries } from '../lib/forecast.js'
import { baselineFrom, buildInsights } from '../lib/insights.js'
import { compact, todayIso } from '../lib/format.js'
import { useDebtSelection, useCountedPayments } from '../lib/selection.jsx'
import { SCOPE_OWNER, debtScopeOptions, cashRowsForScope } from '../lib/schema.js'
import { Chart, SERIES, SelectField, Segmented, FilterRow, Field } from '../components/ui.jsx'

const ICON = { ok: '✅', warn: '⚠️', info: '💡' }

// kind: 'debts' | 'debts_bm' — cùng giao diện và cách tính, dữ liệu nợ riêng.
export default function Forecast({ kind = 'debts' }) {
  const { data, money } = useStore()
  const [scope, setScope] = useState('all')
  const [years, setYears] = useState(5)
  const [growth, setGrowth] = useState(0)
  const [level, setLevel] = useState('year')
  const startYm = todayIso().slice(0, 7)
  const endYm = addMonths(startYm, -1) // tháng đã đủ dữ liệu gần nhất

  const sel = useDebtSelection(kind)
  const counted = useCountedPayments(kind) // dư nợ đã hoàn lại các lần trả bị bỏ tick ở tab Nợ
  const inScope = useMemo(() => counted.debts.filter((d) => scope === 'all' || d.owner === SCOPE_OWNER[scope]), [counted.debts, scope])
  const debts = useMemo(() => sel.filter(inScope), [inScope, sel.excluded]) // chỉ các khoản đã tick ở tab Nợ
  const rows = useMemo(() => cashRowsForScope(data, scope), [data, scope])
  const baseline = useMemo(() => baselineFrom(rows, endYm), [rows, endYm])
  const minTotal = debts.filter((d) => d.status !== 'Paid').reduce((s, d) => s + d.min_payment, 0)
  const [scenarios, setScenarios] = useState(null)
  const scs = scenarios || defaultScenarios(baseline, minTotal)
  const patch = (id, p) => setScenarios(scs.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const results = useMemo(() => scs.map((scenario) => simulate({ debts, scenario, baseline, startYm, years, incomeGrowth: growth / 100 })), [scs, debts, baseline, startYm, years, growth])
  const agg = results.map((r) => aggregateSeries(r.series, level))
  const merged = agg[0].map((_, i) => Object.fromEntries([['period', agg[0][i].period], ...results.flatMap((r, j) => [[`bal_${r.scenario.id}`, agg[j][i].balance], [`cash_${r.scenario.id}`, agg[j][i].cash], [`pay_${r.scenario.id}`, agg[j][i].payment], [`int_${r.scenario.id}`, agg[j][i].interest]])]))
  const insights = useMemo(() => buildInsights({ rows, debts, endYm, money }), [rows, debts, endYm, money])
  const chart = (prefix, title) => (
    <section className="card">
      <h2 className="font-semibold mb-2">{title}</h2>
      <Chart>
        <LineChart data={merged}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="period" fontSize={11} minTickGap={40} />
          <YAxis tickFormatter={compact} fontSize={11} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend />
          {results.map((r, i) => <Line key={r.scenario.id} type="monotone" dataKey={`${prefix}_${r.scenario.id}`} name={r.scenario.name} stroke={SERIES[i]} dot={false} strokeWidth={2} />)}
        </LineChart>
      </Chart>
    </section>
  )

  return (
    <div className="space-y-4">
      {counted.excludedIds.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
          Forecast tính theo dư nợ <b>như thể chưa có {counted.excludedIds.length} lần trả</b> (đã bỏ tick trong Lịch sử trả nợ ở tab {kind === 'debts' ? 'Nợ' : 'Nợ BM'}).
        </div>)}
      {inScope.length > 0 && debts.length < inScope.length && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm px-3 py-2">
          Forecast chỉ tính <b>{debts.length}/{inScope.length}</b> khoản nợ đã tick ở tab {kind === 'debts' ? 'Nợ' : 'Nợ BM'}{debts.length === 0 ? ' — chưa chọn khoản nào' : ''}.
        </div>)}
      <FilterRow>
        <SelectField label="Phạm vi" value={scope} onChange={(v) => { setScope(v); setScenarios(null) }}
          options={debtScopeOptions(kind)} />
        <SelectField label="Số năm" value={String(years)} onChange={(v) => setYears(Number(v))} options={[3, 4, 5].map((y) => ({ value: String(y), label: `${y} năm` }))} />
        <Segmented label="Xem theo" value={level} onChange={setLevel} options={[{ value: 'month', label: 'Tháng' }, { value: 'quarter', label: 'Quý' }, { value: 'year', label: 'Năm' }]} />
        <Field label="Tăng thu nhập / năm (%)"><input type="number" className="input !w-28" value={growth} onChange={(e) => setGrowth(Number(e.target.value))} /></Field>
        <div className="text-xs text-slate-500 ml-auto">Cơ sở (TB 3 tháng, chưa gồm tiền trả nợ): thu {money(baseline.income)} · chi {money(baseline.expense)} / tháng</div>
      </FilterRow>

      <section className="card space-y-2">
        <h2 className="font-semibold">Kịch bản</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {scs.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3 space-y-2" style={{ borderTop: `3px solid ${SERIES[i]}` }}>
              <div className="font-medium text-sm">{s.name}</div>
              {s.mode !== 'min' && (
                <select className="input" value={s.order} onChange={(e) => patch(s.id, { order: e.target.value })}>
                  <option value="avalanche">Ưu tiên lãi cao (avalanche)</option><option value="snowball">Ưu tiên dư nợ nhỏ (snowball)</option>
                </select>)}
              {s.mode === 'extra' && <div><label className="label">Trả thêm / tháng</label><input type="number" className="input" value={s.extra} onChange={(e) => patch(s.id, { extra: Number(e.target.value) })} /></div>}
              {s.mode === 'pct' && <div><label className="label">% thu nhập dành trả nợ</label><input type="number" min="0" max="100" className="input" value={Math.round(s.pct * 100)} onChange={(e) => patch(s.id, { pct: Number(e.target.value) / 100 })} /></div>}
              {s.mode === 'min' && <p className="text-xs text-slate-500">Chỉ trả mức tối thiểu từng khoản.</p>}
            </div>
          ))}
        </div>
      </section>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-right"><tr><th className="px-3 py-2 text-left">Kịch bản</th><th className="px-3 py-2">Hết nợ sau</th><th className="px-3 py-2">Tổng lãi</th><th className="px-3 py-2">Tổng đã trả</th><th className="px-3 py-2">Dư nợ cuối kỳ</th><th className="px-3 py-2">Tiền mặt tích luỹ</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scenario.id} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left font-medium">{r.scenario.name}</td>
                <td className="px-3 py-1.5">{r.clearedAt ? `${r.clearedAt} tháng` : `Không hết trong ${years} năm`}</td>
                <td className="px-3 py-1.5">{money(r.totalInterest)}</td>
                <td className="px-3 py-1.5">{money(r.totalPaid)}</td>
                <td className="px-3 py-1.5">{money(r.endBalance)}</td>
                <td className={`px-3 py-1.5 ${r.endCash < 0 ? 'text-red-600' : ''}`}>{money(r.endCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card overflow-x-auto p-0">
        <h2 className="font-semibold px-4 pt-3">Theo {level === 'month' ? 'tháng' : level === 'quarter' ? 'quý' : 'năm'}: dư nợ cuối kỳ · trả nợ · lãi</h2>
        <table className="w-full text-sm mt-2">
          <thead className="text-xs text-slate-500 text-right">
            <tr><th className="px-3 py-2 text-left">Kỳ</th>{results.map((r) => <th key={r.scenario.id} className="px-3 py-2">{r.scenario.name}</th>)}</tr>
          </thead>
          <tbody>
            {(level === 'month' ? merged.slice(1) : merged).map((row) => (
              <tr key={row.period} className="border-t border-slate-100 text-right">
                <td className="px-3 py-1.5 text-left">{row.period}</td>
                {results.map((r) => (
                  <td key={r.scenario.id} className="px-3 py-1.5 whitespace-nowrap">
                    <div>{money(row[`bal_${r.scenario.id}`])}</div>
                    <div className="text-xs text-slate-400">trả {money(row[`pay_${r.scenario.id}`])} · lãi {money(row[`int_${r.scenario.id}`])}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {chart('bal', 'Dư nợ theo thời gian')}
      {chart('cash', 'Tiền mặt tích luỹ (thu − chi − trả nợ)')}

      <section className="card space-y-2">
        <h2 className="font-semibold">Gợi ý cải thiện kế hoạch trả nợ</h2>
        <ul className="space-y-1.5 text-sm">{insights.map((i, k) => <li key={k}>{ICON[i.level]} {i.text}</li>)}</ul>
      </section>
    </div>
  )
}
