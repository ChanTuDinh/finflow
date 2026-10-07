import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { makeBackup, parseBackup, parsePlans, downloadJson, backupFileName, countRows, BACKUP_KINDS, getLastBackup, setLastBackup, backupStatus, backupLabel } from '../lib/backup.js'
import { SHEETS_ENABLED } from '../lib/config.js'
import { Field } from '../components/ui.jsx'
import { TABS } from '../lib/schema.js'

export default function Settings() {
  const { settings, setSettings, mode, connect, disconnect, clearAllLocal, status, data, localSnapshot, restoreLocal, migrateLocalToSheet } = useStore()
  const [msg, setMsg] = useState({ text: '', error: false })
  const local = localSnapshot()
  const localCounts = local ? BACKUP_KINDS.map((k) => [TABS[k].tab, local[k]?.length || 0]).filter(([, n]) => n > 0) : []
  const [lastBk, setLastBk] = useState(getLastBackup)
  const bk = backupStatus(lastBk)
  const saveBackup = () => { downloadJson(backupFileName(), makeBackup(data, settings)); setLastBk(setLastBackup()) }
  const set = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value.trim() }))
  return (
    <div className="space-y-4 max-w-xl">
      <section className="card space-y-3">
        <h2 className="font-semibold">Sao lưu &amp; chuyển dữ liệu</h2>
        <p className="text-sm text-slate-600">
          {mode === 'demo'
            ? <>Dữ liệu bạn nhập <b>lưu trong trình duyệt này</b> (máy này, trình duyệt này). Tắt trình duyệt vẫn còn, nhưng <b>mất</b> nếu xoá dữ liệu trình duyệt, dùng cửa sổ ẩn danh, hoặc mở bằng máy/trình duyệt khác. Hãy <b>tải file sao lưu thường xuyên</b> và cất ở nơi an toàn.</>
            : <>Dữ liệu đang lưu trong <b>Google Sheet</b> của bạn — mở ở máy hoặc trình duyệt khác vẫn thấy. Bạn vẫn có thể tải thêm file sao lưu.</>}
        </p>
        <p className={`text-sm font-medium ${bk.stale ? 'text-amber-700' : 'text-emerald-700'}`}>Lần sao lưu gần nhất: {backupLabel(bk)}{bk.stale ? ' — nên sao lưu ngay' : ''}</p>
        {msg.text && <div className={`rounded-lg border text-sm p-2 ${msg.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{msg.text}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => { saveBackup(); setMsg({ text: `Đã tải file sao lưu (${countRows(data)} dòng dữ liệu). Cất file ở nơi an toàn.`, error: false }) }}>⬇ Tải file sao lưu</button>
          {mode === 'demo' && (
            <label className="btn-ghost cursor-pointer">Khôi phục từ file sao lưu
              <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = ''
                if (!file) return
                try {
                  const text = await file.text(), restored = parseBackup(text), plans = parsePlans(text)
                  if (confirm(`Thay TOÀN BỘ dữ liệu hiện tại (${countRows(data)} dòng) bằng dữ liệu trong file (${countRows(restored)} dòng)?\n\nNên tải file sao lưu dữ liệu hiện tại trước.`)) { restoreLocal(restored); if (Object.keys(plans).length) setSettings((s) => ({ ...s, ...plans })); setMsg({ text: `Đã khôi phục ${countRows(restored)} dòng dữ liệu${Object.keys(plans).length ? ' và thiết lập các bảng Dự đoán' : ''} từ file.`, error: false }) }
                } catch (err) { setMsg({ text: err.message, error: true }) }
              }} />
            </label>
          )}
        </div>
        {SHEETS_ENABLED && mode === 'sheets' && localCounts.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 text-sm">
            <div className="font-medium">Chuyển dữ liệu đã nhập trong trình duyệt lên Google Sheet</div>
            <div className="text-slate-600">Đang có trong trình duyệt: {localCounts.map(([t, n]) => `${t} (${n})`).join(' · ')}. Chỉ thêm các dòng chưa có trong Sheet nên bấm lại không bị trùng; Sheet cần có đủ các tab (chạy <code>setup.gs</code>).</div>
            <button className="btn" disabled={status.loading} onClick={() => migrateLocalToSheet((plan) => setMsg({ text: plan.total ? `Đã chuyển ${plan.total} dòng lên Google Sheet.` : 'Không có dòng nào cần chuyển — Sheet đã có đủ dữ liệu.', error: false }))}>Đưa lên Google Sheet</button>
          </div>
        )}
        {SHEETS_ENABLED && mode === 'demo' && <p className="text-xs text-slate-500">Sau khi kết nối Google Sheets (bên dưới), quay lại đây để chuyển dữ liệu hiện có lên Sheet — dữ liệu trong trình duyệt được giữ nguyên, không bị ghi đè khi kết nối.</p>}
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Cài đặt chung</h2>
        <Field label="Tên hiển thị của bạn (ghi vào các giao dịch bạn thêm)"><input className="input" value={settings.user} onChange={set('user')} /></Field>
        <Field label="Tiền tệ"><select className="input" value={settings.currency} onChange={set('currency')}>{['VND', 'USD', 'EUR', 'SGD'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      </section>
      {SHEETS_ENABLED && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Kết nối Google Sheets</h2>
          <Field label="Google OAuth Client ID"><input className="input" value={settings.clientId} onChange={set('clientId')} placeholder="xxxx.apps.googleusercontent.com" /></Field>
          <Field label="Spreadsheet ID (đoạn giữa /d/ và /edit trong URL)"><input className="input" value={settings.sheetId} onChange={set('sheetId')} /></Field>
          <div className="flex gap-2">
            {mode === 'demo'
              ? <button className="btn" onClick={connect} disabled={status.loading || !settings.clientId || !settings.sheetId}>Kết nối Google Sheets</button>
              : <button className="btn-ghost" onClick={disconnect}>Ngắt kết nối (về lưu trong trình duyệt)</button>}
          </div>
        </section>
      )}
      {mode === 'demo' && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-red-700">Xoá toàn bộ dữ liệu</h2>
          <p className="text-sm text-slate-600">Xoá hết dữ liệu trong trình duyệt này và bắt đầu lại từ trống. Tool tự tải file sao lưu trước khi xoá để bạn khôi phục được.</p>
          <button className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50"
            onClick={() => { if (confirm(`Xoá TOÀN BỘ ${countRows(data)} dòng dữ liệu trong trình duyệt này?\n\nTool sẽ tự tải file sao lưu trước khi xoá.`)) { saveBackup(); clearAllLocal() } }}>Xoá toàn bộ dữ liệu…</button>
        </section>
      )}
      {SHEETS_ENABLED && <section className="card text-sm space-y-1">
        <h2 className="font-semibold">Cấu trúc Sheet (hàng 1 = header)</h2>
        {Object.values(TABS).map((t) => <p key={t.tab}><b>{t.tab}</b>: <code className="text-xs">{t.columns.join(' | ')}</code></p>)}
        <p className="text-slate-500">Xem thư mục <code>sheet-template/</code> để tạo sheet mẫu.</p>
      </section>}
    </div>
  )
}
