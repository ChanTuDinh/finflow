import test from 'node:test'
import assert from 'node:assert/strict'
import { yearsOf, forYear, tagSlices, analyze, categoriesForTags } from './bmAnalysis.js'

const rows = [
  { date: '2026-03-01', type: 'Income', category: 'Quỹ BM', amount: 600, tag: 'Lương BM' },
  { date: '2026-04-01', type: 'Income', category: 'Chuyển ví', amount: 400, tag: '' },
  { date: '2026-05-01', type: 'Expense', category: 'Chi phí sống', amount: 300, tag: 'Ăn uống, Điện nước' },
  { date: '2026-05-02', type: 'Expense', category: 'Trả nợ', amount: 100, tag: 'Ăn uống' },
  { date: '2026-06-01', type: 'Transfer', category: 'Chuyển nội bộ', amount: 999 },
  { date: '2025-12-31', type: 'Income', category: 'Quỹ BM', amount: 50 },
  { type: 'Expense', category: 'Không ngày', amount: 7 },
]

test('yearsOf: mới nhất trước; forYear lọc năm và bỏ chuyển nội bộ / dòng không ngày', () => {
  assert.deepEqual(yearsOf(rows), ['2026', '2025'])
  assert.equal(forYear(rows, '2026').length, 4)
  assert.equal(forYear(rows, 'all').length, 5)
})

test('analyze: thu, chi, ròng và % theo TAG (nhiều tag chia đều, chưa gắn tag riêng)', () => {
  const a = analyze(rows, '2026')
  assert.equal(a.income.total, 1000)
  assert.equal(a.expense.total, 400)
  assert.equal(a.net, 600)
  assert.deepEqual(a.income.slices.map((s) => [s.name, s.kind, s.amount, s.pct]), [['Lương BM', 'tag', 600, 0.6], ['Chưa gắn tag', 'none', 400, 0.4]])
  assert.deepEqual(a.expense.slices.map((s) => [s.name, s.amount, s.pct]), [['Ăn uống', 250, 0.625], ['Điện nước', 150, 0.375]])
  assert.equal(analyze(rows, 'all').income.total, 1050)
})

test('tagSlices: gộp tag nhỏ, giữ danh sách con, tổng % = 1', () => {
  const rs = [...'abcdefghij'].map((c, i) => ({ tag: c, amount: 100 - i })).concat([{ tag: '', amount: 20 }])
  const r = tagSlices(rs, 7)
  assert.deepEqual(r.slices.map((s) => s.kind), [...Array(7).fill('tag'), 'rest', 'none'])
  assert.deepEqual(r.slices[7].children.map((x) => x.name), ['h', 'i', 'j'])
  assert.ok(Math.abs(r.slices.reduce((a, s) => a + s.pct, 0) - 1) < 1e-9)
  assert.deepEqual(tagSlices([], 7), { total: 0, count: 0, slices: [] })
})

test('categoriesForTags: phân theo danh mục, chỉ tính phần thuộc tag đã chọn, tag không phân biệt hoa thường', () => {
  const rs = [
    { id: 'a', category: 'Quỹ BM', amount: 600, tag: 'Ba Hoà' },
    { id: 'b', category: 'Chuyển ví', amount: 400, tag: 'ba hoà, Quỹ chung' },
    { id: 'c', category: 'Quỹ BM', amount: 100, tag: '' },
  ]
  const one = categoriesForTags(rs, ['Ba Hoà'])
  assert.equal(one.total, 800) // 600 + 200 (một nửa của 400)
  assert.deepEqual(one.items.map((x) => [x.category, x.amount, x.pct]), [['Quỹ BM', 600, 0.75], ['Chuyển ví', 200, 0.25]])
  assert.equal(one.count, 2)
  const two = categoriesForTags(rs, ['Ba Hoà', 'Quỹ chung'])
  assert.equal(two.total, 1000)
  assert.equal(two.count, 2)
  const none = categoriesForTags(rs, ['__none'])
  assert.deepEqual([none.total, none.items[0].category], [100, 'Quỹ BM'])
  assert.deepEqual(categoriesForTags(rs, []), { total: 0, count: 0, items: [] })
})
