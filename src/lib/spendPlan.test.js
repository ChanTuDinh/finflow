import test from 'node:test'
import assert from 'node:assert/strict'
import { incomeForYear, BUCKETS, resolvePcts, sumPcts, allocate, monthList, buildPlan } from './spendPlan.js'

const def = resolvePcts()
test('tỷ lệ mặc định cộng đúng 100%', () => assert.equal(sumPcts(def), 100))
test('resolvePcts bỏ giá trị sai, giữ giá trị hợp lệ', () => {
  const r = resolvePcts({ need: -1, want: 'x', edu: 15 })
  assert.deepEqual([r.need, r.want, r.edu], [60, 10, 15])
})
test('allocate khớp tổng khi tỷ lệ 100%', () => {
  const a = allocate(33333333, def)
  assert.equal(Object.values(a).reduce((x, y) => x + y, 0), 33333333)
  assert.equal(a.investment, Math.round(33333333 * 0.05))
})
test('allocate không ép tổng khi tỷ lệ khác 100%', () => assert.equal(allocate(1000, { ...def, need: 50 }).need, 500))
test('monthList qua năm', () => assert.deepEqual(monthList('2026-11', 3), ['2026-11', '2026-12', '2027-01']))
test('buildPlan 12 tháng', () => {
  const p = buildPlan(() => 40000000, def, '2026-01')
  assert.equal(p.months.length, 12)
  assert.equal(p.months[0].amounts.need, 24000000)
  assert.equal(p.total, 40000000 * 12)
})
test('buildPlan: thu nhập khác nhau theo năm, lũy kế cộng dồn', () => {
  const inc = { 2026: 10000000, 2027: 20000000 }
  const p = buildPlan((y) => inc[y], def, '2026-01', 24)
  assert.equal(p.months[11].cumulative, 10000000 * 12)
  assert.equal(p.months[12].total, 20000000)
  assert.equal(p.total, 10000000 * 12 + 20000000 * 12)
})
test('incomeForYear: theo năm, số cũ chỉ áp cho năm hiện tại', () => {
  const saved = { monthlyIncome: 30000000, incomeByYear: { 2027: 45000000 } }
  assert.equal(incomeForYear(saved, '2027', '2026'), 45000000)
  assert.equal(incomeForYear(saved, '2026', '2026'), 30000000)
  assert.equal(incomeForYear(saved, '2028', '2026'), 0)
  assert.equal(incomeForYear({ incomeByYear: { 2026: 5 }, monthlyIncome: 9 }, '2026', '2026'), 5)
})
test('thu nhập âm/rỗng -> 0', () => assert.equal(buildPlan(() => '', def, '2026-10').total, 0))

test('actualByFund: gom theo quỹ, lọc năm / tháng, danh mục khác vào chưa phân quỹ', async () => {
  const { actualByFund } = await import('./spendPlan.js')
  const rows = [
    { date: '2026-03-05', category: 'Need', amount: 600 },
    { date: '2026-03-20', category: 'Want', amount: 100 },
    { date: '2026-04-02', category: 'Need', amount: 300 },
    { date: '2026-04-09', category: 'Nhà ở', amount: 50 },
    { date: '2027-01-01', category: 'Need', amount: 999 },
  ]
  const all = actualByFund(rows, { years: ['2026', '2027'] })
  assert.deepEqual([all.per.need, all.per.want, all.unassigned, all.total, all.count], [1899, 100, 50, 2049, 5])
  const y26 = actualByFund(rows, { years: ['2026', '2027'], year: '2026' })
  assert.deepEqual([y26.per.need, y26.total], [900, 1050])
  const apr = actualByFund(rows, { years: ['2026', '2027'], year: '2026', month: '04' })
  assert.deepEqual([apr.per.need, apr.unassigned, apr.total], [300, 50, 350])
  // "Tất cả năm" chỉ lấy các năm trong danh sách đang xét
  assert.equal(actualByFund(rows, { years: ['2026'] }).per.need, 900)
  assert.equal(actualByFund([], { years: ['2026'] }).total, 0)
  // tính đến hết tháng 3: mỗi năm chỉ lấy T1-T3 (bỏ tháng 4/2026; 2027-01 vẫn tính)
  const ytd = actualByFund(rows, { years: ['2026', '2027'], untilMonth: 3 })
  assert.deepEqual([ytd.per.need, ytd.per.want, ytd.unassigned, ytd.total], [600 + 999, 100, 0, 1699])
  assert.equal(actualByFund(rows, { years: ['2026'], year: '2026', untilMonth: '04' }).per.need, 900)
})

