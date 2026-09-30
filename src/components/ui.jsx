import { ResponsiveContainer } from 'recharts'

export const COLORS = { personal: '#2563eb', business: '#f59e0b', income: '#10b981', expense: '#ef4444', net: '#0f172a', grid: '#e2e8f0' }
export const SERIES = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-base sm:text-lg font-semibold break-words ${tone === 'neg' ? 'text-red-600' : tone === 'pos' ? 'text-emerald-600' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export const Chart = ({ height = 280, children }) => (
  <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
)

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-10 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-3"><h3 className="font-semibold">{title}</h3><button onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

export const Field = ({ label, children }) => (<div><label className="label">{label}</label>{children}</div>)

// Bộ điều khiển bộ lọc dùng chung: nhãn nhỏ phía trên + ô chọn / nút chuyển.
export function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <Field label={label}>
      <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </Field>
  )
}

export function Segmented({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 ${value === o.value ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'}`}>{o.label}</button>
        ))}
      </div>
    </Field>
  )
}

export const FilterRow = ({ children }) => <div className="flex flex-wrap items-end gap-3 mb-4">{children}</div>
