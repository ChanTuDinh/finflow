import test from 'node:test'
import assert from 'node:assert/strict'
import { makeBackup, parseBackup, planMigration, countRows, BACKUP_KINDS } from './backup.js'

const sample = () => ({
  personal: [{ id: 'p1', date: '2026-01-01', type: 'Income', category: 'Lương', amount: 100, _row: 2 }],
  debts_bm: [{ id: 'm1', name: 'Vay BM #3', balance: 3e8, apr: 7, repay_type: 'Trả lãi only', record_date: '2025-04-01' }],
  payments: [{ id: 'pay1', date: '2025-04-01', source: 'debts_bm', debt_id: 'm1', amount: 1e9, principal: 1e9, interest: 0, adjust_prev: '{"apr":6.5}' }],
  bm: [], _missing: ['bm'],
})

test('sao lưu rồi khôi phục giữ nguyên dữ liệu, bỏ _row và _missing', () => {
  const b = makeBackup(sample())
  assert.equal(b.app, 'finflow')
  assert.ok(!('_row' in b.data.personal[0]) && !('_missing' in b.data))
  const back = parseBackup(JSON.stringify(b))
  assert.deepEqual(back.debts_bm, sample().debts_bm)
  assert.deepEqual(back.payments[0].adjust_prev, '{"apr":6.5}') // chuỗi JSON lưu trong ô giữ nguyên
  assert.equal(back.personal[0].amount, 100)
  assert.deepEqual(Object.keys(back).sort(), [...BACKUP_KINDS].sort())
})

test('file không phải sao lưu của FinFlow bị từ chối với thông báo rõ ràng', () => {
  assert.throws(() => parseBackup('không phải json'), /Không đọc được file/)
  assert.throws(() => parseBackup('{"a":1}'), /không phải file sao lưu/)
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other', data: {} })), /không phải file sao lưu/)
})

test('file thiếu một số mục (bản cũ) vẫn khôi phục được, mục thiếu là rỗng', () => {
  const back = parseBackup(JSON.stringify({ app: 'finflow', data: { personal: [{ id: 'a', amount: 1 }] } }))
  assert.equal(back.personal.length, 1)
  assert.deepEqual([back.bm, back.payments, back.debts_bm], [[], [], []])
  assert.equal(countRows(back), 1)
})

test('chuyển lên Sheet: chỉ thêm dòng chưa có theo id (bấm lại không trùng)', () => {
  const local = sample()
  const first = planMigration(local, { personal: [], debts_bm: [], payments: [] })
  assert.deepEqual([first.total, Object.keys(first.toAdd).sort()], [3, ['debts_bm', 'payments', 'personal']])
  const again = planMigration(local, { personal: [{ id: 'p1' }], debts_bm: [{ id: 'm1' }], payments: [{ id: 'pay1' }] })
  assert.equal(again.total, 0)
  const partial = planMigration(local, { personal: [{ id: 'p1' }], debts_bm: [], payments: [] })
  assert.deepEqual(Object.keys(partial.toAdd).sort(), ['debts_bm', 'payments'])
})

test('chuyển lên Sheet: thiếu tab cần ghi thì chặn, báo tên tab (không ghi dở)', () => {
  const plan = planMigration(sample(), { personal: [] }, ['debts_bm', 'payments'])
  assert.deepEqual(plan.blocked.sort(), ['Debt_Payments', 'Debts_BM'])
  assert.deepEqual(Object.keys(plan.toAdd), ['personal'])
  // tab thiếu nhưng không có dữ liệu cần ghi thì không bị chặn
  assert.deepEqual(planMigration({ bm: [] }, {}, ['bm']).blocked, [])
})
