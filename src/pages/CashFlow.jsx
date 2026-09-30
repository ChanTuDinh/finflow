import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { isInflow, isTransfer } from '../lib/schema.js'
import { totals } from '../lib/calc.js'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod } from '../lib/period.js'
import { Stat } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'
import FilterBar from '../components/FilterBar.jsx'

export default function CashFlow({ kind, onImport }) {
  const { data, money, remove } = useStore()
  const rows = data[kind]
  const { period } = usePeriod()
  const [editing, setEditing] = useState(null) // null | {} (mới) | row
  const shown = rows.filter((r) => inPeriod(period, r.date)).sort((a, b) => b.date.localeCompare(a.date))
  const t = totals(shown)
  const inLabel = kind === 'personal' ? 'Thu nhập' : 'Doanh thu'

  return (
    <div className="space-y-4">
      <FilterBar action={<div className="flex gap-2"><button className="btn-ghost" onClick={onImport}>Nhập sao kê</button><button className="btn" onClick={() => setEditing({})}>+ Thêm giao dịch</button></div>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={inLabel} value={money(t.income)} />
        <Stat label="Chi" value={money(t.expense)} />
        <Stat label="Dòng tiền ròng" value={money(t.net)} tone={t.net < 0 ? 'neg' : 'pos'} />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left"><tr>{['Ngày', 'Loại', 'Danh mục', 'Số tiền', kind === 'personal' ? 'Tài khoản' : 'Đối tác', 'Ghi chú', 'Bởi', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
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
            {!shown.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
