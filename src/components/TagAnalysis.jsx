import { useState } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { useStore } from '../lib/store.jsx'
import { tagBreakdown, pieSlices } from '../lib/tags.js'
import { Chart } from './ui.jsx'

// Màu theo thứ tự cố định (bảng màu phân loại đã kiểm tra); lát "tag nhỏ khác" và "chưa gắn tag" dùng xám để không tranh màu với tag thật
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
const GREY = { rest: '#64748b', none: '#b6c0cc' }
const pctLabel = (p) => `${(p * 100).toFixed(1)}%`

/** Dropdown "Phân tích chi tiêu cá nhân": biểu đồ tròn chi theo tag (số tiền và %), trên các dòng chi đang được tính (đúng kỳ lọc và đang tick). */
export default function TagAnalysis({ rows }) {
  const { money } = useStore()
  const [open, setOpen] = useState(false) // mặc định đóng
  const [off, setOff] = useState([]) // key các lát đang bỏ chọn (mặc định chọn hết)
  const b = tagBreakdown(rows)
  const all = pieSlices(b).map((x, i) => ({ ...x, color: x.kind === 'tag' ? PALETTE[i % PALETTE.length] : GREY[x.kind] })) // màu giữ nguyên dù chọn / bỏ chọn
  const on = (k) => !off.includes(k)
  const toggle = (k) => setOff((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const picked = all.filter((x) => on(x.key))
  const pickedTotal = picked.reduce((a, x) => a + x.amount, 0)
  const slices = picked.map((x) => ({ ...x, pct: pickedTotal > 0 ? x.amount / pickedTotal : 0 })) // % tính trên phần đang chọn
  const subset = picked.length < all.length
  return (
    <section className={`rounded-xl border border-sky-200 bg-sky-100 ${open ? 'space-y-2 p-4' : 'px-4 py-2'}`}>
      <div className="flex cursor-pointer select-none items-baseline justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <h3 className="font-semibold text-slate-700">
          <span className="mr-1 inline-block w-4 text-slate-600">{open ? '▾' : '▸'}</span>🏷 Phân tích chi tiêu cá nhân
          <span className="ml-2 text-xs font-normal text-slate-600">theo tag · {b.items.length} tag{open && subset ? ` · đang chọn ${picked.length}/${all.length}` : ''}</span>
        </h3>
        <span className="text-sm font-medium text-red-700">{money(open && subset ? pickedTotal : b.total)}</span>
      </div>
      {open && (
        <div>
          {b.total <= 0
            ? <div className="text-sm text-slate-600">Chưa có khoản chi nào trong kỳ đang chọn.</div>
            : <>
                <div className="mb-1 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <span>Bấm vào tag trong danh sách (hoặc lát trên biểu đồ) để chọn / bỏ chọn nhiều tag.</span>
                  <button className="text-blue-700 underline" onClick={() => setOff([])}>Chọn tất cả</button>
                  <button className="text-blue-700 underline" onClick={() => setOff(all.map((x) => x.key))}>Bỏ chọn tất cả</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {slices.length > 0
                    ? <Chart height={300}>
                        <PieChart margin={{ top: 16, right: 48, bottom: 16, left: 48 }}>
                          <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={52} outerRadius={96} paddingAngle={2} stroke="#e0f2fe" strokeWidth={2} isAnimationActive={false} cursor="pointer"
                            onClick={(d) => toggle(d.key ?? d.payload?.key)}
                            label={({ x, y, textAnchor, payload }) => (payload.pct >= 0.04 ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b">{pctLabel(payload.pct)}</text> : null)} labelLine={false}>
                            {slices.map((x) => <Cell key={x.key} fill={x.color} />)}
                          </Pie>
                          <Tooltip formatter={(v, n, { payload }) => [`${money(v)} · ${pctLabel(payload.pct)}`, n]} />
                        </PieChart>
                      </Chart>
                    : <div className="flex h-40 items-center justify-center text-sm text-slate-600">Chưa chọn tag nào.</div>}
                  <ul className="text-sm space-y-1">
                    {all.map((x) => {
                      const sel = on(x.key), shown = slices.find((y) => y.key === x.key)
                      return (
                        <li key={x.key}>
                          <label className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-sky-200 ${sel ? '' : 'opacity-50'}`}>
                            <input type="checkbox" checked={sel} onChange={() => toggle(x.key)} />
                            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color }} />
                            <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                            <span className="w-14 text-right">{shown ? pctLabel(shown.pct) : '—'}</span>
                            <span className="w-32 text-right whitespace-nowrap text-red-700">{money(x.amount)}</span>
                          </label>
                        </li>)
                    })}
                    <li className="flex items-center gap-2 border-t border-sky-400 px-1 pt-1.5 font-semibold">
                      <span className="inline-block w-[1.875rem] shrink-0" />
                      <span className="flex-1">{subset ? `Tổng đang chọn (${picked.length}/${all.length})` : 'Tổng chi'}</span>
                      <span className="w-14 text-right">{pickedTotal > 0 ? '100%' : '—'}</span>
                      <span className="w-32 text-right whitespace-nowrap text-red-700">{money(pickedTotal)}</span>
                    </li>
                    {subset && <li className="px-1 text-xs text-slate-600">Tổng chi toàn bộ: {money(b.total)} · phần đang chọn chiếm {pctLabel(b.total > 0 ? pickedTotal / b.total : 0)}</li>}
                  </ul>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Theo kỳ lọc Năm / Quý / Tháng phía trên và chỉ các dòng đang tick; tổng chi khớp thẻ "Chi". Giao dịch có nhiều tag được chia đều cho các tag đó. Tối đa 7 tag lớn nhất có màu riêng, phần còn lại gộp vào một lát xám. Khi chọn một phần, % trên biểu đồ tính trên phần đang chọn.
                </div>
              </>}
        </div>)}
    </section>
  )
}
