import { useState } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { analyze, yearsOf } from '../lib/bmAnalysis.js'
import { Chart, SelectField } from './ui.jsx'

// Bảng màu phân loại cố định theo thứ tự; lát "tag nhỏ khác" xám đậm, "chưa gắn tag" xám nhạt
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
const GREY = { rest: '#64748b', none: '#b6c0cc' }
const pctLabel = (p) => `${(p * 100).toFixed(1)}%`

function PieBlock({ title, data, tone }) {
  const { money } = useStore()
  const slices = data.slices.map((x, i) => ({ ...x, color: x.kind === 'tag' ? PALETTE[i % PALETTE.length] : GREY[x.kind] }))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className={`text-sm font-semibold ${tone}`}>{money(data.total)} <span className="text-xs font-normal text-slate-600">· {data.count} giao dịch</span></div>
      </div>
      {data.total <= 0
        ? <div className="rounded-lg bg-white/60 p-4 text-sm text-slate-600">Chưa có dữ liệu trong năm này (gắn tag cho giao dịch để phân loại).</div>
        : <>
            <Chart height={230}>
              <PieChart margin={{ top: 12, right: 44, bottom: 12, left: 44 }}>
                <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={44} outerRadius={78} paddingAngle={2} stroke="#ede9fe" strokeWidth={2} isAnimationActive={false}
                  label={({ x, y, textAnchor, payload }) => (payload.pct >= 0.05 ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b">{pctLabel(payload.pct)}</text> : null)} labelLine={false}>
                  {slices.map((x) => <Cell key={x.key} fill={x.color} />)}
                </Pie>
                <Tooltip formatter={(v, n, { payload }) => [`${money(v)} · ${pctLabel(payload.pct)}`, n]} />
              </PieChart>
            </Chart>
            <ul className="text-sm space-y-1">
              {slices.map((x) => (
                <li key={x.key}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                    <span className="w-14 text-right">{pctLabel(x.pct)}</span>
                    <span className={`w-32 text-right whitespace-nowrap ${tone}`}>{money(x.amount)}</span>
                  </div>
                  {x.kind === 'rest' && x.children.map((c) => (
                    <div key={c.key} className="ml-5 flex items-center gap-2 text-slate-700">
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="w-14 text-right">{pctLabel(c.pct)}</span>
                      <span className="w-32 text-right whitespace-nowrap">{money(c.amount)}</span>
                    </div>))}
                </li>))}
            </ul>
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
            <PieBlock title="Thu theo tag" data={a.income} tone="text-emerald-800" />
            <PieBlock title="Chi theo tag" data={a.expense} tone="text-red-700" />
          </div>
          <div className="text-xs text-slate-600">Theo năm đang chọn và các dòng đang tick; không gồm chuyển nội bộ. Giao dịch nhiều tag được chia đều cho các tag; chưa gắn tag là lát xám nhạt. Tối đa 7 tag có màu riêng, tag nhỏ hơn gộp một lát xám nhưng vẫn liệt kê bên dưới.</div>
        </div>)}
    </section>
  )
}
