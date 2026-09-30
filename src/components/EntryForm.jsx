import { useState } from 'react'
import { TABS } from '../lib/schema.js'
import { todayIso } from '../lib/format.js'
import { Field, Modal } from './ui.jsx'
import { useStore } from '../lib/store.jsx'

// Form thêm/sửa cho Personal_CashFlow, Business_CashFlow (kind = personal | business) và Debts.
export default function EntryForm({ kind, row, onClose }) {
  const { upsert, status } = useStore()
  const cfg = TABS[kind]
  const isDebt = kind === 'debts'
  const [f, setF] = useState(() => row || (isDebt
    ? { name: '', lender: '', owner: 'Personal', balance: 0, apr: 0, min_payment: 0, due_day: 1, status: 'Active', note: '' }
    : { date: todayIso(), type: cfg.types[1], category: cfg.categories[cfg.types[1]][0], amount: 0, [kind === 'personal' ? 'account' : 'counterparty']: '', note: '' }))
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const num = (k) => (e) => set(k, e.target.value === '' ? '' : Number(e.target.value))
  const submit = async (e) => { e.preventDefault(); if (await upsert(kind, f)) onClose() }
  const who = kind === 'personal' ? ['account', 'Tài khoản / ví'] : ['counterparty', 'Đối tác / khách hàng']

  return (
    <Modal title={`${row ? 'Sửa' : 'Thêm'} — ${isDebt ? 'khoản nợ' : kind === 'personal' ? 'cá nhân' : 'doanh nghiệp'}`} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        {isDebt ? (<>
          <div className="col-span-2"><Field label="Tên khoản nợ"><input required className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field></div>
          <Field label="Bên cho vay"><input className="input" value={f.lender} onChange={(e) => set('lender', e.target.value)} /></Field>
          <Field label="Thuộc về"><select className="input" value={f.owner} onChange={(e) => set('owner', e.target.value)}>{cfg.owners.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Dư nợ hiện tại"><input type="number" min="0" className="input" value={f.balance} onChange={num('balance')} /></Field>
          <Field label="Lãi suất (%/năm)"><input type="number" step="0.01" min="0" className="input" value={f.apr} onChange={num('apr')} /></Field>
          <Field label="Trả tối thiểu / tháng"><input type="number" min="0" className="input" value={f.min_payment} onChange={num('min_payment')} /></Field>
          <Field label="Ngày đến hạn (1-31)"><input type="number" min="1" max="31" className="input" value={f.due_day} onChange={num('due_day')} /></Field>
          <Field label="Trạng thái"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>{cfg.statuses.map((o) => <option key={o}>{o}</option>)}</select></Field>
        </>) : (<>
          <Field label="Ngày"><input type="date" required className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Loại"><select className="input" value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value, category: cfg.categories[e.target.value][0] }))}>{cfg.types.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Danh mục"><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{cfg.categories[f.type].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Số tiền"><input type="number" min="0" required className="input" value={f.amount} onChange={num('amount')} /></Field>
          <div className="col-span-2"><Field label={who[1]}><input className="input" value={f[who[0]] || ''} onChange={(e) => set(who[0], e.target.value)} /></Field></div>
        </>)}
        <div className="col-span-2"><Field label="Ghi chú"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field></div>
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={status.loading}>Lưu</button>
        </div>
      </form>
    </Modal>
  )
}
