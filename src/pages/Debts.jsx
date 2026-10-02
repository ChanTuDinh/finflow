import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Stat, SelectField } from '../components/ui.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod, monthsIn, labelOf, levelName } from '../lib/period.js'
import { DEBT_PAYMENT_CATEGORY, TABS, isInterestOnly, SCOPE_OWNER, debtScopeOptions, cashRowsForScope } from '../lib/schema.js'
import EntryForm from '../components/EntryForm.jsx'
import { useDebtSelection } from '../lib/selection.jsx'

// kind: 'debts' (nguồn nợ chính) | 'debts_bm' (nguồn nợ BM) — cùng giao diện, dữ liệu riêng.
const RATE_COL = 'Lãi %/năm' // cột được tô nổi

export default function Debts({ kind = 'debts' }) {
  const { data, money, remove } = useStore()
  const [editing, setEditing] = useState(null)
  const { period } = usePeriod()
  const [scope, setScope] = useState('all')
  const owner = SCOPE_OWNER[scope]
  const main = kind === 'debts'
  const debts = data[kind].filter((d) => !owner || d.owner === owner)
  // Các số tổng hợp chỉ tính những khoản đã tick
  const sel = useDebtSelection(kind)
  const chosen = sel.filter(debts)
  const active = chosen.filter((d) => d.status !== 'Paid')
  const allTicked = debts.length > 0 && chosen.length === debts.length
  const someTicked = chosen.length > 0 && chosen.length < debts.length
  const headBox = useRef(null)
  useEffect(() => { if (headBox.current) headBox.current.indeterminate = someTicked }, [someTicked])
  const total = active.reduce((s, d) => s + d.balance, 0)
  const min = active.reduce((s, d) => s + d.min_payment, 0)
  const interest = active.reduce((s, d) => s + (d.balance * d.apr) / 1200, 0)
  const cash = cashRowsForScope(data, scope)
  const paidInPeriod = cash.filter((r) => r.category === DEBT_PAYMENT_CATEGORY && r.type === 'Expense' && inPeriod(period, r.date)).reduce((s, r) => s + r.amount, 0)
  const interestInPeriod = interest * monthsIn(period, cash)
  const periodTitle = period.level === 'all' ? levelName.all : `${levelName[period.level]} ${labelOf(period)}`

  return (
    <div className="space-y-4">
      <FilterBar
        lead={<SelectField label="Phạm vi" value={scope} onChange={setScope} options={debtScopeOptions(kind)} />}
        action={<button className="btn" onClick={() => setEditing({})}>+ Thêm khoản nợ</button>} />
      {debts.length > 0 && chosen.length < debts.length && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm px-3 py-2 flex items-center gap-2">
          Đang tính <b>{chosen.length}/{debts.length}</b> khoản nợ đã tick (số liệu bên dưới và tab Forecast chỉ gồm các khoản này).
          <button className="ml-auto underline whitespace-nowrap" onClick={() => sel.setMany(debts.map((d) => d.id), true)}>Chọn tất cả</button>
        </div>)}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Tổng dư nợ hiện tại" value={money(total)} />
        <Stat label="Trả tối thiểu / tháng" value={money(min)} />
        <Stat label="Lãi phát sinh / tháng" value={money(interest)} tone="neg" />
      </div>
      {data._missing?.includes(kind) && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {TABS[kind].tab}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu.</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {main && <Stat label={`Đã trả nợ — ${periodTitle}`} value={money(paidInPeriod)} sub="Tổng chi 'Trả nợ' (cá nhân + DN) — không lọc theo khoản nợ đã tick" />}
        <Stat label={`Lãi ước tính — ${periodTitle}`} value={money(interestInPeriod)} tone="neg" sub="Ước tính theo dư nợ hiện tại × số tháng" />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left"><tr><th className="pl-3 py-2 w-8"><input ref={headBox} type="checkbox" aria-label="Chọn tất cả" checked={allTicked} onChange={(e) => sel.setMany(debts.map((d) => d.id), e.target.checked)} /></th>{['Khoản nợ', 'Bên cho vay', 'Thuộc về', 'Dư nợ', 'Lãi %/năm', 'Tối thiểu', 'Hình thức', 'Hạn', ...(main ? [] : ['Ngày ghi nhận']), 'Trạng thái', ''].map((h) => <th key={h} className={`px-3 py-2 ${h === RATE_COL ? 'bg-amber-100 text-amber-800' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {debts.map((d) => (
              <tr key={d.id} className={`border-t border-slate-100 ${d.status === 'Paid' ? 'opacity-50' : !sel.isSelected(d.id) ? 'text-slate-400' : ''}`}>
                <td className="pl-3 py-1.5"><input type="checkbox" aria-label={`Chọn ${d.name}`} checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} /></td>
                <td className="px-3 py-1.5 font-medium">{d.name}</td>
                <td className="px-3 py-1.5">{d.lender}</td>
                <td className="px-3 py-1.5">{d.owner}</td>
                <td className="px-3 py-1.5 text-right">{money(d.balance)}</td>
                <td className="px-3 py-1.5 text-right font-semibold bg-amber-50 text-amber-900">{d.apr}</td>
                <td className="px-3 py-1.5 text-right">{money(d.min_payment)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-xs">{isInterestOnly(d) ? 'Chỉ trả lãi' : `Gốc + lãi${d.term_months ? ` · còn ${d.term_months} th` : ''}`}</td>
                <td className="px-3 py-1.5">ngày {d.due_day}</td>
                {!main && <td className="px-3 py-1.5 whitespace-nowrap">{d.record_date || '—'}</td>}
                <td className="px-3 py-1.5">{d.status}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button className="text-blue-600 mr-2" onClick={() => setEditing(d)}>Sửa</button>
                  <button className="text-red-600" onClick={() => confirm('Xoá khoản nợ này?') && remove(kind, d)}>Xoá</button>
                </td>
              </tr>
            ))}
            {!debts.length && <tr><td colSpan={main ? 11 : 12} className="px-3 py-6 text-center text-slate-400">Chưa có khoản nợ</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
