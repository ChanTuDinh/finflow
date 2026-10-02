import test from 'node:test'
import assert from 'node:assert/strict'
import { applySelection, toggleExcluded, setManySelected } from './selection.js'

const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('mặc định chọn hết; khoản mới thêm tự được chọn', () => {
  assert.deepEqual(applySelection(rows, []).map((r) => r.id), ['a', 'b', 'c'])
  assert.deepEqual(applySelection([...rows, { id: 'd' }], ['a']).map((r) => r.id), ['b', 'c', 'd'])
})

test('toggle bật/tắt từng khoản', () => {
  let ex = toggleExcluded([], 'b')
  assert.deepEqual(applySelection(rows, ex).map((r) => r.id), ['a', 'c'])
  ex = toggleExcluded(ex, 'b')
  assert.deepEqual(ex, [])
})

test('chọn/bỏ chọn nhiều dòng, không đụng tới dòng khác', () => {
  let ex = setManySelected(['z'], ['a', 'b'], false)
  assert.deepEqual(ex.sort(), ['a', 'b', 'z'])
  ex = setManySelected(ex, ['a'], true)
  assert.deepEqual(ex.sort(), ['b', 'z'])
  assert.deepEqual(setManySelected(['a', 'b', 'z'], ['a', 'b'], true), ['z'])
})
