import { useState } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { analyze, yearsOf, forYear, categoriesForTags } from '../lib/bmAnalysis.js'
import { isInflow } from '../lib/schema.js'
import { Chart, SelectField } from './ui.jsx'

// Bảng màu phân loại cố định theo thứ tự; lát "tag nhỏ khác" xám đậm, "chưa gắn tag" xám nhạt
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
const GREY = { rest: '#64748b', none: '#b6c0cc' }
const pctLabel = (p) => `${(p * 100).toFixed(1)}%`

const SMALL = ['#7c8aa0', '#8e9bb0', '#a3aebf', '#b6c0cc'] // các tag nhỏ trong lát gộp

/** Một biểu đồ tròn tương tác: bấm lát / dòng (hoặc tick) để chọn nhiều tag → tổng % của phần chọn ở giữa vòng tròn + bảng danh mục của phần chọn. rows = các dòng của biểu đồ này. */
function PieBlock({ title, data, rows, tone }) {
  const { money } = useStore()
  const [sel, setSel] = useState([]) // key các tag đang chọn (tên tag, hoặc '__none'); rỗng = chưa chọn gì
  const slices = data.slices.map((x, i) => ({ ...x, color: x.kind === 'tag' ? PALETTE[i % PALETTE.length] : GREY[x.kind] })) // màu giữ nguyên khi chọn
  const rest = slices.find((x) => x.kind === 'rest')
  const kids = rest ? rest.children.map((c, i) => ({ ...c, color: SMALL[i % SMALL.length] })) : []
  const kidKeys = kids.map((c) => c.key)
  const leaves = [...slices.filter((x) => x.kind !== 'rest'), ...kids]
  const keyOf = (x) => (x.kind === 'none' ? '__none' : x.key) // key dùng để chọn / tra dòng
  const on = (k) => sel.includes(k)
  const restOn = kids.length > 0 && kidKeys.every(on), restSome = kidKeys.some(on)
  const sliceOn = (x) => (x.kind === 'rest' ? restSome : on(keyOf(x)))
  const toggle = (k) => setSel((o) => {
    if (k === '__rest') return kidKeys.every((c) => o.includes(c)) ? o.filter((x) => !kidKeys.includes(x)) : [...new Set([...o, ...kidKeys])]
    return o.includes(k) ? o.filter((x) => x !== k) : [...o, k]
  })
  const picked = leaves.filter((x) => on(keyOf(x)))
  const pickedAmount = picked.reduce((a, x) => a + x.amount, 0)
  const pickedPct = data.total > 0 ? pickedAmount / data.total : 0
  const hasSel = picked.length > 0
  const detail = hasSel ? categoriesForTags(rows, picked.map(keyOf)) : null
  const row = (y, checked, indeterminate, indent, color) => (
    <label className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-violet-200 ${checked || indeterminate ? 'bg-violet-200' : hasSel ? 'opacity-60' : ''} ${indent ? 'ml-5' : ''}`}>
      <input type="checkbox" checked={checked} ref={(el) => { if (el) el.indeterminate = indeterminate && !checked }} onChange={() => toggle(y.kind === 'rest' ? '__rest' : keyOf(y))} />
      <span className={`inline-block shrink-0 rounded-sm ${indent ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} style={{ background: color }} />
      <span className={`min-w-0 flex-1 truncate ${indent ? '' : 'font-medium'}`}>{y.name}</span>
      <span className="w-14 text-right">{pctLabel(y.pct)}</span>
      <span className={`w-32 text-right whitespace-nowrap ${tone}`}>{money(y.amount)}</span>
    </label>
  )
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className={`text-sm font-semibold ${tone}`}>{money(data.total)} <span className="text-xs font-normal text-slate-600">· {data.count} giao dịch</span></div>
      </div>
      {data.total <= 0
        ? <div className="rounded-lg bg-white/60 p-4 text-sm text-slate-600">Chưa có dữ liệu trong năm này (gắn tag cho giao dịch để phân loại).</div>
        : <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <span>Bấm lát hoặc dòng để chọn nhiều tag.</span>
              <button type="button" className="text-blue-700 underline" onClick={() => setSel(leaves.map(keyOf))}>Chọn tất cả</button>
              <button type="button" className="text-blue-700 underline" onClick={() => setSel([])}>Bỏ chọn</button>
            </div>
            <div className="relative">
              <Chart height={230}>
                <PieChart margin={{ top: 12, right: 44, bottom: 12, left: 44 }}>
                  <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="#ede9fe" strokeWidth={2} isAnimationActive={false} cursor="pointer"
                    onClick={(d) => toggle(d.key ?? d.payload?.key)}
                    label={({ x, y, textAnchor, payload }) => (payload.pct >= 0.05 ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b" opacity={!hasSel || sliceOn(payload) ? 1 : 0.4}>{pctLabel(payload.pct)}</text> : null)} labelLine={false}>
                    {slices.map((x) => <Cell key={x.key} fill={x.color} fillOpacity={!hasSel || sliceOn(x) ? 1 : 0.25} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, { payload }) => [`${money(v)} · ${pctLabel(payload.pct)}`, n]} />
                </PieChart>
              </Chart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                {hasSel
                  ? <><div className="text-xl font-bold text-slate-900">{pctLabel(pickedPct)}</div><div className="text-xs text-slate-700">{picked.length} tag đã chọn</div></>
                  : <><div className="text-xs text-slate-700">Tổng</div><div className="text-sm font-semibold text-slate-900">100%</div></>}
              </div>
            </div>
            <ul className="text-sm space-y-1">
              {slices.map((x) => (
                <li key={x.key}>
                  {row(x, x.kind === 'rest' ? restOn : on(keyOf(x)), x.kind === 'rest' && restSome, false, x.color)}
                  {x.kind === 'rest' && kids.map((c) => <div key={c.key}>{row(c, on(c.key), false, true, c.color)}</div>)}
                </li>))}
              <li className={`flex items-center gap-2 border-t border-violet-300 px-1 pt-1.5 ${hasSel ? 'font-bold text-slate-900' : 'font-semibold'}`}>
                <span className="inline-block w-[1.875rem] shrink-0" />
                <span className="flex-1">{hasSel ? `Tổng ${picked.length} tag đã chọn` : 'Tổng'}</span>
                <span className="w-14 text-right">{hasSel ? pctLabel(pickedPct) : '100%'}</span>
                <span className={`w-32 text-right whitespace-nowrap ${tone}`}>{money(hasSel ? pickedAmount : data.total)}</span>
              </li>
            </ul>
            {detail && (
              <div className="rounded-lg border border-violet-300 bg-white/60 p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">Danh mục trong phần đã chọn</span>
                  <span className="text-xs text-slate-700">{money(detail.total)} · {pctLabel(pickedPct)} tổng · {detail.count} giao dịch</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-700"><tr><th className="py-0.5 pr-3">Danh mục</th><th className="pr-3 text-right">Số tiền</th><th className="pr-3 text-right">% trong phần chọn</th><th className="text-right">Số GD</th></tr></thead>
                  <tbody>
                    {detail.items.map((x) => (
                      <tr key={x.category} className="border-t border-violet-200"><td className="py-1 pr-3 font-medium">{x.category}</td><td className="pr-3 text-right whitespace-nowrap">{money(x.amount)}</td><td className="pr-3 text-right">{pctLabel(x.pct)}</td><td className="text-right text-slate-700">{x.count}</td></tr>))}
                  </tbody>
                </table>
              </div>)}
          </>}
    </div>
  )
}

/** Dropdown "Phân tích thu chi Ví BM" (tab Ví BM): chọn năm, hai biểu đồ tròn Thu và Chi theo tag. rows = các dòng Ví BM đang được tính (đang tick). */
export default function BmAnalysis({ rows }) {
  const { money } = useStore()
  const [open, setOpen] = useState(false) // mặc định đóng
  const [fYear, setFYear] = useState('all')
  const years = yearsOf(rows)
  const year = years.includes(fYear) ? fYear : 'all'
  const a = analyze(rows, year)
  const yearRows = forYear(rows, year)
  const incomeRows = yearRows.filter(isInflow), expenseRows = yearRows.filter((r) => !isInflow(r))
  return (
    <section className={`rounded-xl border border-violet-300 bg-violet-100 ${open ? 'space-y-3 p-4' : 'px-4 py-2'}`}>
      <div className="flex cursor-pointer select-none items-baseline justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <h3 className="font-semibold text-slate-800">
          <span className="mr-1 inline-block w-4 text-slate-600">{open ? '▾' : '▸'}</span>📊 Phân tích thu chi Ví BM
          <span className="ml-2 text-xs font-normal text-slate-600">theo năm · theo tag · biểu đồ tròn</span>
        </h3>
        <span className="text-xs text-slate-600">{open ? 'Bấm để đóng' : `Ròng ${money(a.net)} · bấm để mở`}</span>
      </div>
      {open && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <SelectField label="Năm" value={year} onChange={setFYear} options={[{ value: 'all', label: 'Tất cả năm' }, ...years.map((y) => ({ value: y, label: y }))]} />
            <div className="grid flex-1 grid-cols-1 gap-3 pb-1 sm:grid-cols-3">
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-xs text-slate-600">Thu</div><div className="font-semibold text-emerald-800">{money(a.income.total)}</div></div>
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-xs text-slate-600">Chi</div><div className="font-semibold text-red-700">{money(a.expense.total)}</div></div>
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-xs text-slate-600">Ròng (Thu − Chi)</div><div className={`font-semibold ${a.net < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{a.net > 0 ? '+' : ''}{money(a.net)}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PieBlock title="Thu theo tag" data={a.income} rows={incomeRows} tone="text-emerald-800" />
            <PieBlock title="Chi theo tag" data={a.expense} rows={expenseRows} tone="text-red-700" />
          </div>
          <div className="text-xs text-slate-600">Theo năm đang chọn và các dòng đang tick; không gồm chuyển nội bộ. Bấm lát hoặc dòng để chọn nhiều tag và xem tổng % cùng danh mục của phần đã chọn. Giao dịch nhiều tag được chia đều cho các tag; chưa gắn tag là lát xám nhạt. Tối đa 7 tag có màu riêng, tag nhỏ hơn gộp một lát xám nhưng vẫn liệt kê bên dưới.</div>
        </div>)}
    </section>
  )
}
