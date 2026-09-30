import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Stat, SelectField, Segmented, FilterRow } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'
import { activeAccounts, goalStatus } from '../lib/savings.js'
import { addMonths } from '../lib/calc.js'
import { pct, todayIso } from '../lib/format.js'

const OWNER = { Personal: 'Cá nhân', Business: 'Doanh nghiệp' }

export default function Savings() {
  const { data, money, remove } = useStore()
  const [editing, setEditing] = useState(null) // { kind, row }
  const [scope, setScope] = useState('all')
  const [show, setShow] = useState('active') // active | all
  const owner = scope === 'personal' ? 'Personal' : scope === 'business' ? 'Business' : null
  const inScope = (x) => !owner || x.owner === owner
  const savings = data.savings.filter(inScope).filter((a) => show === 'all' || a.status !== 'Closed')
  const goals = data.goals.filter(inScope).filter((g) => show === 'all' || g.status !== 'Done')
  const startYm = todayIso().slice(0, 7)
  const accs = activeAccounts(data.savings.filter(inScope))
  const total = accs.reduce((s, a) => s + a.balance, 0)
  const monthly = accs.reduce((s, a) => s + a.monthly_contribution, 0)
  const yearly = accs.reduce((s, a) => s + (a.balance * a.annual_return) / 100, 0)
  const goalName = (id) => data.goals.find((g) => g.id === id)?.name || ''
  const missing = data._missing?.filter((k) => k === 'savings' || k === 'goals') || []

  return (
    <div className="space-y-4">
      {missing.length > 0 && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {missing.map((k) => (k === 'savings' ? 'Savings' : 'Goals')).join(', ')}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu tích lũy.</div>}
      <FilterRow>
        <SelectField label="Phạm vi" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Cá nhân + Doanh nghiệp' }, { value: 'personal', label: 'Chỉ cá nhân' }, { value: 'business', label: 'Chỉ doanh nghiệp' }]} />
        <Segmented label="Hiển thị" value={show} onChange={setShow} options={[{ value: 'active', label: 'Đang dùng' }, { value: 'all', label: 'Tất cả' }]} />
      </FilterRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Tổng tích lũy" value={money(total)} />
        <Stat label="Góp mỗi tháng" value={money(monthly)} />
        <Stat label="Lãi/lợi nhuận kỳ vọng / năm" value={money(yearly)} tone="pos" sub="Theo số dư hiện tại" />
      </div>

      <section className="space-y-2">
        <div className="flex items-center"><h2 className="font-semibold">Mục tiêu</h2><button className="btn ml-auto" onClick={() => setEditing({ kind: 'goals' })}>+ Thêm mục tiêu</button></div>
        <div className="grid md:grid-cols-2 gap-3">
          {goals.map((g) => {
            const st = goalStatus({ goal: g, accounts: data.savings, startYm })
            const done = g.status === 'Done' || st.pct >= 1
            return (
              <div key={g.id} className={`card space-y-2 ${g.status === 'Done' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-2">
                  <div><div className="font-medium">{g.name}</div><div className="text-xs text-slate-400">{OWNER[g.owner]}{g.target_date ? ` · hạn ${g.target_date}` : ''}</div></div>
                  <div className="ml-auto whitespace-nowrap text-sm">
                    <button className="text-blue-600 mr-2" onClick={() => setEditing({ kind: 'goals', row: g })}>Sửa</button>
                    <button className="text-red-600" onClick={() => confirm('Xoá mục tiêu này? Các khoản tích lũy gắn với nó sẽ mất liên kết.') && remove('goals', g)}>Xoá</button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${done ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.round(st.pct * 100)}%` }} /></div>
                <div className="text-sm">{money(st.balance)} / {money(g.target_amount)} <span className="text-slate-400">({pct(st.pct)})</span></div>
                {!done && (
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {st.eta != null ? <div>Theo mức góp hiện tại, đạt sau <b>{st.eta} tháng</b> ({addMonths(startYm, st.eta)}){g.target_date && (st.onTrack ? ' ✅ kịp hạn' : ' ⚠️ trễ hạn')}</div>
                      : <div>{st.linked.length ? 'Với mức góp hiện tại sẽ không đạt mục tiêu' : 'Chưa có khoản tích lũy nào gắn với mục tiêu này'}</div>}
                    {st.required != null && st.required > 0 && <div>Cần góp ≈ <b>{money(st.required)}</b>/tháng để kịp hạn (đang góp {money(st.contrib)})</div>}
                  </div>)}
              </div>
            )
          })}
          {!goals.length && <div className="text-sm text-slate-400">Chưa có mục tiêu</div>}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center"><h2 className="font-semibold">Khoản tích lũy</h2><button className="btn ml-auto" onClick={() => setEditing({ kind: 'savings' })}>+ Thêm khoản tích lũy</button></div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 text-left"><tr>{['Tên', 'Loại', 'Thuộc về', 'Số dư', 'Góp / tháng', 'Lãi %/năm', 'Mục tiêu', 'Trạng thái', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {savings.map((a) => (
                <tr key={a.id} className={`border-t border-slate-100 ${a.status === 'Closed' ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-1.5 font-medium">{a.name}</td>
                  <td className="px-3 py-1.5">{a.type}</td>
                  <td className="px-3 py-1.5">{OWNER[a.owner]}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(a.balance)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(a.monthly_contribution)}</td>
                  <td className="px-3 py-1.5 text-right">{a.annual_return}</td>
                  <td className="px-3 py-1.5">{goalName(a.goal_id)}</td>
                  <td className="px-3 py-1.5">{a.status}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <button className="text-blue-600 mr-2" onClick={() => setEditing({ kind: 'savings', row: a })}>Sửa</button>
                    <button className="text-red-600" onClick={() => confirm('Xoá khoản tích lũy này?') && remove('savings', a)}>Xoá</button>
                  </td>
                </tr>
              ))}
              {!savings.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Chưa có khoản tích lũy</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <EntryForm kind={editing.kind} row={editing.row?.id ? editing.row : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
