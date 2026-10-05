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
  // tính đến hết tháng 3/2026: bỏ tháng 4 và năm 2027
  const ytd = actualByFund(rows, { years: ['2026', '2027'], until: '2026-03' })
  assert.deepEqual([ytd.per.need, ytd.per.want, ytd.unassigned, ytd.total], [600, 100, 0, 700])
})
