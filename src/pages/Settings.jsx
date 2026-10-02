import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { makeBackup, parseBackup, downloadJson, backupFileName, countRows, BACKUP_KINDS } from '../lib/backup.js'
import { Field } from '../components/ui.jsx'
import { TABS } from '../lib/schema.js'

export default function Settings() {
  const { settings, setSettings, mode, connect, disconnect, resetDemo, status, data, localSnapshot, restoreLocal, migrateLocalToSheet } = useStore()
  const [msg, setMsg] = useState({ text: '', error: false })
  const local = localSnapshot()
  const localCounts = local ? BACKUP_KINDS.map((k) => [TABS[k].tab, local[k]?.length || 0]).filter(([, n]) => n > 0) : []
  const set = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value.trim() }))
  return (
    <div className="space-y-4 max-w-xl">
      <section className="card space-y-3">
        <h2 className="font-semibold">Sao lưu &amp; chuyển dữ liệu</h2>
        <p className="text-sm text-slate-600">
          {mode === 'demo'
            ? <>Dữ liệu bạn nhập hiện <b>chỉ lưu trong trình duyệt này</b> (máy này, trình duyệt này). Xoá dữ liệu trình duyệt, dùng cửa sổ ẩn danh hoặc đổi máy/trình duyệt là <b>mất</b>, và người khác không thấy. Hãy tải file sao lưu thường xuyên, và nên kết nối Google Sheets bên dưới để lưu bền và dùng chung.</>
            : <>Dữ liệu đang lưu trong <b>Google Sheet</b> của bạn — mở ở máy hoặc trình duyệt khác vẫn thấy. Bạn vẫn có thể tải thêm file sao lưu.</>}
        </p>
        {msg.text && <div className={`rounded-lg border text-sm p-2 ${msg.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{msg.text}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => { downloadJson(backupFileName(), makeBackup(data)); setMsg({ text: `Đã tải file sao lưu (${countRows(data)} dòng dữ liệu). Cất file ở nơi an toàn.`, error: false }) }}>⬇ Tải file sao lưu</button>
          {mode === 'demo' && (
            <label className="btn-ghost cursor-pointer">Khôi phục từ file sao lưu
              <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = ''
                if (!file) return
                try {
                  const restored = parseBackup(await file.text())
                  if (confirm(`Thay TOÀN BỘ dữ liệu hiện tại (${countRows(data)} dòng) bằng dữ liệu trong file (${countRows(restored)} dòng)?\n\nNên tải file sao lưu dữ liệu hiện tại trước.`)) { restoreLocal(restored); setMsg({ text: `Đã khôi phục ${countRows(restored)} dòng dữ liệu từ file.`, error: false }) }
                } catch (err) { setMsg({ text: err.message, error: true }) }
              }} />
            </label>
          )}
        </div>
        {mode === 'sheets' && localCounts.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 text-sm">
            <div className="font-medium">Chuyển dữ liệu đã nhập trong trình duyệt lên Google Sheet</div>
            <div className="text-slate-600">Đang có trong trình duyệt: {localCounts.map(([t, n]) => `${t} (${n})`).join(' · ')}. Chỉ thêm các dòng chưa có trong Sheet nên bấm lại không bị trùng; Sheet cần có đủ các tab (chạy <code>setup.gs</code>).</div>
            <button className="btn" disabled={status.loading} onClick={() => migrateLocalToSheet((plan) => setMsg({ text: plan.total ? `Đã chuyển ${plan.total} dòng lên Google Sheet.` : 'Không có dòng nào cần chuyển — Sheet đã có đủ dữ liệu.', error: false }))}>Đưa lên Google Sheet</button>
          </div>
        )}
        {mode === 'demo' && <p className="text-xs text-slate-500">Sau khi kết nối Google Sheets (bên dưới), quay lại đây để chuyển dữ liệu hiện có lên Sheet — dữ liệu trong trình duyệt được giữ nguyên, không bị ghi đè khi kết nối.</p>}
      </section>
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
