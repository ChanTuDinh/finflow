import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Field, Modal, Segmented, focusNextOnEnter } from './ui.jsx'
import { PAY_TYPES, ADJUST, buildPayment, cashRowFor, needsAdjust, canAdjustRate, adjustChoices, impliedApr, monthlyInterest, reversePayment, adjustSummary, adjustFormValues } from '../lib/payments.js'
import { isInterestOnly } from '../lib/schema.js'
import { todayIso } from '../lib/format.js'

const HINT = {
  [PAY_TYPES.principal]: 'Toàn bộ số tiền trừ vào dư nợ gốc.',
  [PAY_TYPES.interest]: 'Chỉ trả tiền lãi — dư nợ không đổi.',
  [PAY_TYPES.both]: 'Tool tự tách: trả lãi một tháng trước, phần còn lại trừ vào gốc.',
}

// Ghi (hoặc sửa) một lần trả cho một khoản nợ (kind: 'debts' | 'debts_bm').
// Sửa: payment = lần trả cần sửa; limited = chỉ sửa được ngày và ghi chú (vì sau lần này đã có lần trả khác).
export default function PaymentForm({ kind, debt, payment, limited = false, onClose }) {
  const { recordPayment, updatePayment, settings, money, status } = useStore()
  const editing = !!payment
  const full = editing && !limited
  // Khi sửa đầy đủ: quay về khoản nợ như trước lần trả này rồi áp lại số mới
  const base = useMemo(() => (full ? reversePayment(debt, payment) : debt), [full, debt, payment])
  const [f, setF] = useState(() => (editing
    ? { date: payment.date, amount: String(payment.amount), type: payment.type, note: payment.note || '', cash: false, interest: '', rateMode: 'keep', apr: '', ...adjustFormValues(payment) }
    : { date: todayIso(), amount: '', type: PAY_TYPES.principal, note: '', cash: false, adjust: isInterestOnly(debt) ? ADJUST.none : ADJUST.shorten, interest: '', rateMode: 'keep', apr: '' }))
  const [err, setErr] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const build = () => buildPayment({ debt: base, kind, type: f.type, amount: f.amount, date: f.date, note: f.note, createdBy: editing ? payment.created_by : settings.user || 'me', adjust: f.adjust, adjustOpts: { interest: Number(f.interest), rateMode: f.rateMode, apr: Number(f.apr) }, id: editing ? payment.id : undefined })
  const built = useMemo(() => (!limited && Number(f.amount) > 0 ? build() : null), [base, kind, f, settings.user, limited]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    if (limited) { // chỉ ngày + ghi chú
      if (await updatePayment({ kind, payment: { ...payment, date: f.date, note: f.note }, debt: null })) onClose()
      return
    }
    const r = build()
    if (r.error) return setErr(r.error)
    if (editing) {
      if (await updatePayment({ kind, payment: { ...r.payment, _row: payment._row }, debt: r.debt })) onClose()
    } else if (await recordPayment({ kind, debt: r.debt, payment: r.payment, cash: f.cash ? cashRowFor(debt, r.payment) : null })) onClose()
  }

  return (
    <Modal title={`${editing ? 'Sửa khoản trả' : 'Ghi khoản trả'} — ${debt.name}`} onClose={onClose}>
      <form onSubmit={submit} onKeyDown={focusNextOnEnter} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm text-slate-500">{full ? 'Dư nợ trước lần trả này' : 'Dư nợ hiện tại'}: <b className="text-slate-800">{money(base.balance)}</b>{base.apr ? ` · lãi ${base.apr}%/năm` : ''}</div>
        {limited && <div className="col-span-2 rounded-lg bg-slate-100 text-slate-700 text-sm px-3 py-2">Chỉ sửa được <b>ngày</b> và <b>ghi chú</b>, vì sau lần trả này khoản nợ đã có lần trả khác (đổi số tiền sẽ làm lệch dư nợ các lần sau). Muốn đổi số tiền: xoá các lần trả sau rồi sửa lại.<div className="mt-1">{f.type}: <b>{money(payment.amount)}</b> (gốc {money(payment.principal)} · lãi {money(payment.interest)}) → dư nợ sau {money(payment.balance_after)}{adjustSummary(payment, money) ? ` · ${adjustSummary(payment, money)}` : ''}</div></div>}
        <Field label="Ngày trả"><input type="date" required className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        {!limited && <Field label="Tổng số tiền đã trả"><input type="number" min="0" required className="input" value={f.amount} onChange={(e) => { set('amount', e.target.value); setErr('') }} /></Field>}
        {!limited && <div className="col-span-2 space-y-1">
          <Segmented label="Khoản trả này là" value={f.type} onChange={(v) => { set('type', v); setErr('') }} options={Object.values(PAY_TYPES).map((v) => ({ value: v, label: v }))} />
          <p className="text-xs text-slate-500">{HINT[f.type]}</p>
        </div>}
        {built && (
          <div className={`col-span-2 rounded-lg px-3 py-2 text-sm ${built.error ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-900'}`}>
            {built.error ? built.error : (<>
              Gốc <b>{money(built.payment.principal)}</b> · Lãi <b>{money(built.payment.interest)}</b><br />
              Dư nợ: {money(base.balance)} → <b>{money(built.debt.balance)}</b>{built.debt.status === 'Paid' && ' (đã trả hết)'}
              {built.debt.balance > 0 && built.debt.min_payment !== base.min_payment && <><br />{isInterestOnly(base) ? 'Tiền lãi hàng tháng mới' : 'Tiền trả mỗi tháng'}: {money(base.min_payment)} → <b>{money(built.debt.min_payment)}</b></>}
              {built.debt.repay_type !== base.repay_type && built.debt.balance > 0 && <><br />Hình thức: <b>Chỉ trả lãi</b> — gốc {money(built.debt.balance)} giữ nguyên đến khi tất toán</>}
              {built.debt.apr !== base.apr && <><br />Lãi suất: {base.apr}% → <b>{built.debt.apr}%</b></>}
              {built.debt.term_months !== base.term_months && built.debt.balance > 0 && <><br />Thời hạn còn lại: {base.term_months || '?'} → <b>{built.debt.term_months} tháng</b></>}
            </>)}
          </div>
        )}
        {built && !built.error && (needsAdjust(base, built.payment.principal) || canAdjustRate(base, built.payment.principal)) && (
          <div className="col-span-2 space-y-1">
            <Field label={isInterestOnly(base) ? 'Sau khi trả bớt gốc, lãi suất / tiền lãi có đổi không?' : 'Sau khi trả bớt gốc, ngân hàng điều chỉnh thế nào?'}>
              <select className="input" value={f.adjust} onChange={(e) => set('adjust', e.target.value)}>
                {adjustChoices(base).map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <p className="text-xs text-slate-500">Xem hợp đồng hoặc hỏi ngân hàng. Chọn “Không đổi” nếu chưa rõ — bạn vẫn sửa được ở nút Sửa.</p>
            {(f.adjust === ADJUST.interestOnly || f.adjust === ADJUST.rate) && <InterestOnlyBox f={f} set={set} debt={base} newBalance={built.debt.balance} money={money} />}
          </div>
        )}
        <div className="col-span-2"><Field label="Ghi chú"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field></div>
        {!editing && <label className="col-span-2 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.cash} onChange={(e) => set('cash', e.target.checked)} />
          <span>Ghi thêm một khoản chi “Trả nợ” vào {debt.owner === 'Business' ? 'sổ Doanh nghiệp' : 'sổ Cá nhân'}
            <span className="block text-xs text-slate-500">Để tắt nếu bạn nhập sao kê ngân hàng — khoản chi đã có sẵn trong sao kê, bật sẽ bị tính trùng.</span></span>
        </label>}
        {err && <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-2">{err}</div>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" disabled={status.loading}>Lưu</button>
        </div>
      </form>
    </Modal>
  )
}

// Sau khi trả bớt gốc, ngân hàng chỉ thu lãi hàng tháng (hoặc khoản chỉ trả lãi đổi lãi suất): suy ngược lãi suất từ tiền lãi thực tế, hoặc nhập lãi suất mới
function InterestOnlyBox({ f, set, debt, newBalance, money }) {
  const custom = f.rateMode === 'custom' && Number(f.apr) > 0
  const rateForGuess = custom ? Number(f.apr) : debt.apr
  const monthly = Number(f.interest) > 0 ? Number(f.interest) : monthlyInterest(newBalance, rateForGuess)
  const implied = impliedApr(newBalance, monthly)
  const differs = !custom && implied != null && Math.abs(implied - debt.apr) > 0.1
  const balanceIfRateRight = debt.apr > 0 ? Math.round((monthly * 1200) / debt.apr) : 0
  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
      <Segmented label="Lãi suất lưu cho khoản này (từ lần trả này)" value={f.rateMode} onChange={(v) => set('rateMode', v)}
        options={[{ value: 'keep', label: `Giữ ${debt.apr}%` }, { value: 'implied', label: `Suy ra ${implied ?? '?'}% từ tiền lãi` }, { value: 'custom', label: 'Nhập lãi suất mới' }]} />
      {f.rateMode === 'custom' && (
        <Field label="Lãi suất mới (%/năm)"><input type="number" min="0" step="0.01" className="input" value={f.apr} onChange={(e) => set('apr', e.target.value)} /></Field>
      )}
      <Field label="Tiền lãi phải trả mỗi tháng sau đó">
        <input type="number" min="0" className="input" value={f.interest} placeholder={`Tự tính theo lãi ${rateForGuess}%: ${Math.round(monthlyInterest(newBalance, rateForGuess))}`} onChange={(e) => set('interest', e.target.value)} />
      </Field>
      {differs && f.interest !== '' && (
        <div className="rounded-lg bg-amber-50 text-amber-900 text-sm px-3 py-2 space-y-1">
          <div>Lãi {money(monthly)}/tháng trên dư nợ {money(newBalance)} tương ứng <b>{implied}%/năm</b>, khác lãi suất đang lưu ({debt.apr}%).</div>
          <div className="text-xs">Hãy đối chiếu sao kê: nếu lãi suất đúng là {debt.apr}% thì dư nợ gốc còn lại phải khoảng <b>{money(balanceIfRateRight)}</b>; còn nếu dư nợ đúng thì lãi suất sau khi trả bớt là {implied}%.</div>
        </div>
      )}
      <p className="text-xs text-slate-500">Forecast tính lãi theo lãi suất được lưu{differs && f.rateMode === 'keep' ? `: giữ ${debt.apr}% thì Forecast sẽ tính ≈ ${money(monthlyInterest(newBalance, debt.apr))}/tháng, không phải ${money(monthly)}` : ''}. Chưa tính khoản tất toán gốc khi đáo hạn.</p>
    </div>
  )
}
