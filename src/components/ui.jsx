import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { ResponsiveContainer } from 'recharts'

export const COLORS = { personal: '#2563eb', business: '#f59e0b', income: '#10b981', expense: '#ef4444', net: '#0f172a', grid: '#e2e8f0' }
export const SERIES = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

// solid: nền đặc (className đặt màu nền), chữ trắng; số âm hiện đỏ nhạt để vẫn nổi trên nền đậm
export function Stat({ label, value, sub, tone, className = '', solid = false }) {
  const valueTone = solid ? (tone === 'neg' ? 'text-red-200' : 'text-white') : tone === 'neg' ? 'text-red-600' : tone === 'pos' ? 'text-emerald-600' : ''
  return (
    <div className={`card ${className}`}>
      <div className={`text-xs ${solid ? 'text-white/80' : 'text-slate-500'}`}>{label}</div>
      <div className={`text-base sm:text-lg font-semibold break-words ${valueTone}`}>{value}</div>
      {sub && <div className={`text-xs ${solid ? 'text-white/70' : 'text-slate-400'}`}>{sub}</div>}
    </div>
  )
}

export const Chart = ({ height = 280, children }) => (
  <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
)

export function Modal({ title, onClose, children }) {
  // Chỉ đóng khi bấm-và-thả đều ở nền tối: kéo bôi đen chữ rồi thả chuột ra ngoài không làm mất form đang nhập.
  const downOnBackdrop = useRef(false)
  // Render ra document.body: không bị margin của khối cha (space-y-*) làm lệch lớp phủ
  return createPortal(
    <div className="fixed inset-0 z-10 bg-black/40 flex items-center justify-center p-4"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-full overflow-y-auto p-5">
        <div className="flex justify-between mb-3"><h3 className="font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Đóng">✕</button></div>
        {children}
      </div>
    </div>,
    document.body,
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

// Enter trong ô nhập chỉ chuyển sang ô kế tiếp (như bảng tính); lưu bằng nút "Lưu" để không vô tình lưu dòng còn dở.
export function focusNextOnEnter(e) {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return
  e.preventDefault()
  const fields = [...e.currentTarget.querySelectorAll('input:not([type=hidden]), select, textarea, button[type=submit]')]
  fields[fields.indexOf(e.target) + 1]?.focus()
}
