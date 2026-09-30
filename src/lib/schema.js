// Cấu trúc Google Sheet. Hàng 1 của mỗi tab là header (đúng thứ tự dưới đây).
export const TABS = {
  personal: {
    tab: 'Personal_CashFlow',
    columns: ['id', 'date', 'type', 'category', 'amount', 'account', 'note', 'created_by'],
    types: ['Income', 'Expense'],
    categories: {
      Income: ['Lương', 'Thưởng', 'Side project', 'Đầu tư', 'Khác'],
      Expense: ['Nhà ở', 'Ăn uống', 'Đi lại', 'Hoá đơn', 'Giải trí', 'Sức khoẻ', 'Học tập', 'Mua sắm', 'Trả nợ', 'Khác'],
    },
  },
  business: {
    tab: 'Business_CashFlow',
    columns: ['id', 'date', 'type', 'category', 'amount', 'counterparty', 'note', 'created_by'],
    types: ['Revenue', 'Expense'],
    categories: {
      Revenue: ['Bán hàng', 'Dịch vụ', 'Quảng cáo/Affiliate', 'Khác'],
      Expense: ['Nhân sự', 'Marketing', 'Công cụ/SaaS', 'Thuê ngoài', 'Thuế/Phí', 'Vận hành', 'Trả nợ', 'Khác'],
    },
  },
  debts: {
    tab: 'Debts',
    columns: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note'],
    owners: ['Personal', 'Business'],
    statuses: ['Active', 'Paid'],
  },
}

export const DEBT_PAYMENT_CATEGORY = 'Trả nợ'
export const isInflow = (row) => row.type === 'Income' || row.type === 'Revenue'
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const NUMERIC = new Set(['amount', 'balance', 'apr', 'min_payment', 'due_day'])

// Sheet serial date -> yyyy-mm-dd
function serialToIso(n) {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000))
  return d.toISOString().slice(0, 10)
}

export function normalizeDate(v) {
  if (v === '' || v == null) return ''
  if (typeof v === 'number') return serialToIso(v)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s
}

export function parseNumber(v) {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function rowFromValues(kind, values) {
  const obj = {}
  TABS[kind].columns.forEach((c, i) => {
    const v = values[i] ?? ''
    obj[c] = c === 'date' ? normalizeDate(v) : NUMERIC.has(c) ? parseNumber(v) : String(v)
  })
  return obj
}

export const valuesFromRow = (kind, row) => TABS[kind].columns.map((c) => row[c] ?? '')