test('actualFundTags: tag con của từng quỹ, % trên tổng quỹ, quỹ khác không lẫn vào', async () => {
  const { actualFundTags } = await import('./spendPlan.js')
  const rows = [
    { date: '2026-03-05', category: 'Need', amount: 600, tag: 'Food' },
    { date: '2026-03-06', category: 'Need', amount: 300, tag: 'Food, Điện nước' },
    { date: '2026-03-07', category: 'Need', amount: 100, tag: '' },
    { date: '2026-03-08', category: 'Want', amount: 999, tag: 'Cafe' },
    { date: '2026-03-09', category: 'Nhà ở', amount: 50, tag: 'Thuê' },
    { date: '2027-03-09', category: 'Need', amount: 7, tag: 'Food' },
  ]
  const opts = { years: ['2026'], year: '2026' }
  const need = actualFundTags(rows, opts, 'need')
  assert.equal(need.total, 1000)
  assert.deepEqual(need.items.map((x) => [x.tag, x.amount, x.pct]), [['Food', 750, 0.75], ['Điện nước', 150, 0.15]])
  assert.deepEqual([need.untagged.amount, need.untagged.pct], [100, 0.1])
  assert.deepEqual(actualFundTags(rows, opts, '__un').items.map((x) => x.tag), ['Thuê'])
  assert.equal(actualFundTags(rows, opts, 'giving').total, 0)
})

test('quỹ thêm: fundsFrom, newFund (trùng tên, key), allocate / buildPlan theo quỹ mới', async () => {
  const m = await import('./spendPlan.js')
  const saved = { extraFunds: [{ key: 'x_tra_no', name: 'Trả nợ' }] }
  const funds = m.fundsFrom(saved)
  assert.equal(funds.length, 7)
  assert.equal(funds[6].pct, 0)
  assert.ok(m.newFund('need', funds).error) // trùng tên (không phân biệt hoa thường)
  assert.ok(m.newFund('  ', funds).error)
  const nf = m.newFund('Du lịch', funds)
  assert.equal(nf.fund.key, 'x_du_lich')
  assert.equal(m.newFund('Trả nợ ', [...funds]).error, 'Quỹ "Trả nợ" đã có')
  const pcts = { need: 50, want: 10, edu: 10, reserve: 10, investment: 5, giving: 5, x_tra_no: 10 }
  assert.equal(m.sumPcts(pcts, funds), 100)
  const a = m.allocate(1000, pcts, funds)
  assert.equal(a.x_tra_no, 100)
  assert.equal(Object.values(a).reduce((x, y) => x + y, 0), 1000)
  const p = m.buildPlan(() => 1000, pcts, '2026-01', 2, funds)
  assert.equal(p.months[0].amounts.x_tra_no, 100)
  assert.equal(p.total, 2000)
})

test('quỹ Trả nợ lấy thực tế từ các khoản trả nợ; không có quỹ này thì trả nợ bị bỏ qua', async () => {
  const m = await import('./spendPlan.js')
  const rows = [
    { date: '2026-03-05', category: 'Trả nợ BM', amount: 5000, tag: 'Vay A' },
    { date: '2026-03-06', category: 'Trả nợ cá nhân', amount: 3000, tag: '' },
    { date: '2026-03-07', category: 'Need', amount: 100, tag: '' },
    { date: '2026-03-08', category: 'Nhà ở', amount: 50, tag: '' },
  ]
  const opts = { years: ['2026'], year: '2026' }
  const without = m.actualByFund(rows, opts)
  assert.deepEqual([without.per.need, without.unassigned, without.total], [100, 50, 150])
  const funds = m.fundsFrom({ extraFunds: [{ key: 'x_tra_no', name: 'Trả nợ' }] })
  const withDebt = m.actualByFund(rows, opts, funds)
  assert.deepEqual([withDebt.per.x_tra_no, withDebt.per.need, withDebt.unassigned, withDebt.total], [8000, 100, 50, 8150])
  assert.deepEqual(m.actualFundTags(rows, opts, 'x_tra_no', funds).items.map((x) => [x.tag, x.amount]), [['Vay A', 5000]])
  assert.deepEqual(m.actualFundTags(rows, opts, '__un', funds).untagged.amount, 50)
})

test('Ví BM: quỹ mặc định + quỹ thêm; quỹ Trả nợ nhận khoản Trả nợ của Ví BM', async () => {
  const m = await import('./spendPlan.js')
  const funds = m.fundsFrom({ extraFunds: [{ key: 'x_du_phong', name: 'Dự phòng' }] }, m.BM_FUNDS)
  assert.deepEqual(funds.map((f) => f.name), ['Chi phí sống', 'Trả nợ', 'Dự phòng'])
  const pcts = m.resolvePcts({}, funds)
  assert.deepEqual([pcts.sinhhoat, pcts.tranno, pcts.x_du_phong, m.sumPcts(pcts, funds)], [60, 40, 0, 100])
  const rows = [
    { date: '2026-05-01', category: 'Chi phí sống', amount: 300 },
    { date: '2026-05-05', category: 'Trả nợ', amount: 100 },
    { date: '2026-05-06', category: 'Khác', amount: 7 },
  ]
  const a = m.actualByFund(rows, { years: ['2026'] }, funds)
  assert.deepEqual([a.per.sinhhoat, a.per.tranno, a.unassigned, a.total], [300, 100, 7, 407])
  assert.equal(m.fundsFrom({}).length, 6) // ví cá nhân vẫn 6 quỹ mặc định
})
