// Cấu trúc Google Sheet. Hàng 1 của mỗi tab là header (đúng thứ tự dưới đây).
// 6 quỹ chi tiêu cá nhân (khớp bảng Chi tiêu cá nhân forecast)
export const SPEND_FUNDS = ['Need', 'Want', 'Edu', 'Reserve', 'Investment', 'Giving']
// Ví cá nhân: loại "Trả nợ" chỉ có 2 danh mục này
export const PERSONAL_DEBT_CATEGORIES = ['Trả nợ BM', 'Trả nợ cá nhân']
export const TABS = {
  personal: {
    tab: 'Personal_CashFlow',
    columns: ['id', 'date', 'type', 'category', 'amount', 'account', 'note', 'created_by', 'ref'],
    types: ['Income', 'Expense', 'Transfer'],
    categories: {
      Income: ['Lương', 'Thưởng', 'Side project', 'Đầu tư', 'Chuyển ví', 'Khác'],
      Expense: [...SPEND_FUNDS, 'Chuyển ví', 'Khác', ...PERSONAL_DEBT_CATEGORIES], // Need đứng đầu = danh mục mặc định của Chi; Trả nợ chọn qua Loại "Trả nợ"
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
    // min_payment = số tiền trả mỗi tháng; repay_type: xem REPAY; term_months: số tháng còn lại (chỉ cần khi trả gốc và lãi)
    columns: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note', 'repay_type', 'term_months'],
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
// Ví BM: sổ thu/chi riêng, cùng cấu trúc và danh mục với Cá nhân, lưu ở tab BM_CashFlow
TABS.bm = { ...TABS.personal, tab: 'BM_CashFlow' }
// Form thêm/sửa giao dịch của Ví BM chỉ cho chọn các danh mục này (dòng cũ có danh mục khác vẫn giữ nguyên khi sửa)
export const BM_FORM_CATEGORIES = { Income: ['Chuyển ví', 'Quỹ BM'], Expense: ['Trả nợ', 'Chuyển ví', 'Chi phí sống'], Transfer: ['Chuyển nội bộ'] }
export const CASH_KINDS = ['personal', 'business', 'bm']
// Huy hiệu thẻ ngân hàng: chữ viết tắt + màu (không dùng logo thương hiệu)
export const CARD_COLORS = ['#2563eb', '#0d9488', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#db2777', '#475569']
export const defaultBadge = (a) => {
  const src = (a.bank || a.name || '').trim()
  const words = src.split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : src.slice(0, 3)
  return letters.slice(0, 3).toUpperCase() || '?'
}
export const cardBadge = (a) => ({ text: (a.badge || '').trim() || defaultBadge(a), color: a.color || CARD_COLORS[0] })
export const WALLET_LABEL = { personal: 'Ví cá nhân', business: 'Doanh nghiệp', bm: 'Ví BM' }

// Nguồn nợ thứ hai ("Nợ BM"): cùng cấu trúc với Debts, nằm ở tab Debts_BM, tách riêng hoàn toàn khỏi nguồn nợ chính.
// record_date: ngày ghi nhận thông tin/số dư của khoản nợ (cột cuối để Sheet cũ vẫn tương thích)
TABS.debts_bm = { ...TABS.debts, tab: 'Debts_BM', columns: [...TABS.debts.columns.slice(0, 10), 'record_date', 'repay_type', 'term_months'], owners: [...TABS.debts.owners, 'BM'] }

// Bộ lọc "Phạm vi" của trang nợ: giá trị -> chủ khoản nợ (null = tất cả). Nợ BM có thêm lựa chọn BM.
export const SCOPE_OWNER = { all: null, personal: 'Personal', business: 'Business', bm: 'BM' }
export const debtScopeOptions = (kind) => (kind === 'debts_bm'
  ? [{ value: 'all', label: 'Tất cả' }, { value: 'personal', label: 'Chỉ cá nhân' }, { value: 'business', label: 'Chỉ doanh nghiệp' }, { value: 'bm', label: 'Chỉ BM' }]
  : [{ value: 'all', label: 'Cá nhân + Doanh nghiệp' }, { value: 'personal', label: 'Chỉ cá nhân' }, { value: 'business', label: 'Chỉ doanh nghiệp' }])
// Dòng tiền dùng làm cơ sở/thống kê theo phạm vi: cá nhân hoặc doanh nghiệp riêng, còn lại gộp cả hai
// kind 'debts_bm': "Tất cả" gồm cả Ví BM (nguồn nợ BM có sổ thu/chi riêng); nợ chính vẫn chỉ cá nhân + doanh nghiệp
export const cashRowsForScope = (data, scope, kind = 'debts') => (scope === 'personal' ? data.personal : scope === 'business' ? data.business : scope === 'bm' ? data.bm : kind === 'debts_bm' ? [...data.personal, ...data.business, ...data.bm] : [...data.personal, ...data.business])
export const DEBT_KINDS = ['debts', 'debts_bm']
// Lịch sử trả nợ (dùng chung cho Nợ và Nợ BM, phân biệt bằng cột source). debt_name chép lại tên để đọc Sheet cho dễ.
TABS.payments = {
  tab: 'Debt_Payments',
  columns: ['id', 'date', 'source', 'debt_id', 'debt_name', 'type', 'amount', 'principal', 'interest', 'balance_after', 'note', 'created_by', 'adjust_prev'], // adjust_prev: JSON giá trị cũ (trả/tháng, số tháng) nếu lần trả này làm tool điều chỉnh, để hoàn lại khi xoá
}
TABS.accounts = {
  tab: 'Accounts',
  columns: ['id', 'name', 'bank', 'owner', 'preset', 'status', 'note', 'badge', 'color'], // preset: cấu hình cột sao kê (JSON) do app tự lưu; badge: huy hiệu 2-3 chữ, color: màu huy hiệu (#rrggbb)
  owners: ['Personal', 'Business', 'BM'],
  statuses: ['Active', 'Closed'],
}
TABS.rules = {
  tab: 'Rules',
  columns: ['id', 'keyword', 'category', 'direction', 'owner'], // direction: out | in | any ; owner: Personal | Business | (trống = cả hai)
  directions: ['out', 'in', 'any'],
}
// Các tab bắt buộc phải có trong Sheet; savings/goals là tuỳ chọn (thiếu thì coi như rỗng).
export const CORE_KINDS = ['personal', 'business', 'debts']
export const EMPTY_DATA = () => ({ personal: [], business: [], debts: [], savings: [], goals: [], accounts: [], rules: [], debts_bm: [], payments: [], bm: [] })

// Hình thức trả nợ (lưu nguyên chữ trong Sheet; ô trống = Trả gốc và lãi)
export const REPAY = { both: 'Trả gốc và lãi', interestOnly: 'Trả lãi only' }
export const isInterestOnly = (d) => d.repay_type === REPAY.interestOnly

export const DEBT_PAYMENT_CATEGORY = 'Trả nợ'
// Khoản trả nợ: danh mục 'Trả nợ' (cũ, Doanh nghiệp, Ví BM) hoặc 'Trả nợ BM' / 'Trả nợ cá nhân' (Ví cá nhân)
export const isDebtPayment = (category) => category === DEBT_PAYMENT_CATEGORY || PERSONAL_DEBT_CATEGORIES.includes(category)
export const isInflow = (row) => row.type === 'Income' || row.type === 'Revenue'
// Chuyển khoản giữa các tài khoản của chính mình: không tính vào thu/chi.
export const isTransfer = (row) => row.type === 'Transfer'
export const WALLET_MOVE_CATEGORY = 'Chuyển ví'
export const BM_FUND_CATEGORY = 'Quỹ BM'
export const TRANSFER_CATEGORY = 'Chuyển nội bộ'
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const NUMERIC = new Set(['amount', 'balance', 'apr', 'min_payment', 'due_day', 'monthly_contribution', 'annual_return', 'target_amount', 'term_months', 'principal', 'interest', 'balance_after'])
const DATE_COLS = new Set(['date', 'target_date', 'record_date'])

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
