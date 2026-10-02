import { newId } from './schema.js'
import { addMonths } from './calc.js'

// Dữ liệu mẫu để chạy thử khi chưa kết nối Google Sheet.
export function demoData(endYm) {
  const P = [], B = [], D = []
  for (let i = -8; i <= 0; i++) {
    const ym = addMonths(endYm, i)
    const p = (day, type, category, amount, note = '') => P.push({ id: newId(), date: `${ym}-${day}`, type, category, amount, account: 'Vietcombank', note, created_by: 'demo' })
    p('05', 'Income', 'Lương', 40_000_000)
    if (i % 3 === 0) p('20', 'Income', 'Side project', 6_000_000 + i * 200_000)
    p('06', 'Expense', 'Nhà ở', 9_000_000)
    p('10', 'Expense', 'Ăn uống', 7_000_000 + (i > -3 ? 1_800_000 : 0))
    p('12', 'Expense', 'Đi lại', 1_500_000)
    p('15', 'Expense', 'Giải trí', 2_000_000 + (i > -3 ? 1_000_000 : 0))
    p('18', 'Expense', 'Hoá đơn', 1_200_000)
    p('25', 'Expense', 'Trả nợ', 5_500_000, 'Trả góp + thẻ')
    const b = (day, type, category, amount) => B.push({ id: newId(), date: `${ym}-${day}`, type, category, amount, counterparty: '', note: '', created_by: 'demo' })
    b('08', 'Revenue', 'Dịch vụ', 25_000_000 + i * 800_000)
    b('22', 'Revenue', 'Bán hàng', 8_000_000)
    b('10', 'Expense', 'Công cụ/SaaS', 3_000_000)
    b('15', 'Expense', 'Thuê ngoài', 9_000_000)
    b('28', 'Expense', 'Marketing', 4_000_000)
  }
  const d = (name, lender, owner, balance, apr, min_payment, due_day, term_months = 0) => D.push({ id: newId(), name, lender, owner, balance, apr, min_payment, due_day, status: 'Active', note: '', repay_type: 'Trả gốc và lãi', term_months })
  d('Thẻ tín dụng', 'Techcombank', 'Personal', 45_000_000, 30, 2_500_000, 15, 24)
  d('Vay mua xe', 'VPBank', 'Personal', 180_000_000, 11, 3_000_000, 25, 70)
  d('Vay vốn kinh doanh', 'Agribank', 'Business', 120_000_000, 9, 4_000_000, 5, 36)
  const G = [], S = []
  const goal = (id, name, owner, target_amount, months) => G.push({ id, name, owner, target_amount, target_date: `${addMonths(endYm, months)}-28`, status: 'Active', note: '' })
  goal('g1', 'Quỹ khẩn cấp 6 tháng', 'Personal', 150_000_000, 18)
  goal('g2', 'Vốn dự phòng doanh nghiệp', 'Business', 200_000_000, 30)
  const sv = (name, type, owner, balance, monthly_contribution, annual_return, goal_id) => S.push({ id: newId(), name, type, owner, balance, monthly_contribution, annual_return, goal_id, status: 'Active', note: '' })
  sv('Sổ tiết kiệm VCB', 'Tiết kiệm', 'Personal', 60_000_000, 4_000_000, 5.5, 'g1')
  sv('Quỹ trái phiếu', 'Quỹ đầu tư', 'Personal', 30_000_000, 2_000_000, 8, '')
  sv('Tài khoản DN dự phòng', 'Quỹ dự phòng', 'Business', 50_000_000, 3_000_000, 4.5, 'g2')
  const A = [
    { id: 'a1', name: 'Vietcombank', bank: 'Vietcombank', owner: 'Personal', preset: '', status: 'Active', note: '' },
    { id: 'a2', name: 'Techcombank', bank: 'Techcombank', owner: 'Personal', preset: '', status: 'Active', note: '' },
    { id: 'a3', name: 'VCB Doanh nghiệp', bank: 'Vietcombank', owner: 'Business', preset: '', status: 'Active', note: '' },
  ]
  const R = [
    { id: 'r1', keyword: 'grab', category: 'Đi lại', direction: 'out', owner: '' },
    { id: 'r2', keyword: 'shopee', category: 'Mua sắm', direction: 'out', owner: 'Personal' },
    { id: 'r3', keyword: 'luong', category: 'Lương', direction: 'in', owner: 'Personal' },
    { id: 'r4', keyword: 'tien nha', category: 'Nhà ở', direction: 'out', owner: 'Personal' },
  ]
  const BM = []
  const bm = (name, lender, owner, balance, apr, min_payment, due_day, repay_type = 'Trả gốc và lãi', term_months = 0) => BM.push({ id: newId(), name, lender, owner, balance, apr, min_payment, due_day, status: 'Active', note: '', record_date: `${endYm}-01`, repay_type, term_months })
  bm('Vay BM #1', 'BM', 'Business', 90_000_000, 12, 900_000, 10, 'Trả lãi only')
  bm('Vay BM #2', 'BM', 'BM', 40_000_000, 8, 1_500_000, 20, 'Trả gốc và lãi', 30)
  return { personal: P, business: B, debts: D, savings: S, goals: G, accounts: A, rules: R, debts_bm: BM }
}
