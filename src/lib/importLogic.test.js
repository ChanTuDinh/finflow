import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRules, stageRows, detectTransfers, buildWrites, suggestKeyword } from './importLogic.js'

const acc = (name, owner = 'Personal') => ({ name, owner })
const p = (date, desc, amount, ref = '') => ({ date, desc, amount, ref })

test('applyRules: bỏ dấu, từ khóa dài thắng, theo hướng thu/chi và phạm vi', () => {
  const rules = [
    { keyword: 'grab', category: 'Mua sắm', direction: 'out', owner: '' },
    { keyword: 'grab food', category: 'Sức khoẻ', direction: 'out', owner: '' },
    { keyword: 'luong', category: 'Lương', direction: 'in', owner: 'Personal' },
  ]
  assert.equal(applyRules(rules, 'GRAB*TRIP 123', 'out', 'Personal', 'Expense'), 'Mua sắm')
  assert.equal(applyRules(rules, 'Grab Food HCM', 'out', 'Personal', 'Expense'), 'Sức khoẻ')
  assert.equal(applyRules(rules, 'Lương tháng 9', 'in', 'Personal', 'Income'), 'Lương')
  assert.equal(applyRules(rules, 'Lương tháng 9', 'in', 'Business', 'Revenue'), '') // quy tắc của Personal
  assert.equal(applyRules(rules, 'LUONG', 'out', 'Personal', 'Expense'), '') // sai hướng
  assert.equal(applyRules([{ keyword: 'abc', category: 'Không tồn tại' }], 'abc', 'out', 'Personal', 'Expense'), '') // danh mục không hợp lệ
  assert.equal(applyRules([{ keyword: 'grab', category: 'Đi lại' }], 'grab', 'out', 'Personal', 'Expense'), '') // danh mục đã bỏ khỏi form (Ví cá nhân) -> bỏ qua quy tắc
})

test('stageRows: loại và định tuyến theo chủ tài khoản, dấu -> Thu/Chi', () => {
  const rows = stageRows({ parsed: [p('2026-09-01', 'Khách A trả', 5000000), p('2026-09-02', 'Mua văn phòng phẩm', -200000)], account: acc('VCB DN', 'Business') })
  assert.deepEqual(rows.map((r) => [r.kind, r.type, r.amount]), [['business', 'Revenue', 5000000], ['business', 'Expense', 200000]])
})

test('stageRows: import lại cùng file không tạo dòng trùng (theo ref và theo nội dung)', () => {
  const parsed = [p('2026-09-01', 'Cafe', -50000, 'FT1'), p('2026-09-02', 'Cơm trưa', -60000)]
  const first = stageRows({ parsed, account: acc('TCB') })
  const existing = buildWrites(first).personal.map((r) => ({ ...r, _kind: 'personal' }))
  const again = stageRows({ parsed, account: acc('TCB'), existing })
  assert.deepEqual(again.map((r) => r.dupe), [true, true])
  assert.deepEqual(again.map((r) => r.include), [false, false])
  // tài khoản khác thì không coi là trùng
  assert.deepEqual(stageRows({ parsed, account: acc('MB'), existing }).map((r) => r.dupe), [false, false])
})

test('stageRows: 2 giao dịch giống hệt trong cùng file đều được giữ; trừ theo số đã có', () => {
  const parsed = [p('2026-09-01', 'Cafe', -50000), p('2026-09-01', 'Cafe', -50000)]
  assert.deepEqual(stageRows({ parsed, account: acc('TCB') }).map((r) => r.dupe), [false, false])
  const existing = [{ account: 'TCB', date: '2026-09-01', amount: 50000, note: 'Cafe', ref: '', _kind: 'personal' }]
  assert.deepEqual(stageRows({ parsed, account: acc('TCB'), existing }).map((r) => r.dupe), [true, false])
})

