import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { BUCKETS, YEARS_AHEAD, resolvePcts, sumPcts, allocate, incomeForYear, buildPlan, actualByFund, actualFundTags } from '../lib/spendPlan.js'
import { Chart, SelectField, FilterRow } from './ui.jsx'
import { todayIso } from '../lib/format.js'

const num = (v) => (v === '' ? 0 : Number(String(v).replace(/[^\d.]/g, '')) || 0)

/** Board 2 (cuối trang Ví cá nhân): Dự đoán chi tiêu cá nhân, có bộ lọc Năm / Tháng riêng, tách khỏi bộ lọc kỳ của board 1. */
export default function SpendPlan({ actualMonthly = 0, actualRows = [] }) {
  const { settings, setSettings, money } = useStore()
  const [open, setOpen] = useState(false) // dropdown, mặc định đóng
  const [fYear, setFYear] = useState('all') // bộ lọc riêng của board forecast
  const [fMonth, setFMonth] = useState('all')
  const [selFund, setSelFund] = useState(null) // quỹ đang chọn trong biểu đồ Thực tế phân bổ (xem tag con); null = chưa chọn
  const [cmp, setCmp] = useState(false) // "Hiển thị so sánh KH/TT": mặc định tắt — chỉ hiện kế hoạch, bật thì thêm thực tế và chênh lệch
  const [ytd, setYtd] = useState(false) // "Tính đến tháng ...": mỗi năm chỉ lấy từ T1 đến hết tháng đã chọn
  const [ytdMonth, setYtdMonth] = useState(Number(todayIso().slice(5, 7))) // mặc định tháng hiện tại, chọn được tháng khác
  const saved = settings.spendPlan || {}
  const curYear = todayIso().slice(0, 4)
  const incomeOf = (y) => incomeForYear(saved, y, curYear) // thu nhập TB / tháng dự kiến của từng năm
  const pcts = resolvePcts(saved.pcts)
  const total = sumPcts(pcts)
  const plan = buildPlan(incomeOf, pcts, `${curYear}-01`, YEARS_AHEAD * 12) // theo năm dương lịch: mỗi năm đủ 12 tháng (T1–T12)
  const years = [...new Set(plan.months.map((r) => r.month.slice(0, 4)))]
  const year = years.includes(fYear) ? fYear : 'all' // năm không còn trong danh sách -> về Tất cả
  // Một năm: số của năm đó. "Tất cả năm": trung bình cộng các năm đã nhập thu nhập (năm chưa nhập không kéo số xuống).
  const activeYears = years.filter((y) => incomeOf(y) > 0)
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const income = year === 'all' ? Math.round(mean(activeYears.map(incomeOf))) : incomeOf(year)
  const per = year === 'all'
    ? Object.fromEntries(BUCKETS.map((b) => [b.key, Math.round(mean(activeYears.map((y) => allocate(incomeOf(y), pcts)[b.key])))]))
    : allocate(income, pcts)
  const refLabel = year === 'all' ? `trung bình ${activeYears.length} năm` : year
  const perTotal = Object.values(per).reduce((a, b) => a + b, 0)
  const slices = BUCKETS.filter((b) => pcts[b.key] > 0).map((b) => ({ ...b, value: pcts[b.key] / (total || 1) * 100, amount: per[b.key] }))
  const untilMonth = ytd ? ytdMonth : ''
  const inYear = plan.months.filter((r) => (year === 'all' || r.month.startsWith(year)) && (!ytd || Number(r.month.slice(5)) <= ytdMonth))
  const monthNums = [...new Set(inYear.map((r) => r.month.slice(5)))].sort()
  const month = monthNums.includes(fMonth) ? fMonth : 'all'
  const shown = inYear.filter((r) => month === 'all' || r.month.endsWith(`-${month}`))
  // Thực tế phân bổ theo quỹ, cùng bộ lọc Năm / Tháng với kế hoạch để so sánh
  const act = actualByFund(actualRows, { years, year, month, untilMonth })
  const actSlices = [...BUCKETS.filter((b) => act.per[b.key] > 0).map((b) => ({ key: b.key, name: b.name, color: b.color, amount: act.per[b.key] })), ...(act.unassigned > 0 ? [{ key: '__un', name: 'Chưa phân quỹ', color: '#b6c0cc', amount: act.unassigned }] : [])]
    .map((x) => ({ ...x, pct: act.total > 0 ? x.amount / act.total : 0 }))
  const actMonths = shown.map((r) => actualByFund(actualRows, { years, year: r.month.slice(0, 4), month: r.month.slice(5) })) // thực tế từng tháng đang hiển thị (cùng thứ tự `shown`)
  const actSum = (f) => actMonths.reduce((a, x) => a + f(x), 0)
  const planShownTotal = shown.reduce((a, r) => a + r.total, 0)
  const hasUnassignedMonths = actMonths.some((x) => x.unassigned > 0)
  const dash = (v) => (v ? money(v) : '–')
  // Dòng % kiểu chứng khoán: (KH − TT) / KH. ▲ xanh = còn trong ngân sách (chi ít hơn KH), ▼ đỏ = vượt KH; KH = 0 thì không có %.
  const pctVs = (d, base) => {
    if (!(base > 0)) return <span className="text-slate-500">—</span>
    const v = (d / base) * 100
    if (Math.abs(v) < 0.05) return <span className="text-slate-700">■ 0.0%</span>
    return v > 0 ? <span className="font-semibold text-emerald-800">▲ {v.toFixed(1)}%</span> : <span className="font-bold text-red-700">▼ {Math.abs(v).toFixed(1)}%</span>
  }
  const signed = (d) => `${d > 0 ? '+' : ''}${money(d)}`
  const STICKY1 = 'sticky left-0 z-[1] w-36 min-w-[9rem] bg-teal-100 py-1 pr-3' // 2 cột đầu cố định khi cuộn ngang
  const STICKY2 = 'sticky left-36 z-[1] min-w-[9rem] border-r border-teal-300 bg-teal-100 px-3 text-right'
  const actOpts = { years, year, month, untilMonth }
  const selSlice = actSlices.find((x) => x.key === selFund) || null // quỹ được chọn (nếu còn dữ liệu)
  const fundTags = selSlice ? actualFundTags(actualRows, actOpts, selSlice.key) : null
  const pickFund = (k) => setSelFund((cur) => (cur === k ? null : k))
  const periodLabel = `${year === 'all' ? 'tất cả năm' : year}${month !== 'all' ? ` · tháng ${Number(month)}` : ''}${ytd ? ` · T1 → T${ytdMonth}` : ''}`
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

  const actualBlock = (
    <div className="space-y-2 border-t border-teal-300 pt-3">
      <div className="text-sm font-medium text-slate-700">Thực tế phân bổ theo quỹ — {periodLabel} <span className="text-xs font-normal text-slate-600">(chi thật theo danh mục Need / Want / Edu / Reserve / Investment / Giving; không gồm Trả nợ và Chuyển ví)</span></div>
      {act.total <= 0
        ? <div className="text-sm text-slate-600">Chưa có khoản chi nào trong kỳ này. Gắn danh mục Need, Want, Edu, Reserve, Investment, Giving cho giao dịch chi để thấy thực tế phân bổ.</div>
        : <>
            <div className="text-xs text-slate-700">Bấm vào một vùng màu (hoặc một dòng bên phải) để xem các tag con của quỹ đó; bấm lại để bỏ chọn.</div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
              <Chart height={260}>
                <PieChart margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
                  <Pie data={actSlices} dataKey="amount" nameKey="name" innerRadius={44} outerRadius={84} paddingAngle={2} stroke="#ccfbf1" strokeWidth={2} isAnimationActive={false} cursor="pointer"
                    onClick={(d) => pickFund(d.key ?? d.payload?.key)}
                    label={({ x, y, textAnchor, payload }) => (payload.pct >= 0.04 ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b" opacity={!selSlice || selSlice.key === payload.key ? 1 : 0.4}>{payload.key === '__un' ? '' : `${payload.name} `}{(payload.pct * 100).toFixed(1)}%</text> : null)} labelLine={false}>
                    {actSlices.map((x) => <Cell key={x.key} fill={x.color} fillOpacity={!selSlice || selSlice.key === x.key ? 1 : 0.25} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, { payload }) => [`${money(v)} · ${(payload.pct * 100).toFixed(1)}%`, n]} />
                </PieChart>
              </Chart>
              <div className="space-y-3">
                <ul className="text-sm space-y-1">
                  {actSlices.map((x) => (
                    <li key={x.key}>
                      <button type="button" onClick={() => pickFund(x.key)} className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-teal-200 ${selSlice?.key === x.key ? 'bg-teal-200 ring-1 ring-teal-500' : selSlice ? 'opacity-60' : ''}`}>
                        <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color }} />
                        <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                        <span className="w-14 text-right">{(x.pct * 100).toFixed(1)}%</span>
                        <span className="w-32 text-right whitespace-nowrap">{money(x.amount)}</span>
                      </button>
                    </li>))}
                  <li className="flex items-center gap-2 border-t border-teal-400 px-1 pt-1.5 font-semibold">
                    <span className="inline-block h-3 w-3 shrink-0" /><span className="flex-1">Tổng chi thực tế</span><span className="w-14 text-right">100%</span><span className="w-32 text-right whitespace-nowrap">{money(act.total)}</span>
                  </li>
                </ul>
                {selSlice && fundTags && (
                  <div className="rounded-lg border border-teal-300 bg-white/60 p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: selSlice.color }} />Tag trong {selSlice.name}</span>
                      <span className="text-xs text-slate-700">{money(fundTags.total)} · {(selSlice.pct * 100).toFixed(1)}% tổng chi</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-700"><tr><th className="py-0.5 pr-3">Tag</th><th className="pr-3 text-right">Số tiền</th><th className="pr-3 text-right">% trong {selSlice.name}</th><th className="text-right">Số GD</th></tr></thead>
                      <tbody>
                        {fundTags.items.map((x) => (
                          <tr key={x.tag} className="border-t border-teal-200"><td className="py-1 pr-3 font-medium">{x.tag}</td><td className="pr-3 text-right whitespace-nowrap">{money(x.amount)}</td><td className="pr-3 text-right">{(x.pct * 100).toFixed(1)}%</td><td className="text-right text-slate-700">{x.count}</td></tr>))}
                        {fundTags.untagged.count > 0 && (
                          <tr className="border-t border-teal-200 text-slate-700"><td className="py-1 pr-3">Chưa gắn tag</td><td className="pr-3 text-right whitespace-nowrap">{money(fundTags.untagged.amount)}</td><td className="pr-3 text-right">{(fundTags.untagged.pct * 100).toFixed(1)}%</td><td className="text-right">{fundTags.untagged.count}</td></tr>)}
                      </tbody>
                    </table>
                    {fundTags.items.length === 0 && fundTags.untagged.count === 0 && <div className="text-sm text-slate-600">Không có khoản chi nào.</div>}
                  </div>)}
              </div>
            </div>
          </>}
    </div>
  )

  return (
    <section className={`rounded-xl border border-teal-300 bg-teal-100 ${open ? 'space-y-3 p-4' : 'px-4 py-2'}`}>
      <div className="flex cursor-pointer select-none items-center gap-2" onClick={() => setOpen((v) => !v)}>
        <h3 className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
          <span className="inline-block w-4 text-slate-600">{open ? '▾' : '▸'}</span>📊 Dự đoán chi tiêu cá nhân
          <span className="text-xs font-normal text-slate-600">{open ? 'Board 2 — bộ lọc riêng, không theo Năm / Quý / Tháng phía trên' : 'Bấm để mở'}</span>
        </h3>
      </div>
      {open && <>
      <FilterRow>
        <SelectField label="Năm" value={year} onChange={(v) => { setFYear(v); setFMonth('all') }} options={[{ value: 'all', label: 'Tất cả năm' }, ...years.map((y) => ({ value: y, label: y }))]} />
        <SelectField label="Tháng" value={month} onChange={setFMonth} options={[{ value: 'all', label: 'Cả năm' }, ...monthNums.map((m) => ({ value: m, label: `Tháng ${Number(m)}` }))]} />
        <div className="flex items-center gap-2 pb-1.5 text-sm text-slate-800" title="Chỉ lấy dữ liệu từ tháng 1 đến hết tháng đã chọn (áp dụng cho từng năm)">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={ytd} onChange={(e) => setYtd(e.target.checked)} />
            Tính đến
          </label>
          <select className="input !w-auto" value={ytdMonth} onChange={(e) => { setYtdMonth(Number(e.target.value)); setYtd(true); setFMonth('all') }} aria-label="Tính đến tháng">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <span className="text-xs text-slate-600">(T1 → T{ytdMonth}{year === 'all' ? ' mỗi năm' : `/${year}`})</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-800" title="Hiện thêm thực tế chi và chênh lệch so với kế hoạch (KH) ở biểu đồ và timeline">
          <input type="checkbox" checked={cmp} onChange={(e) => setCmp(e.target.checked)} />
          Hiển thị so sánh KH/TT
        </label>
      </FilterRow>
      <div className="space-y-4">
          {year === 'all'
            ? <div className="space-y-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm">Thu nhập trung bình / tháng — {refLabel}
                    <input className="input mt-1 !bg-teal-50" readOnly value={income || ''} placeholder="0" />
                  </label>
                  <label className="text-sm">Thu nhập trung bình / năm — {refLabel}
                    <input className="input mt-1 !bg-teal-50" readOnly value={income ? income * 12 : ''} placeholder="0" />
                  </label>
                </div>
                <div className="text-xs text-slate-700">{activeYears.length ? `Trung bình cộng của các năm đã nhập (${activeYears.join(', ')}).` : 'Chưa năm nào có thu nhập dự kiến.'} Chọn một năm ở bộ lọc để nhập thu nhập năm đó.</div>
              </div>
            : <>
                {incomeRow(year)}
                <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
                  Thu nhập nhập riêng cho từng năm (năm = tháng × 12).
                  {actualMonthly > 0 && <button className="text-blue-600" onClick={() => setIncome(year, actualMonthly)}>Lấy từ dữ liệu thực tế cho {year}: {money(actualMonthly)}/tháng</button>}
                </div>
              </>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-700"><tr><th className="py-1 pr-3">TT</th><th className="pr-3">Quỹ</th><th className="pr-3">% đề xuất</th><th className="pr-3 text-right">/ tháng ({refLabel})</th><th className="text-right">/ năm ({refLabel})</th></tr></thead>
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
                    <div className="text-sm font-medium text-slate-700 mb-1">Cơ cấu phân bổ (%) — {refLabel}</div>
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
                {cmp && actualBlock}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-medium text-slate-700">Timeline theo tháng — {shown.length} tháng</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="text-slate-700">
                        <tr>
                          <th className="sticky left-0 z-[1] w-36 min-w-[9rem] bg-teal-100 py-1 pr-3 text-left">Quỹ</th>
                          <th className="sticky left-36 z-[1] min-w-[9rem] border-r border-teal-300 bg-teal-100 px-3 text-right font-semibold text-slate-900">Tổng {shown.length} tháng</th>
                          {shown.map((r) => <th key={r.month} className="px-3 text-right font-semibold">{r.month.slice(5)}/{r.month.slice(0, 4)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {BUCKETS.map((b) => {
                          const khSum = shown.reduce((a, r) => a + r.amounts[b.key], 0), ttSum = actSum((x) => x.per[b.key])
                          return [
                            <tr key={`${b.key}-kh`} className={cmp ? 'border-t-2 border-teal-400' : 'border-t border-teal-200'}>
                              <td className={`${STICKY1} font-semibold`}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.name}{cmp && <span className="ml-1 text-xs font-normal text-slate-600">KH</span>}</td>
                              <td className={`${STICKY2} font-semibold`}>{money(khSum)}</td>
                              {shown.map((r) => <td key={r.month} className="px-3 text-right">{money(r.amounts[b.key])}</td>)}
                            </tr>,
                            cmp && <tr key={`${b.key}-tt`} className="border-t border-teal-200">
                              <td className={`${STICKY1} pl-6 text-slate-800`}>Thực tế</td>
                              <td className={`${STICKY2} font-semibold`}>{dash(ttSum)}</td>
                              {actMonths.map((x, i) => <td key={shown[i].month} className="px-3 text-right">{dash(x.per[b.key])}</td>)}
                            </tr>,
                            cmp && <tr key={`${b.key}-df`} className="border-t border-teal-200 text-xs" title="Kế hoạch trừ thực tế: dương = còn trong ngân sách, âm = vượt kế hoạch">
                              <td className={`${STICKY1} pl-6 text-slate-700`}>KH − TT</td>
                              <td className={`${STICKY2} font-semibold ${khSum - ttSum < 0 ? 'font-bold text-red-700' : 'text-emerald-800'}`}>{signed(khSum - ttSum)}</td>
                              {actMonths.map((x, i) => { const d = shown[i].amounts[b.key] - x.per[b.key]; return <td key={shown[i].month} className={`px-3 text-right ${d < 0 ? 'font-bold text-red-700' : 'text-emerald-800'}`}>{signed(d)}</td> })}
                            </tr>,
                            cmp && <tr key={`${b.key}-pc`} className="border-t border-teal-200 text-xs" title="(KH − TT) / KH: ▲ xanh = còn trong ngân sách, ▼ đỏ = vượt kế hoạch">
                              <td className={`${STICKY1} pl-6 text-slate-700`}>% so KH</td>
                              <td className={`${STICKY2}`}>{pctVs(khSum - ttSum, khSum)}</td>
                              {actMonths.map((x, i) => <td key={shown[i].month} className="px-3 text-right">{pctVs(shown[i].amounts[b.key] - x.per[b.key], shown[i].amounts[b.key])}</td>)}
                            </tr>,
                          ]
                        })}
                        {cmp && hasUnassignedMonths && (
                          <tr className="border-t-2 border-teal-400 text-slate-700">
                            <td className={STICKY1}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#b6c0cc' }} />Chưa phân quỹ <span className="text-xs">TT</span></td>
                            <td className={`${STICKY2} font-semibold`}>{dash(actSum((x) => x.unassigned))}</td>
                            {actMonths.map((x, i) => <td key={shown[i].month} className="px-3 text-right">{dash(x.unassigned)}</td>)}
                          </tr>)}
                        <tr className="border-t-2 border-teal-500 font-semibold">
                          <td className={STICKY1}>{cmp ? 'Tổng KH' : 'Tổng'}</td>
                          <td className={STICKY2}>{money(planShownTotal)}</td>
                          {shown.map((r) => <td key={r.month} className="px-3 text-right">{money(r.total)}</td>)}
                        </tr>
                        {cmp && <tr className="border-t border-teal-300 font-semibold">
                          <td className={STICKY1}>Tổng thực tế</td>
                          <td className={STICKY2}>{money(actSum((x) => x.total))}</td>
                          {actMonths.map((x, i) => <td key={shown[i].month} className="px-3 text-right">{money(x.total)}</td>)}
                        </tr>}
                        {cmp && <tr className="border-t border-teal-300 font-semibold" title="Kế hoạch trừ thực tế: dương = còn trong ngân sách, âm = vượt kế hoạch">
                          <td className={STICKY1}>Tổng KH − TT</td>
                          <td className={`${STICKY2} ${planShownTotal - actSum((x) => x.total) < 0 ? 'font-bold text-red-700' : 'text-emerald-800'}`}>{signed(planShownTotal - actSum((x) => x.total))}</td>
                          {actMonths.map((x, i) => { const d = shown[i].total - x.total; return <td key={shown[i].month} className={`px-3 text-right ${d < 0 ? 'font-bold text-red-700' : 'text-emerald-800'}`}>{signed(d)}</td> })}
                        </tr>}
                        {cmp && <tr className="border-t border-teal-300 font-semibold" title="(KH − TT) / KH: ▲ xanh = còn trong ngân sách, ▼ đỏ = vượt kế hoạch">
                          <td className={STICKY1}>Tổng % so KH</td>
                          <td className={STICKY2}>{pctVs(planShownTotal - actSum((x) => x.total), planShownTotal)}</td>
                          {actMonths.map((x, i) => <td key={shown[i].month} className="px-3 text-right">{pctVs(shown[i].total - x.total, shown[i].total)}</td>)}
                        </tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            : <><div className="text-sm text-slate-600">Nhập thu nhập trung bình dự kiến của từng năm để xem forecast từng tháng.</div>{cmp && actualBlock}</>}
          <div className="text-xs text-slate-600">Thiết lập lưu trong trình duyệt này (không nằm trong file sao lưu).</div>
        </div>
      </>}
    </section>
  )
}
