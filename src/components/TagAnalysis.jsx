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
  const [sel, setSel] = useState([]) // key các lát đang chọn để xem tổng; rỗng = không chọn gì (biểu đồ hiện bình thường)
  const b = tagBreakdown(rows)
  const slices = pieSlices(b).map((x, i) => ({ ...x, color: x.kind === 'tag' ? PALETTE[i % PALETTE.length] : GREY[x.kind] })) // luôn đủ 100% tổng chi
  const on = (k) => sel.includes(k)
  const toggle = (k) => setSel((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const picked = slices.filter((x) => on(x.key))
  const pickedAmount = picked.reduce((a, x) => a + x.amount, 0)
  const pickedPct = b.total > 0 ? pickedAmount / b.total : 0
  const hasSel = picked.length > 0
  return (
    <section className={`rounded-xl border border-sky-200 bg-sky-100 ${open ? 'space-y-2 p-4' : 'px-4 py-2'}`}>
      <div className="flex cursor-pointer select-none items-baseline justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <h3 className="font-semibold text-slate-700">
          <span className="mr-1 inline-block w-4 text-slate-600">{open ? '▾' : '▸'}</span>🏷 Phân tích chi tiêu cá nhân
          <span className="ml-2 text-xs font-normal text-slate-600">theo tag · {b.items.length} tag</span>
        </h3>
        <span className="text-sm font-medium text-red-700">{money(b.total)}</span>
      </div>
      {open && (
        <div>
          {b.total <= 0
            ? <div className="text-sm text-slate-600">Chưa có khoản chi nào trong kỳ đang chọn.</div>
            : <>
                <div className="mb-1 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <span>Chọn nhiều tag (tick trong danh sách hoặc bấm lát trên biểu đồ) để xem tổng các tag đó chiếm bao nhiêu % tổng chi.</span>
                  <button className="text-blue-700 underline" onClick={() => setSel(slices.map((x) => x.key))}>Chọn tất cả</button>
                  <button className="text-blue-700 underline" onClick={() => setSel([])}>Bỏ chọn</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="relative">
                    <Chart height={300}>
                      <PieChart margin={{ top: 16, right: 48, bottom: 16, left: 48 }}>
                        <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={2} stroke="#e0f2fe" strokeWidth={2} isAnimationActive={false} cursor="pointer"
                          onClick={(d) => toggle(d.key ?? d.payload?.key)}
                          label={({ x, y, textAnchor, payload }) => (payload.pct >= 0.04 ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#0b0b0b" opacity={!hasSel || on(payload.key) ? 1 : 0.4}>{pctLabel(payload.pct)}</text> : null)} labelLine={false}>
                          {slices.map((x) => <Cell key={x.key} fill={x.color} fillOpacity={!hasSel || on(x.key) ? 1 : 0.25} />)}
                        </Pie>
                        <Tooltip formatter={(v, n, { payload }) => [`${money(v)} · ${pctLabel(payload.pct)}`, n]} />
                      </PieChart>
                    </Chart>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      {hasSel
                        ? <><div className="text-2xl font-bold text-slate-900">{pctLabel(pickedPct)}</div><div className="text-xs text-slate-700">{picked.length} tag đã chọn</div></>
                        : <><div className="text-xs text-slate-700">Tổng chi</div><div className="text-sm font-semibold text-slate-900">100%</div></>}
                    </div>
                  </div>
                  <ul className="text-sm space-y-1">
                    {slices.map((x) => {
                      const sl = on(x.key)
                      return (
                        <li key={x.key}>
                          <label className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-sky-200 ${sl ? 'bg-sky-200' : hasSel ? 'opacity-60' : ''}`}>
                            <input type="checkbox" checked={sl} onChange={() => toggle(x.key)} />
                            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: x.color }} />
                            <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                            <span className="w-14 text-right">{pctLabel(x.pct)}</span>
                            <span className="w-32 text-right whitespace-nowrap text-red-700">{money(x.amount)}</span>
                          </label>
                        </li>)
                    })}
                    <li className={`flex items-center gap-2 border-t border-sky-400 px-1 pt-1.5 ${hasSel ? 'font-bold text-slate-900' : 'font-semibold'}`}>
                      <span className="inline-block w-[1.875rem] shrink-0" />
                      <span className="flex-1">{hasSel ? `Tổng ${picked.length} tag đã chọn` : 'Tổng chi'}</span>
                      <span className="w-14 text-right">{hasSel ? pctLabel(pickedPct) : '100%'}</span>
                      <span className="w-32 text-right whitespace-nowrap text-red-700">{money(hasSel ? pickedAmount : b.total)}</span>
                    </li>
                    {hasSel && <li className="px-1 text-xs text-slate-600">Trên tổng chi {money(b.total)} (= 100%)</li>}
                  </ul>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Theo kỳ lọc Năm / Quý / Tháng phía trên và chỉ các dòng đang tick; tổng chi khớp thẻ "Chi". Giao dịch có nhiều tag được chia đều cho các tag đó. Tối đa 7 tag lớn nhất có màu riêng, phần còn lại gộp vào một lát xám.
                </div>
              </>}
        </div>)}
    </section>
  )
}
