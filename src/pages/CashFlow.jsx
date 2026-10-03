import { useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { isInflow, isTransfer, TABS, WALLET_MOVE_CATEGORY, BM_FUND_CATEGORY, isDebtPayment } from '../lib/schema.js'
import { totals } from '../lib/calc.js'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod, spanMonths } from '../lib/period.js'
import { Stat } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { buildCsvRows, CSV_HEADER } from '../lib/csvImport.js'

export default function CashFlow({ kind, onImport }) {
  const { data, money, remove, removeMany, importBatch, settings } = useStore()
  const rows = data[kind]
  const { period } = usePeriod()
  const csvRef = useRef(null)
  const onCsv = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng file
    if (!file) return
    const { rows: fresh, skipped, errors } = buildCsvRows(kind, await file.text(), rows, settings.user || 'me')
    if (errors.length) return alert(`Không nhập được — file có lỗi (chưa ghi gì):\n\n${errors.slice(0, 8).join('\n')}${errors.length > 8 ? `\n… và ${errors.length - 8} lỗi khác` : ''}`)
    if (!fresh.length) return alert(`Không có dòng mới${skipped ? ` (${skipped} dòng đã có sẵn)` : ''}.`)
    const total = fresh.reduce((a, x) => a + x.amount, 0)
    if (confirm(`Nhập ${fresh.length} giao dịch (tổng ${money(total)}) vào ${TABS[kind].tab}?${skipped ? `\nBỏ qua ${skipped} dòng đã có sẵn.` : ''}`)) await importBatch({ [kind]: fresh })
  }
  const [editing, setEditing] = useState(null) // null | {} (mới) | row
  const [openMonths, setOpenMonths] = useState({}) // `${bảng}:${yyyy-mm}` -> mở/đóng; chưa chọn thì chỉ mở tháng mới nhất
  const [sel, setSel] = useState(() => new Set()) // id các dòng đang tick
  const shown = rows.filter((r) => inPeriod(period, r.date)).sort((a, b) => b.date.localeCompare(a.date))
  const t = totals(shown)
  const picked = shown.filter((r) => sel.has(r.id)) // chỉ tính dòng đang hiển thị (đổi bộ lọc kỳ không xoá nhầm dòng ẩn)
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const delPicked = async () => { if (confirm(`Xoá ${picked.length} giao dịch đã chọn?\n\nKhông thể hoàn tác.`) && await removeMany(kind, picked)) setSel(new Set()) }
  const nMonths = spanMonths(shown)
  const perMonth = (v) => (nMonths ? Math.round(v / nMonths) : 0)
  const inLabel = kind === 'business' ? 'Doanh thu' : 'Thu nhập'

  const isWalletMove = (r) => !isTransfer(r) && r.category === WALLET_MOVE_CATEGORY
  const isFund = (r) => !isTransfer(r) && r.category === BM_FUND_CATEGORY
  const isDebt = (r) => !isInflow(r) && !isTransfer(r) && isDebtPayment(r.category)
  const debtOf = (c) => shown.filter((r) => isDebt(r) && r.category === c)
  const debtBmRows = debtOf('Trả nợ BM')
  const debtPersonalRows = debtOf('Trả nợ cá nhân')
  const debtOldRows = debtOf('Trả nợ') // dòng cũ chưa tách BM / cá nhân
  const isInvest = (r) => isInflow(r) && r.category === 'Đầu tư'
  const investRows = shown.filter(isInvest)
  const walletRows = shown.filter(isWalletMove)
  const fundRows = shown.filter(isFund)
  const outRows = shown.filter((r) => !isInflow(r) && !isTransfer(r) && !isWalletMove(r) && !isFund(r) && !isDebt(r))
  const inRows = shown.filter((r) => isInflow(r) && !isWalletMove(r) && !isFund(r) && !isInvest(r))
  const sumOf = (rs) => rs.reduce((a, r) => a + r.amount, 0)
  const moveRows = shown.filter(isTransfer)
  const sumLabel = (key, rs) => (key === 'wallet' ? `+${money(sumOf(rs.filter(isInflow)))} / −${money(sumOf(rs.filter((x) => !isInflow(x))))}` : money(sumOf(rs)))
  const groups = [
    { key: 'out', title: '⬆ Tiền đi ra', rows: outRows, always: true, tone: 'text-red-600', sum: sumLabel('out', outRows) },
    { key: 'debtBm', title: '💳 Trả nợ BM', rows: debtBmRows, always: false, tone: 'text-red-600', sum: sumLabel('debtBm', debtBmRows) },
    { key: 'debtPersonal', title: '💳 Trả nợ cá nhân', rows: debtPersonalRows, always: false, tone: 'text-red-600', sum: sumLabel('debtPersonal', debtPersonalRows) },
    { key: 'debtOld', title: '💳 Trả nợ (chưa phân loại BM / cá nhân)', rows: debtOldRows, always: false, tone: 'text-red-600', sum: sumLabel('debtOld', debtOldRows) },
    { key: 'wallet', title: '⇄ Chuyển ví', rows: walletRows, always: false, tone: 'text-indigo-600', sum: sumLabel('wallet', walletRows) },
    { key: 'in', title: `⬇ Tiền đi vào`, rows: inRows, always: true, tone: 'text-emerald-600', sum: sumLabel('in', inRows) },
    { key: 'invest', title: '📈 Đầu tư (tiền đi vào)', rows: investRows, always: false, tone: 'text-emerald-600', sum: sumLabel('invest', investRows) },
    { key: 'fund', title: '🏦 Quỹ BM', rows: fundRows, always: false, tone: 'text-emerald-600', sum: sumLabel('fund', fundRows) },
    { key: 'move', title: '↔ Chuyển nội bộ (không tính thu/chi)', rows: moveRows, always: false, tone: 'text-slate-500' },
  ]
  const monthLabel = (ym) => (ym ? `Tháng ${ym.slice(5)}/${ym.slice(0, 4)}` : 'Chưa có ngày')
  const table = (g) => {
    const years = [] // [{ y, rows, months: [{ ym, rows }] }] — mới -> cũ (g.rows đã sắp theo ngày giảm dần)
    for (const x of g.rows) {
      const ym = (x.date || '').slice(0, 7), y = ym.slice(0, 4)
      let Y = years[years.length - 1]
      if (!Y || Y.y !== y) years.push((Y = { y, rows: [], months: [] }))
      Y.rows.push(x)
      const M = Y.months[Y.months.length - 1]
      if (M && M.ym === ym) M.rows.push(x); else Y.months.push({ ym, rows: [x] })
    }
    const key = (k) => `${g.key}:${k}`
    // mặc định đóng hết cho gọn; bấm vào năm/tháng để mở
    const yearOpen = (y) => openMonths[key(y)] ?? false
    const monthOpen = (ym) => openMonths[key(ym)] ?? false
    const setOpen = (k, v) => setOpenMonths((o) => ({ ...o, [key(k)]: v }))
    const allKeys = years.flatMap((Y) => [Y.y, ...Y.months.map((M) => M.ym)])
    const allOpen = years.length > 0 && years.every((Y) => yearOpen(Y.y) && Y.months.every((M) => monthOpen(M.ym)))
    const tickRows = (rs) => { const on = rs.every((x) => sel.has(x.id)); setSel((s) => { const n = new Set(s); rs.forEach((x) => (on ? n.delete(x.id) : n.add(x.id))); return n }) }
    const all = g.rows.length > 0 && g.rows.every((r) => sel.has(r.id))
    const toggleAll = () => setSel((s) => { const n = new Set(s); g.rows.forEach((r) => (all ? n.delete(r.id) : n.add(r.id))); return n })
    return (
      <div key={g.key} className="space-y-1">
        <div className="flex items-baseline justify-between px-1">
          <h3 className={`font-semibold ${g.tone}`}>{g.title} <span className="text-xs font-normal text-slate-400">({g.rows.length})</span></h3>
          <div className="flex items-baseline gap-3">
            {allKeys.length > 2 && <button className="text-xs text-blue-600" onClick={() => setOpenMonths((o) => ({ ...o, ...Object.fromEntries(allKeys.map((k) => [key(k), !allOpen])) }))}>{allOpen ? 'Thu gọn tất cả' : 'Mở tất cả'}</button>}
            {g.sum != null && <span className={`text-sm font-medium ${g.tone}`}>{g.sum}</span>}
          </div>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 text-left"><tr><th className="px-3 py-2 w-8"><input type="checkbox" aria-label="Chọn tất cả" checked={all} onChange={toggleAll} /></th>{['Ngày', 'Loại', 'Danh mục', 'Số tiền', kind === 'business' ? 'Đối tác' : 'Tài khoản', 'Ghi chú', 'Bởi', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {years.map((Y) => {
                const yOpen = yearOpen(Y.y)
                return [
                  <tr key={`y-${Y.y}`} className="border-t border-slate-200 bg-slate-100 cursor-pointer select-none hover:bg-slate-200" onClick={() => setOpen(Y.y, !yOpen)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Chọn cả năm ${Y.y}`} checked={Y.rows.every((x) => sel.has(x.id))} onChange={() => tickRows(Y.rows)} /></td>
                    <td colSpan={4} className="px-3 py-2 font-semibold text-slate-800"><span className="inline-block w-4 text-slate-500">{yOpen ? '▾' : '▸'}</span>{Y.y ? `Năm ${Y.y}` : 'Chưa có ngày'} <span className="text-xs font-normal text-slate-500">· {Y.rows.length} giao dịch</span></td>
                    <td colSpan={4} className={`px-3 py-2 text-right font-semibold ${g.tone}`}>{sumLabel(g.key, Y.rows)}</td>
                  </tr>,
                  ...(yOpen ? Y.months.flatMap((M) => {
                    const mOpen = monthOpen(M.ym)
                    return [
                      <tr key={`h-${M.ym}`} className="border-t border-slate-100 bg-slate-50 cursor-pointer select-none hover:bg-slate-100" onClick={() => setOpen(M.ym, !mOpen)}>
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Chọn cả ${monthLabel(M.ym)}`} checked={M.rows.every((x) => sel.has(x.id))} onChange={() => tickRows(M.rows)} /></td>
                        <td colSpan={4} className="px-3 py-1.5 pl-8 font-medium text-slate-700"><span className="inline-block w-4 text-slate-400">{mOpen ? '▾' : '▸'}</span>{monthLabel(M.ym)} <span className="text-xs font-normal text-slate-400">· {M.rows.length} giao dịch</span></td>
                        <td colSpan={4} className={`px-3 py-1.5 text-right font-medium ${g.tone}`}>{sumLabel(g.key, M.rows)}</td>
                      </tr>,
                    mOpen && M.rows.map((r) => (
                      <tr key={r.id} className={`border-t border-slate-100 ${sel.has(r.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-1.5"><input type="checkbox" aria-label="Chọn dòng" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-1.5">{isTransfer(r) ? 'Chuyển nội bộ' : r.type}</td>
                        <td className="px-3 py-1.5">{r.category}</td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap ${isTransfer(r) ? 'text-slate-400' : isInflow(r) ? 'text-emerald-600' : 'text-red-600'}`}>{isTransfer(r) ? '↔' : isInflow(r) ? '+' : '−'}{money(r.amount)}</td>
                        <td className="px-3 py-1.5">{r.account ?? r.counterparty}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.note}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.created_by}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <button className="text-blue-600 mr-2" onClick={() => setEditing(r)}>Sửa</button>
                          <button className="text-red-600" onClick={() => confirm('Xoá giao dịch này?') && remove(kind, r)}>Xoá</button>
                        </td>
                      </tr>
                    ))

                    ]
                  }) : []),
                ]
              })}
              {!g.rows.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data._missing?.includes(kind) && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {TABS[kind].tab}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu.</div>}
      <FilterBar action={<div className="flex gap-2"><button className="btn-ghost" onClick={onImport}>Nhập sao kê</button><button className="btn-ghost" title={`File CSV, hàng đầu: ${CSV_HEADER.join(',')}`} onClick={() => csvRef.current?.click()}>Nhập CSV</button><input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} /><button className="btn" onClick={() => setEditing({})}>+ Thêm giao dịch</button></div>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={inLabel} value={money(t.income)} />
        <Stat label="Chi" value={money(t.expense)} />
        <Stat label="Dòng tiền ròng" value={money(t.net)} tone={t.net < 0 ? 'neg' : 'pos'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={`${inLabel} / tháng`} value={money(perMonth(t.income))} sub={nMonths ? `Trung bình trong ${nMonths} tháng` : 'Chưa có dữ liệu'} />
        <Stat label="Chi / tháng" value={money(perMonth(t.expense))} sub={nMonths ? `Trung bình trong ${nMonths} tháng` : 'Chưa có dữ liệu'} />
      </div>
      {picked.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <span>Đã chọn <b>{picked.length}</b> giao dịch</span>
          <button className="rounded-lg border border-red-300 text-red-700 px-3 py-1 hover:bg-red-50" onClick={delPicked}>Xoá đã chọn</button>
          <button className="text-slate-500 underline" onClick={() => setSel(new Set())}>Bỏ chọn</button>
        </div>)}
      {groups.map((g) => g.rows.length > 0 || g.always ? table(g) : null)}
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
