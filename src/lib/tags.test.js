import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, toggleTag, tagCounts, tagBreakdown } from './tags.js'

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

test('tagBreakdown: số tiền và % theo tag, nhiều tag tính đủ cho từng tag, không tag riêng', () => {
  const rows = [
    { amount: 600, tag: 'ăn ngoài' },
    { amount: 300, tag: 'ăn ngoài, tết' },
    { amount: 100, tag: '' },
  ]
  const r = tagBreakdown(rows)
  assert.equal(r.total, 1000)
  assert.deepEqual(r.items.map((x) => [x.tag, x.amount, x.count, x.pct]), [['ăn ngoài', 900, 2, 0.9], ['tết', 300, 1, 0.3]])
  assert.deepEqual(r.untagged, { amount: 100, count: 1, pct: 0.1 })
  assert.deepEqual(tagBreakdown([]), { total: 0, count: 0, items: [], untagged: { amount: 0, count: 0, pct: 0 } })
})
