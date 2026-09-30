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
  const d = (name, lender, owner, balance, apr, min_payment, due_day) => D.push({ id: newId(), name, lender, owner, balance, apr, min_payment, due_day, status: 'Active', note: '' })
  d('Thẻ tín dụng', 'Techcombank', 'Personal', 45_000_000, 30, 2_500_000, 15)
  d('Vay mua xe', 'VPBank', 'Personal', 180_000_000, 11, 3_000_000, 25)
  d('Vay vốn kinh doanh', 'Agribank', 'Business', 120_000_000, 9, 4_000_000, 5)
  return { personal: P, business: B, debts: D }
}
