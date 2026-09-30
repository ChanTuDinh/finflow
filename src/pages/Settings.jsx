import { useStore } from '../lib/store.jsx'
import { Field } from '../components/ui.jsx'
import { TABS } from '../lib/schema.js'

export default function Settings() {
  const { settings, setSettings, mode, connect, disconnect, resetDemo, status } = useStore()
  const set = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value.trim() }))
  return (
    <div className="space-y-4 max-w-xl">
      <section className="card space-y-3">
        <h2 className="font-semibold">Kết nối Google Sheets</h2>
        <Field label="Google OAuth Client ID"><input className="input" value={settings.clientId} onChange={set('clientId')} placeholder="xxxx.apps.googleusercontent.com" /></Field>
        <Field label="Spreadsheet ID (đoạn giữa /d/ và /edit trong URL)"><input className="input" value={settings.sheetId} onChange={set('sheetId')} /></Field>
        <Field label="Tên hiển thị của bạn (ghi vào cột created_by)"><input className="input" value={settings.user} onChange={set('user')} /></Field>
        <Field label="Tiền tệ"><select className="input" value={settings.currency} onChange={set('currency')}>{['VND', 'USD', 'EUR', 'SGD'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <div className="flex gap-2">
          {mode === 'demo'
            ? <button className="btn" onClick={connect} disabled={status.loading || !settings.clientId || !settings.sheetId}>Kết nối Google Sheets</button>
            : <button className="btn-ghost" onClick={disconnect}>Ngắt kết nối (về demo)</button>}
          {mode === 'demo' && <button className="btn-ghost" onClick={() => confirm('Đặt lại dữ liệu demo?') && resetDemo()}>Đặt lại dữ liệu demo</button>}
        </div>
      </section>
      <section className="card text-sm space-y-1">
        <h2 className="font-semibold">Cấu trúc Sheet (hàng 1 = header)</h2>
        {Object.values(TABS).map((t) => <p key={t.tab}><b>{t.tab}</b>: <code className="text-xs">{t.columns.join(' | ')}</code></p>)}
        <p className="text-slate-500">Xem thư mục <code>sheet-template/</code> để tạo sheet mẫu.</p>
      </section>
    </div>
  )
}
