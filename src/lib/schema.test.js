import test from 'node:test'
import assert from 'node:assert/strict'
import { TABS, rowFromValues, valuesFromRow } from './schema.js'

test('Debts_BM có thêm record_date ở cột cuối; Debts giữ nguyên', () => {
  assert.equal(TABS.debts_bm.columns.at(-1), 'record_date')
  assert.equal(TABS.debts_bm.columns.length, TABS.debts.columns.length + 1)
  assert.ok(!TABS.debts.columns.includes('record_date'))
})

test('record_date: đọc từ serial/chuỗi, Sheet cũ thiếu cột thì để trống', () => {
  const v = ['m1', 'Vay', 'BM', 'Business', 100, 12, 5, 10, 'Active', '', 46296]
  assert.equal(rowFromValues('debts_bm', v).record_date, '2026-10-01')
  assert.equal(rowFromValues('debts_bm', v.slice(0, 10)).record_date, '')
  assert.equal(rowFromValues('debts_bm', [...v.slice(0, 10), '01/10/2026']).record_date, '2026-10-01')
  assert.equal(valuesFromRow('debts_bm', rowFromValues('debts_bm', v)).at(-1), '2026-10-01')
})
