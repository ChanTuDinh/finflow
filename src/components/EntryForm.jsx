import { useMemo, useState } from 'react'
import { TABS, REPAY } from '../lib/schema.js'
import { computeApr } from '../lib/rate.js'
import { todayIso } from '../lib/format.js'
import { Field, Modal, Segmented, focusNextOnEnter } from './ui.jsx'
import { useStore } from '../lib/store.jsx'

const TITLES = { personal: 'giao dịch cá nhân', business: 'giao dịch doanh nghiệp', debts: 'khoản nợ', debts_bm: 'khoản nợ BM', savings: 'khoản tích lũy', goals: 'mục tiêu', accounts: 'tài khoản ngân hàng', rules: 'quy tắc phân loại' }
const DEBT_BLANK = { name: '', lender: '', owner: 'Personal', balance: 0, apr: 0, min_payment: 0, due_day: 1, status: 'Active', note: '', repay_type: REPAY.both, term_months: 0 }
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
  const isDebt = kind === 'debts' || kind === 'debts_bm'
  const [f, setF] = useState(() => {
    const init = row || (kind === 'debts_bm' ? { ...DEBT_BLANK, record_date: todayIso() } : EMPTY[kind]) || {
      date: todayIso(), type: cfg.types[1], category: cfg.categories[cfg.types[1]][0], amount: 0,
      [kind === 'personal' ? 'account' : 'counterparty']: '', note: '',
    }
    return isDebt ? { ...init, repay_type: init.repay_type || REPAY.both } : init // dòng cũ chưa có hình thức = trả gốc và lãi
  })
  // Khoản nợ mới: để tool tự suy ra lãi suất từ dư nợ + số tiền trả mỗi tháng; sửa khoản cũ: giữ lãi suất đã nhập
  const [autoRate, setAutoRate] = useState(!row)
  const [formErr, setFormErr] = useState('')
  const rate = useMemo(() => (isDebt ? computeApr({ type: f.repay_type, balance: f.balance, payment: f.min_payment, term: f.term_months }) : null), [isDebt, f.repay_type, f.balance, f.min_payment, f.term_months])
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const num = (k) => (e) => set(k, e.target.value === '' ? '' : Number(e.target.value))
  const submit = async (e) => {
    e.preventDefault()
    if (isDebt && autoRate) {
      if (rate.error) return setFormErr(`Chưa tính được lãi suất: ${rate.error}. Hoặc chuyển sang “Tôi tự nhập”.`)
      if (await upsert(kind, { ...f, apr: rate.apr })) onClose()
      return
    }
    if (await upsert(kind, f)) onClose()
  }
  const who = kind === 'personal' ? ['account', 'Tài khoản / ví'] : ['counterparty', 'Đối tác / khách hàng']
  const select = (k, options) => <select className="input" value={f[k]} onChange={(e) => set(k, e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
  const text = (k, required) => <input required={required} className="input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
  const number = (k, extra = {}) => <input type="number" min="0" className="input" value={f[k]} onChange={num(k)} {...extra} />
  const goalOptions = data.goals.filter((g) => g.owner === f.owner)

  return (
    <Modal title={`${row ? 'Sửa' : 'Thêm'} — ${TITLES[kind]}`} onClose={onClose}>
      <form onSubmit={submit} onKeyDown={focusNextOnEnter} className="grid grid-cols-2 gap-3">
        {isDebt && (<>
          <div className="col-span-2"><Field label="Tên khoản nợ">{text('name', true)}</Field></div>
          <Field label="Bên cho vay">{text('lender')}</Field>
          <Field label="Thuộc về">{select('owner', cfg.owners)}</Field>
          <Field label="Hình thức trả">{select('repay_type', Object.values(REPAY))}</Field>
          <Field label="Dư nợ hiện tại">{number('balance')}</Field>
          <Field label={f.repay_type === REPAY.interestOnly ? 'Tiền lãi trả mỗi tháng' : 'Số tiền trả mỗi tháng'}>{number('min_payment')}</Field>
          {f.repay_type !== REPAY.interestOnly
            ? <Field label="Số tháng còn lại">{number('term_months', { step: '1' })}</Field>
            : <div className="text-xs text-slate-500 self-end pb-2">Chỉ trả lãi: dư nợ giữ nguyên cho đến khi bạn trả gốc.</div>}
          <div className="col-span-2 space-y-2">
            <Segmented label="Lãi suất (%/năm)" value={autoRate ? 'auto' : 'manual'} onChange={(v) => { setAutoRate(v === 'auto'); setFormErr('') }} options={[{ value: 'auto', label: 'Tool tự tính' }, { value: 'manual', label: 'Tôi tự nhập' }]} />
            {autoRate
              ? <div className={`rounded-lg px-3 py-2 text-sm ${rate.error ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-900'}`}>
                  {rate.error ? rate.error : <><b>≈ {rate.apr}%/năm</b> <span className="text-xs text-slate-500">{f.repay_type === REPAY.interestOnly ? '(= 12 × tiền lãi mỗi tháng ÷ dư nợ)' : `(suy ra từ trả đều ${Math.round(f.term_months)} tháng)`}</span></>}
                </div>
              : number('apr', { step: '0.01' })}
          </div>
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
        {formErr && <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-2">{formErr}</div>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={status.loading}>Lưu</button>
        </div>
      </form>
    </Modal>
  )
}
