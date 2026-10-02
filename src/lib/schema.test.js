import test from 'node:test'
import assert from 'node:assert/strict'
import { TABS, rowFromValues, valuesFromRow } from './schema.js'

test('Debts_BM có thêm record_date ở cột cuối; Debts giữ nguyên', () => {
  assert.equal(TABS.debts_bm.columns[10], 'record_date')
  assert.equal(TABS.debts_bm.columns.length, TABS.debts.columns.length + 1)
  assert.ok(!TABS.debts.columns.includes('record_date'))
})

test('record_date: đọc từ serial/chuỗi, Sheet cũ thiếu cột thì để trống', () => {
  const v = ['m1', 'Vay', 'BM', 'Business', 100, 12, 5, 10, 'Active', '', 46296]
  assert.equal(rowFromValues('debts_bm', v).record_date, '2026-10-01')
  assert.equal(rowFromValues('debts_bm', v.slice(0, 10)).record_date, '')
  assert.equal(rowFromValues('debts_bm', [...v.slice(0, 10), '01/10/2026']).record_date, '2026-10-01')
  assert.equal(valuesFromRow('debts_bm', rowFromValues('debts_bm', v))[10], '2026-10-01')
})

import { debtScopeOptions, SCOPE_OWNER, cashRowsForScope } from './schema.js'
test('Nợ BM có chủ khoản nợ BM và bộ lọc phạm vi BM; nợ chính không có', () => {
  assert.deepEqual(TABS.debts_bm.owners, ['Personal', 'Business', 'BM'])
  assert.deepEqual(TABS.debts.owners, ['Personal', 'Business'])
  assert.ok(debtScopeOptions('debts_bm').some((o) => o.value === 'bm'))
  assert.ok(!debtScopeOptions('debts').some((o) => o.value === 'bm'))
  assert.equal(SCOPE_OWNER.bm, 'BM')
  const d = { personal: [1], business: [2] }
  assert.deepEqual(cashRowsForScope(d, 'bm'), [1, 2]) // BM không có dòng tiền riêng: dùng cả hai
  assert.deepEqual(cashRowsForScope(d, 'business'), [2])
})
