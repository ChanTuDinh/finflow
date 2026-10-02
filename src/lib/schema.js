// Cấu trúc Google Sheet. Hàng 1 của mỗi tab là header (đúng thứ tự dưới đây).
export const TABS = {
  personal: {
    tab: 'Personal_CashFlow',
    columns: ['id', 'date', 'type', 'category', 'amount', 'account', 'note', 'created_by', 'ref'],
    types: ['Income', 'Expense', 'Transfer'],
    categories: {
      Income: ['Lương', 'Thưởng', 'Side project', 'Đầu tư', 'Khác'],
      Expense: ['Nhà ở', 'Ăn uống', 'Đi lại', 'Hoá đơn', 'Giải trí', 'Sức khoẻ', 'Học tập', 'Mua sắm', 'Trả nợ', 'Khác'],
      Transfer: ['Chuyển nội bộ'],
    },
  },
  business: {
    tab: 'Business_CashFlow',
    columns: ['id', 'date', 'type', 'category', 'amount', 'counterparty', 'note', 'created_by', 'account', 'ref'],
    types: ['Revenue', 'Expense', 'Transfer'],
    categories: {
      Revenue: ['Bán hàng', 'Dịch vụ', 'Quảng cáo/Affiliate', 'Khác'],
      Expense: ['Nhân sự', 'Marketing', 'Công cụ/SaaS', 'Thuê ngoài', 'Thuế/Phí', 'Vận hành', 'Trả nợ', 'Khác'],
      Transfer: ['Chuyển nội bộ'],
    },
  },
  debts: {
    tab: 'Debts',
    columns: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note'],
    owners: ['Personal', 'Business'],
    statuses: ['Active', 'Paid'],
  },
}

TABS.savings = {
  tab: 'Savings',
  columns: ['id', 'name', 'type', 'owner', 'balance', 'monthly_contribution', 'annual_return', 'goal_id', 'status', 'note'],
  types: ['Tiết kiệm', 'Chứng khoán', 'Vàng', 'Quỹ dự phòng', 'Quỹ đầu tư', 'Khác'],
  owners: ['Personal', 'Business'],
  statuses: ['Active', 'Closed'],
}
TABS.goals = {
  tab: 'Goals',
  columns: ['id', 'name', 'owner', 'target_amount', 'target_date', 'status', 'note'],
  owners: ['Personal', 'Business'],
  statuses: ['Active', 'Done'],
}
// Nguồn nợ thứ hai ("Nợ BM"): cùng cấu trúc với Debts, nằm ở tab Debts_BM, tách riêng hoàn toàn khỏi nguồn nợ chính.
TABS.debts_bm = { ...TABS.debts, tab: 'Debts_BM' }
export const DEBT_KINDS = ['debts', 'debts_bm']
TABS.accounts = {
  tab: 'Accounts',
  columns: ['id', 'name', 'bank', 'owner', 'preset', 'status', 'note'], // preset: cấu hình cột sao kê (JSON) do app tự lưu
  owners: ['Personal', 'Business'],
  statuses: ['Active', 'Closed'],
}
TABS.rules = {
  tab: 'Rules',
  columns: ['id', 'keyword', 'category', 'direction', 'owner'], // direction: out | in | any ; owner: Personal | Business | (trống = cả hai)
  directions: ['out', 'in', 'any'],
}
// Các tab bắt buộc phải có trong Sheet; savings/goals là tuỳ chọn (thiếu thì coi như rỗng).
export const CORE_KINDS = ['personal', 'business', 'debts']
export const EMPTY_DATA = () => ({ personal: [], business: [], debts: [], savings: [], goals: [], accounts: [], rules: [], debts_bm: [] })

export const DEBT_PAYMENT_CATEGORY = 'Trả nợ'
export const isInflow = (row) => row.type === 'Income' || row.type === 'Revenue'
// Chuyển khoản giữa các tài khoản của chính mình: không tính vào thu/chi.
export const isTransfer = (row) => row.type === 'Transfer'
export const TRANSFER_CATEGORY = 'Chuyển nội bộ'
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const NUMERIC = new Set(['amount', 'balance', 'apr', 'min_payment', 'due_day', 'monthly_contribution', 'annual_return', 'target_amount'])
const DATE_COLS = new Set(['date', 'target_date'])

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
    obj[c] = DATE_COLS.has(c) ? normalizeDate(v) : NUMERIC.has(c) ? parseNumber(v) : String(v)
  })
  return obj
}

export const valuesFromRow = (kind, row) => TABS[kind].columns.map((c) => row[c] ?? '')
