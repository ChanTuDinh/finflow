import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { isInflow } from '../lib/schema.js'
import { totals } from '../lib/calc.js'
import { Stat } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'

export default function CashFlow({ kind }) {
  const { data, money, remove } = useStore()
  const rows = data[kind]
  const months = useMemo(() => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse(), [rows])
  const [month, setMonth] = useState('all')
  const [editing, setEditing] = useState(null) // null | {} (mới) | row
  const shown = rows.filter((r) => month === 'all' || r.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))
  const t = totals(shown)
  const inLabel = kind === 'personal' ? 'Thu nhập' : 'Doanh thu'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Tất cả tháng</option>
          {months.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button className="btn ml-auto" onClick={() => setEditing({})}>+ Thêm giao dịch</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
                <td className="px-3 py-1.5">{r.type}</td>
                <td className="px-3 py-1.5">{r.category}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${isInflow(r) ? 'text-emerald-600' : 'text-red-600'}`}>{isInflow(r) ? '+' : '−'}{money(r.amount)}</td>
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
