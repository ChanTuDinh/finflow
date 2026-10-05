import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, toggleTag, tagCounts } from './tags.js'

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
