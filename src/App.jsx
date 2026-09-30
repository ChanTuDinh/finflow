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

const PAGES = [
  ['dashboard', 'Tổng quan'],
  ['personal', 'Cá nhân'],
  ['business', 'Doanh nghiệp'],
  ['debts', 'Nợ'],
  ['forecast', 'Forecast Nợ'],
  ['savings', 'Tích lũy'],
  ['forecastSavings', 'Forecast Tích lũy'],
  ['reports', 'Báo cáo'],
  ['settings', 'Cài đặt'],
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { mode, status, refresh } = useStore()
  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">FinFlow</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${mode === 'sheets' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {mode === 'sheets' ? 'Google Sheets' : 'Demo (dữ liệu local)'}
        </span>
        {mode === 'sheets' && <button className="btn-ghost" onClick={refresh} disabled={status.loading}>↻ Tải lại</button>}
        {status.loading && <span className="text-xs text-slate-500">Đang xử lý…</span>}
      </header>
      {status.error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-2">{status.error}</div>}
      <nav className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
        {PAGES.map(([k, label]) => (
          <button key={k} onClick={() => setPage(k)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${page === k ? 'border-slate-900 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </nav>
      {page === 'dashboard' && <Dashboard />}
      {(page === 'personal' || page === 'business') && <CashFlow key={page} kind={page} onImport={() => setPage('import')} />}
      {page === 'import' && <Import onBack={() => setPage('personal')} />}
      {page === 'debts' && <Debts />}
      {page === 'reports' && <Reports />}
      {page === 'forecast' && <Forecast />}
      {page === 'savings' && <Savings />}
      {page === 'forecastSavings' && <ForecastSavings />}
      {page === 'settings' && <Settings />}
    </div>
  )
}