test('detectTransfers: ghép cặp giữa 2 tài khoản trong cùng file', () => {
  const a = stageRows({ parsed: [p('2026-09-05', 'Chuyển tiền', -10000000), p('2026-09-06', 'Ăn tối', -300000)], account: acc('VCB') })
  const b = stageRows({ parsed: [p('2026-09-06', 'Nhận tiền', 10000000)], account: acc('TCB') }).map((r) => ({ ...r, key: 'b' + r.key }))
  const { rows, convert } = detectTransfers([...a, ...b])
  assert.deepEqual(rows.map((r) => r.type), ['Transfer', 'Expense', 'Transfer'])
  assert.equal(convert.length, 0)
  assert.equal(rows[0].pair, 'TCB')
})

test('detectTransfers: không ghép cùng tài khoản, lệch quá 2 ngày hoặc khác số tiền', () => {
  const same = stageRows({ parsed: [p('2026-09-05', 'a', -100), p('2026-09-05', 'b', 100)], account: acc('VCB') })
  assert.ok(detectTransfers(same).rows.every((r) => !r.transfer))
  const far = [...stageRows({ parsed: [p('2026-09-01', 'a', -100)], account: acc('A') }), ...stageRows({ parsed: [p('2026-09-09', 'b', 100)], account: acc('B') })]
  assert.ok(detectTransfers(far).rows.every((r) => !r.transfer))
})

test('detectTransfers: ghép với giao dịch đã có trong Sheet (import từng ngân hàng riêng) và cá nhân ↔ doanh nghiệp', () => {
  const existing = [{ id: 'x1', _kind: 'business', account: 'VCB DN', date: '2026-09-05', type: 'Revenue', category: 'Khác', amount: 20000000, note: 'Nhận', ref: '' }]
  const staged = stageRows({ parsed: [p('2026-09-05', 'Chuyển cho công ty', -20000000)], account: acc('TCB CN') })
  const { rows, convert } = detectTransfers(staged, existing)
  assert.equal(rows[0].type, 'Transfer')
  assert.equal(convert.length, 1)
  assert.deepEqual([convert[0].kind, convert[0].row.id, convert[0].row.type], ['business', 'x1', 'Transfer'])
  assert.equal(convert[0].partnerKey, rows[0].key)
  // dòng Transfer vẫn được ghi, nhưng không lọt vào thu/chi (xem period.test)
  assert.equal(buildWrites(rows).personal[0].type, 'Transfer')
})

test('detectTransfers: mỗi dòng chỉ ghép một lần (ưu tiên ngày gần nhất)', () => {
  const a = stageRows({ parsed: [p('2026-09-05', 'x', -100), p('2026-09-06', 'y', -100)], account: acc('A') })
  const b = stageRows({ parsed: [p('2026-09-06', 'z', 100)], account: acc('B') })
  const { rows } = detectTransfers([...a, ...b])
  assert.deepEqual(rows.map((r) => r.transfer), [false, true, true])
})

test('suggestKeyword', () => assert.equal(suggestKeyword('GRAB*TRIP 1234 HCM VN'), 'grab*trip hcm'))

test('tài khoản thuộc BM -> giao dịch vào Ví BM (Income/Expense như cá nhân) và được ghi vào out.bm', () => {
  const rows = stageRows({ parsed: [p('2026-09-01', 'Khách trả', 5e6), p('2026-09-02', 'Chi phí', -2e5)], account: { name: 'MB BM', owner: 'BM' } })
  assert.deepEqual(rows.map((r) => [r.kind, r.type]), [['bm', 'Income'], ['bm', 'Expense']])
  const w = buildWrites(rows)
  assert.deepEqual([w.personal.length, w.business.length, w.bm.length], [0, 0, 2])
  assert.equal(w.bm[0].account, 'MB BM')
})
test('chuyển nội bộ giữa Ví BM và tài khoản cá nhân được ghép cặp', () => {
  const a = stageRows({ parsed: [p('2026-09-05', 'Chuyển sang ví BM', -10e6)], account: acc('VCB') })
  const b = stageRows({ parsed: [p('2026-09-05', 'Nhận từ cá nhân', 10e6)], account: { name: 'MB BM', owner: 'BM' } }).map((r) => ({ ...r, key: 'b' + r.key }))
  assert.deepEqual(detectTransfers([...a, ...b]).rows.map((r) => r.type), ['Transfer', 'Transfer'])
})
