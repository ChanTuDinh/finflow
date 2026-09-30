import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Stat } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'

export default function Debts() {
  const { data, money, remove } = useStore()
  const [editing, setEditing] = useState(null)
  const active = data.debts.filter((d) => d.status !== 'Paid')
  const total = active.reduce((s, d) => s + d.balance, 0)
  const min = active.reduce((s, d) => s + d.min_payment, 0)
  const interest = active.reduce((s, d) => s + (d.balance * d.apr) / 1200, 0)

  return (
    <div className="space-y-4">
      <div className="flex"><button className="btn ml-auto" onClick={() => setEditing({})}>+ Thêm khoản nợ</button></div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng dư nợ" value={money(total)} />
        <Stat label="Trả tối thiểu / tháng" value={money(min)} />
        <Stat label="Lãi phát sinh / tháng" value={money(interest)} tone="neg" />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left"><tr>{['Khoản nợ', 'Bên cho vay', 'Thuộc về', 'Dư nợ', 'Lãi %/năm', 'Tối thiểu', 'Hạn', 'Trạng thái', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {data.debts.map((d) => (
              <tr key={d.id} className={`border-t border-slate-100 ${d.status === 'Paid' ? 'opacity-50' : ''}`}>
                <td className="px-3 py-1.5 font-medium">{d.name}</td>
                <td className="px-3 py-1.5">{d.lender}</td>
                <td className="px-3 py-1.5">{d.owner}</td>
                <td className="px-3 py-1.5 text-right">{money(d.balance)}</td>
                <td className="px-3 py-1.5 text-right">{d.apr}</td>
                <td className="px-3 py-1.5 text-right">{money(d.min_payment)}</td>
                <td className="px-3 py-1.5">ngày {d.due_day}</td>
                <td className="px-3 py-1.5">{d.status}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button className="text-blue-600 mr-2" onClick={() => setEditing(d)}>Sửa</button>
                  <button className="text-red-600" onClick={() => confirm('Xoá khoản nợ này?') && remove('debts', d)}>Xoá</button>
                </td>
              </tr>
            ))}
            {!data.debts.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Chưa có khoản nợ</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <EntryForm kind="debts" row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
