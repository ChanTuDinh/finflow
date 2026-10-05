import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, toggleTag, tagCounts, tagBreakdown, pieSlices } from './tags.js'

test('parseTags: tách theo dấu phẩy, bỏ trống và trùng (không phân biệt hoa thường)', () => {
  assert.deepEqual(parseTags(' du lịch,  Gia đình ,du lịch;, '), ['du lịch', 'Gia đình'])
  assert.deepEqual(parseTags('Du Lịch, du lịch'), ['Du Lịch'])
  assert.deepEqual(parseTags(undefined), [])
})
test('toggleTag: thêm / bỏ', () => {
  assert.equal(toggleTag('a, b', 'c'), 'a, b, c')
  assert.equal(toggleTag('a, b', 'B'), 'a')
  assert.equal(toggleTag('', 'x'), 'x')
})
test('tagCounts: đếm số dòng mỗi tag, nhiều nhất trước', () => {
  const rows = [{ tag: 'ăn ngoài, tết' }, { tag: 'Ăn ngoài' }, { tag: '' }, {}]
  assert.deepEqual(tagCounts(rows), [{ tag: 'ăn ngoài', count: 2 }, { tag: 'tết', count: 1 }])
})

test('tagBreakdown: nhiều tag chia đều tiền, tổng các phần = tổng chi, chưa gắn tag riêng', () => {
  const rows = [
    { amount: 600, tag: 'ăn ngoài' },
    { amount: 300, tag: 'ăn ngoài, tết' },
    { amount: 100, tag: '' },
  ]
  const r = tagBreakdown(rows)
  assert.equal(r.total, 1000)
  assert.deepEqual(r.items.map((x) => [x.tag, x.amount, x.count, x.pct]), [['ăn ngoài', 750, 2, 0.75], ['tết', 150, 1, 0.15]])
  assert.deepEqual(r.untagged, { amount: 100, count: 1, pct: 0.1 })
  assert.equal(r.items.reduce((a, x) => a + x.amount, 0) + r.untagged.amount, r.total)
  assert.deepEqual(tagBreakdown([]), { total: 0, count: 0, items: [], untagged: { amount: 0, count: 0, pct: 0 } })
})

test('pieSlices: gộp tag nhỏ, giữ lát chưa gắn tag', () => {
  const rows = [...'abcdefghij'].map((c, i) => ({ amount: 1000 - i * 10, tag: c })).concat([{ amount: 50, tag: '' }])
  const b = tagBreakdown(rows)
  const sl = pieSlices(b, 7)
  assert.deepEqual(sl.map((x) => x.kind), [...Array(7).fill('tag'), 'rest', 'none'])
  assert.equal(sl[7].name, 'Các tag nhỏ khác (3)')
  assert.deepEqual(sl[7].children.map((x) => x.key), ['h', 'i', 'j']) // tag nhỏ vẫn còn đủ, không bị mất
  assert.equal(sl[7].children.reduce((a, x) => a + x.amount, 0), sl[7].amount)
  assert.ok(Math.abs(sl.reduce((a, x) => a + x.pct, 0) - 1) < 1e-9)
  assert.deepEqual(pieSlices(tagBreakdown([{ amount: 5, tag: 'x' }])).map((x) => x.kind), ['tag'])
})
