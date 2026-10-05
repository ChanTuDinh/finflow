import { useState } from 'react'
import { useStore } from './lib/store.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CashFlow from './pages/CashFlow.jsx'
import Debts from './pages/Debts.jsx'
import Reports from './pages/Reports.jsx'
import Forecast from './pages/Forecast.jsx'
import Settings from './pages/Settings.jsx'
import Savings from './pages/Savings.jsx'
import Import from './pages/Import.jsx'
import ForecastSavings from './pages/ForecastSavings.jsx'
import { makeBackup, downloadJson, backupFileName, getLastBackup, setLastBackup, backupStatus, backupLabel } from './lib/backup.js'

const PAGES = [
  ['dashboard', 'Tổng quan'],
  ['reports', 'Báo cáo'],
  ['personal', 'Ví cá nhân'],
  ['debts', 'Nợ cá nhân'],
  ['forecast', 'Nợ CN forecast'],
  ['savings', 'Tích lũy'],
  ['forecastSavings', 'Forecast Tích lũy'],
  ['business', 'Doanh nghiệp'],
  ['bm', 'Ví BM'],
  ['debtsBm', 'Nợ BM'],
  ['forecastBm', 'Nợ BM Forecast'],
  ['settings', 'Cài đặt'],
]

// Các tab đang ưu tiên làm việc (Ví BM, Nợ BM, Nợ BM Forecast): tô một màu riêng cho dễ thấy giữa nhiều tab
const FOCUS_TABS = new Set(['bm', 'debtsBm', 'forecastBm'])
// Ví cá nhân, Nợ cá nhân, Nợ CN forecast: màu xanh ngọc riêng (tách khỏi nhóm BM màu tím)
const TEAL_TABS = new Set(['personal', 'debts', 'forecast'])

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { mode, status, refresh, data } = useStore()
  const [lastBk, setLastBk] = useState(getLastBackup)
  const bk = backupStatus(lastBk)
  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">FinFlow</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${mode === 'sheets' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {mode === 'sheets' ? 'Google Sheets' : 'Lưu trong trình duyệt này'}
        </span>
        {mode === 'sheets' && <button className="btn-ghost" onClick={refresh} disabled={status.loading}>↻ Tải lại</button>}
        {mode === 'demo' && (
          <button className={bk.stale ? 'inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium border border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200' : 'btn-ghost'}
            title="Dữ liệu chỉ lưu trong trình duyệt này — tải file sao lưu" onClick={() => { downloadJson(backupFileName(), makeBackup(data)); setLastBk(setLastBackup()) }}>
            ⬇ Sao lưu <span className="ml-1 text-xs font-normal opacity-80">({backupLabel(bk)})</span>
          </button>
        )}
        {status.loading && <span className="text-xs text-slate-500">Đang xử lý…</span>}
      </header>
      {status.error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-2">{status.error}</div>}
      <nav className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
        {PAGES.map(([k, label]) => {
          const focus = FOCUS_TABS.has(k)
          const cls = TEAL_TABS.has(k)
            ? `rounded-t-md font-medium ${page === k ? 'border-teal-700 bg-teal-600 text-white' : 'border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200'}`
            : focus
            ? `rounded-t-md font-medium ${page === k ? 'border-violet-700 bg-violet-600 text-white' : 'border-transparent bg-violet-100 text-violet-800 hover:bg-violet-200'}`
            : page === k ? 'border-slate-900 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          return (
            <button key={k} onClick={() => setPage(k)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${cls}`}>
              {label}
            </button>
          )
        })}
      </nav>
      {page === 'dashboard' && <Dashboard />}
      {(page === 'personal' || page === 'business' || page === 'bm') && <CashFlow key={page} kind={page} onImport={() => setPage('import')} />}
      {page === 'import' && <Import onBack={() => setPage('personal')} />}
      {page === 'debts' && <Debts />}
      {page === 'reports' && <Reports />}
      {page === 'forecast' && <Forecast />}
      {page === 'debtsBm' && <Debts kind="debts_bm" />}
      {page === 'forecastBm' && <Forecast kind="debts_bm" />}
      {page === 'savings' && <Savings />}
      {page === 'forecastSavings' && <ForecastSavings />}
      {page === 'settings' && <Settings />}
    </div>
  )
}
