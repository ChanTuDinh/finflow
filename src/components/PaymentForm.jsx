import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Field, Modal, Segmented, focusNextOnEnter } from './ui.jsx'
import { PAY_TYPES, ADJUST, buildPayment, cashRowFor, needsAdjust } from '../lib/payments.js'
import { isInterestOnly } from '../lib/schema.js'
import { todayIso } from '../lib/format.js'

const HINT = {
  [PAY_TYPES.principal]: 'Toàn bộ số tiền trừ vào dư nợ gốc.',
  [PAY_TYPES.interest]: 'Chỉ trả tiền lãi — dư nợ không đổi.',
  [PAY_TYPES.both]: 'Tool tự tách: trả lãi một tháng trước, phần còn lại trừ vào gốc.',
}

// Ghi một lần trả cho một khoản nợ (kind: 'debts' | 'debts_bm').
export default function PaymentForm({ kind, debt, onClose }) {
  const { recordPayment, settings, money, status } = useStore()
  const [f, setF] = useState({ date: todayIso(), amount: '', type: PAY_TYPES.principal, note: '', cash: false, adjust: ADJUST.shorten })
  const [err, setErr] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const built = useMemo(() => (Number(f.amount) > 0 ? buildPayment({ debt, kind, type: f.type, amount: f.amount, date: f.date, note: f.note, createdBy: settings.user || 'me', adjust: f.adjust }) : null), [debt, kind, f, settings.user])

  const submit = async (e) => {
    e.preventDefault()
    const r = buildPayment({ debt, kind, type: f.type, amount: f.amount, date: f.date, note: f.note, createdBy: settings.user || 'me', adjust: f.adjust })
    if (r.error) return setErr(r.error)
    if (await recordPayment({ kind, debt: r.debt, payment: r.payment, cash: f.cash ? cashRowFor(debt, r.payment) : null })) onClose()
  }

  return (
    <Modal title={`Ghi khoản trả — ${debt.name}`} onClose={onClose}>
      <form onSubmit={submit} onKeyDown={focusNextOnEnter} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm text-slate-500">Dư nợ hiện tại: <b className="text-slate-800">{money(debt.balance)}</b>{debt.apr ? ` · lãi ${debt.apr}%/năm` : ''}</div>
        <Field label="Ngày trả"><input type="date" required className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Tổng số tiền đã trả"><input type="number" min="0" required className="input" value={f.amount} onChange={(e) => { set('amount', e.target.value); setErr('') }} /></Field>
        <div className="col-span-2 space-y-1">
          <Segmented label="Khoản trả này là" value={f.type} onChange={(v) => { set('type', v); setErr('') }} options={Object.values(PAY_TYPES).map((v) => ({ value: v, label: v }))} />
          <p className="text-xs text-slate-500">{HINT[f.type]}</p>
        </div>
        {built && (
          <div className={`col-span-2 rounded-lg px-3 py-2 text-sm ${built.error ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-900'}`}>
            {built.error ? built.error : (<>
              Gốc <b>{money(built.payment.principal)}</b> · Lãi <b>{money(built.payment.interest)}</b><br />
              Dư nợ: {money(debt.balance)} → <b>{money(built.debt.balance)}</b>{built.debt.status === 'Paid' && ' (đã trả hết)'}
              {built.debt.balance > 0 && built.debt.min_payment !== debt.min_payment && <><br />{isInterestOnly(debt) ? 'Tiền lãi hàng tháng mới' : 'Tiền trả mỗi tháng'}: {money(debt.min_payment)} → <b>{money(built.debt.min_payment)}</b></>}
              {built.debt.term_months !== debt.term_months && built.debt.balance > 0 && <><br />Thời hạn còn lại: {debt.term_months || '?'} → <b>{built.debt.term_months} tháng</b></>}
            </>)}
          </div>
        )}
        {built && !built.error && needsAdjust(debt, built.payment.principal) && (
          <div className="col-span-2 space-y-1">
            <Field label="Sau khi trả bớt gốc, ngân hàng điều chỉnh thế nào?">
              <select className="input" value={f.adjust} onChange={(e) => set('adjust', e.target.value)}>
                {Object.values(ADJUST).map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <p className="text-xs text-slate-500">Xem hợp đồng hoặc hỏi ngân hàng. Chọn “Không đổi” nếu chưa rõ — bạn vẫn sửa được ở nút Sửa.</p>
          </div>
        )}
        <div className="col-span-2"><Field label="Ghi chú"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field></div>
        <label className="col-span-2 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.cash} onChange={(e) => set('cash', e.target.checked)} />
          <span>Ghi thêm một khoản chi “Trả nợ” vào {debt.owner === 'Business' ? 'sổ Doanh nghiệp' : 'sổ Cá nhân'}
            <span className="block text-xs text-slate-500">Để tắt nếu bạn nhập sao kê ngân hàng — khoản chi đã có sẵn trong sao kê, bật sẽ bị tính trùng.</span></span>
        </label>
        {err && <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-2">{err}</div>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={status.loading}>Lưu</button>
        </div>
      </form>
    </Modal>
  )
}
