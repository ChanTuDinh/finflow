import { useState } from 'react'
import { TABS } from '../lib/schema.js'
import { todayIso } from '../lib/format.js'
import { Field, Modal } from './ui.jsx'
import { useStore } from '../lib/store.jsx'

const TITLES = { personal: 'giao dịch cá nhân', business: 'giao dịch doanh nghiệp', debts: 'khoản nợ', debts_bm: 'khoản nợ BM', savings: 'khoản tích lũy', goals: 'mục tiêu', accounts: 'tài khoản ngân hàng', rules: 'quy tắc phân loại' }
const DEBT_BLANK = { name: '', lender: '', owner: 'Personal', balance: 0, apr: 0, min_payment: 0, due_day: 1, status: 'Active', note: '' }
const EMPTY = {
  debts: DEBT_BLANK,
  debts_bm: DEBT_BLANK,
  savings: { name: '', type: 'Tiết kiệm', owner: 'Personal', balance: 0, monthly_contribution: 0, annual_return: 0, goal_id: '', status: 'Active', note: '' },
  goals: { name: '', owner: 'Personal', target_amount: 0, target_date: '', status: 'Active', note: '' },
  accounts: { name: '', bank: '', owner: 'Personal', preset: '', status: 'Active', note: '' },
  rules: { keyword: '', category: 'Khác', direction: 'out', owner: '' },
}
const ALL_CATEGORIES = [...new Set([...Object.values(TABS.personal.categories), ...Object.values(TABS.business.categories)].flat())].filter((c) => c !== 'Chuyển nội bộ')

// Form thêm/sửa cho mọi tab dữ liệu: personal | business | debts | savings | goals.
export default function EntryForm({ kind, row, onClose }) {
  const { upsert, status, data } = useStore()
  const cfg = TABS[kind]
  const cash = kind === 'personal' || kind === 'business'
  const [f, setF] = useState(() => row || (kind === 'debts_bm' ? { ...DEBT_BLANK, record_date: todayIso() } : EMPTY[kind]) || {
    date: todayIso(), type: cfg.types[1], category: cfg.categories[cfg.types[1]][0], amount: 0,
    [kind === 'personal' ? 'account' : 'counterparty']: '', note: '',
  })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const num = (k) => (e) => set(k, e.target.value === '' ? '' : Number(e.target.value))
  const submit = async (e) => { e.preventDefault(); if (await upsert(kind, f)) onClose() }
  const who = kind === 'personal' ? ['account', 'Tài khoản / ví'] : ['counterparty', 'Đối tác / khách hàng']
  const select = (k, options) => <select className="input" value={f[k]} onChange={(e) => set(k, e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
  const text = (k, required) => <input required={required} className="input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
  const number = (k, extra = {}) => <input type="number" min="0" className="input" value={f[k]} onChange={num(k)} {...extra} />
  const goalOptions = data.goals.filter((g) => g.owner === f.owner)

  return (
    <Modal title={`${row ? 'Sửa' : 'Thêm'} — ${TITLES[kind]}`} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        {(kind === 'debts' || kind === 'debts_bm') && (<>
          <div className="col-span-2"><Field label="Tên khoản nợ">{text('name', true)}</Field></div>
          <Field label="Bên cho vay">{text('lender')}</Field>
          <Field label="Thuộc về">{select('owner', cfg.owners)}</Field>
          <Field label="Dư nợ hiện tại">{number('balance')}</Field>
          <Field label="Lãi suất (%/năm)">{number('apr', { step: '0.01' })}</Field>
          <Field label="Trả tối thiểu / tháng">{number('min_payment')}</Field>
          <Field label="Ngày đến hạn (1-31)">{number('due_day', { max: 31, min: 1 })}</Field>
          <Field label="Trạng thái">{select('status', cfg.statuses)}</Field>
          {kind === 'debts_bm' && <div className="col-span-2"><Field label="Ngày ghi nhận (số dư tính đến ngày)"><input type="date" className="input" value={f.record_date || ''} onChange={(e) => set('record_date', e.target.value)} /></Field></div>}
        </>)}
        {kind === 'savings' && (<>
          <div className="col-span-2"><Field label="Tên khoản tích lũy">{text('name', true)}</Field></div>
          <Field label="Loại">{select('type', cfg.types)}</Field>
          <Field label="Thuộc về">{select('owner', cfg.owners)}</Field>
          <Field label="Số dư hiện tại">{number('balance')}</Field>
          <Field label="Góp mỗi tháng">{number('monthly_contribution')}</Field>
          <Field label="Lãi/lợi nhuận kỳ vọng (%/năm)">{number('annual_return', { step: '0.01' })}</Field>
          <Field label="Trạng thái">{select('status', cfg.statuses)}</Field>
          <div className="col-span-2"><Field label="Gắn với mục tiêu">
            <select className="input" value={f.goal_id} onChange={(e) => set('goal_id', e.target.value)}>
              <option value="">— Không gắn —</option>
              {goalOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field></div>
        </>)}
        {kind === 'goals' && (<>
          <div className="col-span-2"><Field label="Tên mục tiêu">{text('name', true)}</Field></div>
          <Field label="Thuộc về">{select('owner', cfg.owners)}</Field>
          <Field label="Trạng thái">{select('status', cfg.statuses)}</Field>
          <Field label="Số tiền đích">{number('target_amount')}</Field>
          <Field label="Hạn đạt (tuỳ chọn)"><input type="date" className="input" value={f.target_date} onChange={(e) => set('target_date', e.target.value)} /></Field>
        </>)}
        {kind === 'accounts' && (<>
          <div className="col-span-2"><Field label="Tên tài khoản (hiển thị, vd. Vietcombank chính)">{text('name', true)}</Field></div>
          <Field label="Ngân hàng">{text('bank')}</Field>
          <Field label="Thuộc về">{select('owner', cfg.owners)}</Field>
          <Field label="Trạng thái">{select('status', cfg.statuses)}</Field>
        </>)}
        {kind === 'rules' && (<>
          <div className="col-span-2"><Field label="Từ khóa trong nội dung giao dịch (không cần dấu)">{text('keyword', true)}</Field></div>
          <Field label="Danh mục"><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Áp dụng cho"><select className="input" value={f.direction} onChange={(e) => set('direction', e.target.value)}><option value="out">Khoản chi</option><option value="in">Khoản thu</option><option value="any">Cả hai</option></select></Field>
          <Field label="Phạm vi"><select className="input" value={f.owner} onChange={(e) => set('owner', e.target.value)}><option value="">Cả cá nhân và DN</option><option value="Personal">Chỉ cá nhân</option><option value="Business">Chỉ doanh nghiệp</option></select></Field>
        </>)}
        {cash && (<>
          <Field label="Ngày"><input type="date" required className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Loại"><select className="input" value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value, category: cfg.categories[e.target.value][0] }))}>{cfg.types.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Danh mục">{select('category', cfg.categories[f.type])}</Field>
          <Field label="Số tiền">{number('amount', { required: true })}</Field>
          <div className="col-span-2"><Field label={who[1]}>{text(who[0])}</Field></div>
        </>)}
        {kind !== 'rules' && <div className="col-span-2"><Field label="Ghi chú">{text('note')}</Field></div>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={status.loading}>Lưu</button>
        </div>
      </form>
    </Modal>
  )
}
