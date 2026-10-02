import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Stat, SelectField } from '../components/ui.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod, monthsIn, labelOf, levelName } from '../lib/period.js'
import { TABS, isInterestOnly, SCOPE_OWNER, debtScopeOptions, cashRowsForScope } from '../lib/schema.js'
import EntryForm from '../components/EntryForm.jsx'
import PaymentForm from '../components/PaymentForm.jsx'
import { reversePayment } from '../lib/payments.js'
import { useDebtSelection } from '../lib/selection.jsx'

// kind: 'debts' (nguồn nợ chính) | 'debts_bm' (nguồn nợ BM) — cùng giao diện, dữ liệu riêng.
const OWNER_LABEL = { Personal: 'Cá nhân', Business: 'Doanh nghiệp', BM: 'BM' }
const kindLabel = (d) => (isInterestOnly(d) ? 'Chỉ trả lãi' : `Gốc + lãi${d.term_months ? ` · còn ${d.term_months} th` : ''}`)

export default function Debts({ kind = 'debts' }) {
  const { data, money, remove, deletePayment } = useStore()
  const [editing, setEditing] = useState(null)
  const [paying, setPaying] = useState(null) // khoản nợ đang ghi khoản trả
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
  const tickAllRef = (el) => { if (el) el.indeterminate = someTicked } // dấu gạch ngang khi chỉ chọn một phần
  const total = active.reduce((s, d) => s + d.balance, 0)
  const min = active.reduce((s, d) => s + d.min_payment, 0)
  const interest = active.reduce((s, d) => s + (d.balance * d.apr) / 1200, 0)
  const cash = cashRowsForScope(data, scope)
  // Lịch sử trả nợ của nguồn này, chỉ các khoản đã tick, trong kỳ đang chọn
  const chosenIds = new Set(chosen.map((d) => d.id))
  const history = data.payments.filter((x) => x.source === kind && chosenIds.has(x.debt_id) && inPeriod(period, x.date)).sort((a, b) => b.date.localeCompare(a.date))
  const paid = history.reduce((t, x) => ({ amount: t.amount + x.amount, principal: t.principal + x.principal, interest: t.interest + x.interest }), { amount: 0, principal: 0, interest: 0 })
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
      {data._missing?.includes('payments') && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab Debt_Payments nên chưa lưu được lịch sử trả nợ. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên.</div>}
      {data._missing?.includes(kind) && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {TABS[kind].tab}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu.</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Stat label={`Đã trả — ${periodTitle}`} value={money(paid.amount)} sub={`Gốc ${money(paid.principal)} · Lãi ${money(paid.interest)} (từ lịch sử trả nợ bên dưới)`} />
        <Stat label={`Lãi ước tính — ${periodTitle}`} value={money(interestInPeriod)} tone="neg" sub="Ước tính theo dư nợ hiện tại × số tháng" />
      </div>
      {/* Gộp thông tin vào ít cột để cả bảng vừa một màn hình, không phải cuộn ngang. Điện thoại: dạng thẻ. */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup><col style={{ width: 40 }} /><col style={{ width: '25%' }} /><col style={{ width: '15%' }} /><col style={{ width: 78 }} /><col style={{ width: '14%' }} /><col /><col style={{ width: 128 }} /></colgroup>
          <thead className="text-xs text-slate-500 text-left">
            <tr>
              <th className="pl-3 py-2"><input ref={tickAllRef} type="checkbox" aria-label="Chọn tất cả" checked={allTicked} onChange={(e) => sel.setMany(debts.map((d) => d.id), e.target.checked)} /></th>
              <th className="px-3 py-2">Khoản nợ</th><th className="px-3 py-2 text-right">Dư nợ</th>
              <th className="px-2 py-2 text-center bg-amber-100 text-amber-800">Lãi %/năm</th>
              <th className="px-3 py-2 text-right">Trả / tháng</th><th className="px-3 py-2">Ghi chú</th><th />
            </tr>
          </thead>
          <tbody>
            {debts.map((d) => (
              <tr key={d.id} className={`border-t border-slate-100 align-top ${d.status === 'Paid' ? 'opacity-50' : !sel.isSelected(d.id) ? 'text-slate-400' : ''}`}>
                <td className="pl-3 py-2"><input type="checkbox" aria-label={`Chọn ${d.name}`} checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} /></td>
                <td className="px-3 py-2">
                  <div className="font-medium break-words">{d.name}{d.status === 'Paid' && <span className="ml-1 text-xs font-normal rounded bg-slate-200 px-1.5">Đã trả hết</span>}</div>
                  <div className="text-xs text-slate-500 break-words">{[d.lender, OWNER_LABEL[d.owner] || d.owner].filter(Boolean).join(' · ')}</div>
                  <div className="text-xs text-slate-500">{kindLabel(d)}</div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="whitespace-nowrap">{money(d.balance)}</div>
                  {!main && d.record_date && <div className="text-xs text-slate-400">ghi nhận {d.record_date}</div>}
                </td>
                <td className="px-2 py-2 text-center font-semibold bg-amber-50 text-amber-900">{d.apr}</td>
                <td className="px-3 py-2 text-right">
                  <div className="whitespace-nowrap">{money(d.min_payment)}</div>
                  <div className="text-xs text-slate-400">hạn ngày {d.due_day}</div>
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-pre-line break-words">{d.note}</td>
                <td className="px-3 py-2 text-right text-xs leading-6">
                  {d.status !== 'Paid' && <div><button className="text-emerald-700 font-medium text-sm" onClick={() => setPaying(d)}>Ghi khoản trả</button></div>}
                  <div><button className="text-blue-600" onClick={() => setEditing(d)}>Sửa</button> · <button className="text-red-600" onClick={() => confirm('Xoá khoản nợ này?') && remove(kind, d)}>Xoá</button></div>
                </td>
              </tr>
            ))}
            {!debts.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Chưa có khoản nợ</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {debts.length > 0 && <label className="flex items-center gap-2 text-sm text-slate-500"><input ref={tickAllRef} type="checkbox" checked={allTicked} onChange={(e) => sel.setMany(debts.map((d) => d.id), e.target.checked)} /> Chọn tất cả</label>}
        {debts.map((d) => (
          <div key={d.id} className={`card space-y-2 ${d.status === 'Paid' ? 'opacity-50' : !sel.isSelected(d.id) ? 'text-slate-400' : ''}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" aria-label={`Chọn ${d.name}`} checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} />
              <div className="min-w-0">
                <div className="font-medium break-words">{d.name}{d.status === 'Paid' && <span className="ml-1 text-xs font-normal rounded bg-slate-200 px-1.5">Đã trả hết</span>}</div>
                <div className="text-xs text-slate-500 break-words">{[d.lender, OWNER_LABEL[d.owner] || d.owner, kindLabel(d), `hạn ngày ${d.due_day}`].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><div className="text-xs text-slate-500">Dư nợ</div><div className="font-medium break-words">{money(d.balance)}</div></div>
              <div className="rounded bg-amber-50 px-2 py-1 text-center"><div className="text-xs text-amber-800">Lãi %/năm</div><div className="font-semibold text-amber-900">{d.apr}</div></div>
              <div><div className="text-xs text-slate-500">Trả / tháng</div><div className="font-medium break-words">{money(d.min_payment)}</div></div>
            </div>
            {!main && d.record_date && <div className="text-xs text-slate-400">Ghi nhận {d.record_date}</div>}
            {d.note && <div className="text-sm text-slate-600 whitespace-pre-line break-words">{d.note}</div>}
            <div className="flex items-center gap-3 text-sm">
              {d.status !== 'Paid' && <button className="text-emerald-700 font-medium" onClick={() => setPaying(d)}>Ghi khoản trả</button>}
              <button className="text-blue-600" onClick={() => setEditing(d)}>Sửa</button>
              <button className="text-red-600" onClick={() => confirm('Xoá khoản nợ này?') && remove(kind, d)}>Xoá</button>
            </div>
          </div>
        ))}
        {!debts.length && <div className="card text-center text-slate-400 text-sm">Chưa có khoản nợ</div>}
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">Lịch sử trả nợ <span className="text-xs font-normal text-slate-400">— {periodTitle}, các khoản đã tick</span></h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup><col style={{ width: 92 }} /><col /><col style={{ width: 150 }} /><col className="hidden sm:table-column" style={{ width: 130 }} /><col style={{ width: 44 }} /></colgroup>
            <thead className="text-xs text-slate-500 text-left"><tr><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Khoản nợ</th><th className="px-3 py-2 text-right">Số tiền</th><th className="px-3 py-2 text-right hidden sm:table-cell">Dư nợ sau</th><th /></tr></thead>
            <tbody>
              {history.map((x) => (
                <tr key={x.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs sm:text-sm">{x.date}</td>
                  <td className="px-3 py-2"><div className="break-words">{x.debt_name} <span className="text-xs text-slate-500">· {x.type}</span></div>{x.note && <div className="text-xs text-slate-500 whitespace-pre-line break-words">{x.note}</div>}</td>
                  <td className="px-3 py-2 text-right"><div className="font-medium whitespace-nowrap">{money(x.amount)}</div><div className="text-xs text-slate-500">gốc {money(x.principal)} · lãi {money(x.interest)}</div><div className="text-xs text-slate-400 sm:hidden">dư nợ sau {money(x.balance_after)}</div></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap hidden sm:table-cell">{money(x.balance_after)}</td>
                  <td className="px-2 py-2 text-right">
                    <button className="text-red-600 text-xs" onClick={() => {
                      const debt = data[kind].find((d) => d.id === x.debt_id)
                      if (confirm(`Xoá lần trả ${money(x.amount)} ngày ${x.date}?${x.principal > 0 && debt ? ` Phần gốc ${money(x.principal)} sẽ được cộng lại vào dư nợ.` : ''}`)) deletePayment({ kind, debt: debt ? reversePayment(debt, x) : null, payment: x })
                    }}>Xoá</button>
                  </td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có lần trả nào trong kỳ này — bấm “Ghi khoản trả” ở khoản nợ</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {paying && <PaymentForm kind={kind} debt={paying} onClose={() => setPaying(null)} />}
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
