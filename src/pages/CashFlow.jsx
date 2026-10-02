import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { isInflow, isTransfer, TABS } from '../lib/schema.js'
import { totals } from '../lib/calc.js'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod } from '../lib/period.js'
import { Stat } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'
import FilterBar from '../components/FilterBar.jsx'

export default function CashFlow({ kind, onImport }) {
  const { data, money, remove, removeMany, clearKind } = useStore()
  const rows = data[kind]
  const { period } = usePeriod()
  const [editing, setEditing] = useState(null) // null | {} (mới) | row
  const [sel, setSel] = useState(() => new Set()) // id các dòng đang tick
  const shown = rows.filter((r) => inPeriod(period, r.date)).sort((a, b) => b.date.localeCompare(a.date))
  const t = totals(shown)
  const picked = shown.filter((r) => sel.has(r.id)) // chỉ tính dòng đang hiển thị (đổi bộ lọc kỳ không xoá nhầm dòng ẩn)
  const allPicked = shown.length > 0 && picked.length === shown.length
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const delPicked = async () => { if (confirm(`Xoá ${picked.length} giao dịch đã chọn?\n\nKhông thể hoàn tác.`) && await removeMany(kind, picked)) setSel(new Set()) }
  const inLabel = kind === 'business' ? 'Doanh thu' : 'Thu nhập'

  return (
    <div className="space-y-4">
      {data._missing?.includes(kind) && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {TABS[kind].tab}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu.</div>}
      <FilterBar action={<div className="flex gap-2"><button className="btn-ghost" onClick={onImport}>Nhập sao kê</button><button className="btn" onClick={() => setEditing({})}>+ Thêm giao dịch</button></div>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={inLabel} value={money(t.income)} />
        <Stat label="Chi" value={money(t.expense)} />
        <Stat label="Dòng tiền ròng" value={money(t.net)} tone={t.net < 0 ? 'neg' : 'pos'} />
      </div>
      {picked.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <span>Đã chọn <b>{picked.length}</b> giao dịch</span>
          <button className="rounded-lg border border-red-300 text-red-700 px-3 py-1 hover:bg-red-50" onClick={delPicked}>Xoá đã chọn</button>
          <button className="text-slate-500 underline" onClick={() => setSel(new Set())}>Bỏ chọn</button>
        </div>)}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left"><tr><th className="px-3 py-2 w-8"><input type="checkbox" aria-label="Chọn tất cả" checked={allPicked} onChange={() => setSel(allPicked ? new Set() : new Set(shown.map((r) => r.id)))} /></th>{['Ngày', 'Loại', 'Danh mục', 'Số tiền', kind === 'business' ? 'Đối tác' : 'Tài khoản', 'Ghi chú', 'Bởi', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
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
            ))}
            {!shown.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
      {kind === 'bm' && rows.length > 0 && (
        <div className="flex justify-end">
          <button className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50"
            onClick={() => confirm(`Xoá TOÀN BỘ ${rows.length} giao dịch của Ví BM (mọi năm)?\n\nKhông thể hoàn tác. Dữ liệu các tab khác không bị ảnh hưởng.`) && clearKind('bm')}>
            Xoá toàn bộ dữ liệu Ví BM ({rows.length})
          </button>
        </div>)}
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
