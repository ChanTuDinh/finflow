import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseAmount, parseDate, autoMapping, detectPreset, extractRows, fold } from './importParse.js'

test('parseAmount: các định dạng số', () => {
  const cases = [['1.234.567', 1234567], ['1,234,567', 1234567], ['1,234,567.89', 1234567.89], ['1.234.567,89', 1234567.89],
    ['-500.000', -500000], ['(500,000)', -500000], ['500.000-', -500000], ['1 234 567 VND', 1234567], ['2.500.000 ₫', 2500000],
    ['12,5', 12.5], ['0', 0], [42, 42]]
  for (const [i, o] of cases) assert.equal(parseAmount(i), o, String(i))
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('abc'), null)
})

test('parseDate: dd/mm/yyyy, có giờ, ISO, serial, Date', () => {
  assert.equal(parseDate('05/09/2026'), '2026-09-05')
  assert.equal(parseDate('5-9-2026 14:30:05'), '2026-09-05')
  assert.equal(parseDate('2026-09-05T10:00'), '2026-09-05')
  assert.equal(parseDate(46270), '2026-09-05')
  assert.equal(parseDate(new Date('2026-09-05T00:00:00Z')), '2026-09-05')
  assert.equal(parseDate('31/02/2026'), '')
  assert.equal(parseDate('Tổng cộng'), '')
})

test('parseCsv: dấu nháy, dấu phẩy trong ô, dấu ; và BOM', () => {
  const a = parseCsv('﻿Ngày,Nội dung,Số tiền\r\n01/09/2026,"Cafe, Highlands ""A""",-50.000\r\n')
  assert.deepEqual(a[1], ['01/09/2026', 'Cafe, Highlands "A"', '-50.000'])
  const b = parseCsv('a;b;c\n1;2;3\n')
  assert.deepEqual(b, [['a', 'b', 'c'], ['1', '2', '3']])
})

test('autoMapping nhận tiêu đề tiếng Việt, số tiền ghi nợ không bị nhầm thành amount', () => {
  const m = autoMapping(['Ngày giao dịch', 'Số tham chiếu', 'Diễn giải', 'Số tiền ghi nợ', 'Số tiền ghi có', 'Số dư'])
  assert.deepEqual(m, { date: 0, desc: 2, debit: 3, credit: 4, amount: -1, ref: 1 })
  const n = autoMapping(['Date', 'Description', 'Amount', 'Balance'])
  assert.deepEqual(n, { date: 0, desc: 1, debit: -1, credit: -1, amount: 2, ref: -1 })
})

test('extractRows: bỏ phần đầu/cuối file, ghi nợ/ghi có -> dấu', () => {
  const table = [
    ['SAO KÊ TÀI KHOẢN'], ['Khách hàng: ...'],
    ['Ngày giao dịch', 'Diễn giải', 'Ghi nợ', 'Ghi có', 'Số dư', 'Mã GD'],
    ['05/09/2026', 'GRAB*TRIP', '85.000', '', '1.000.000', 'FT001'],
    ['06/09/2026', 'LUONG T9', '', '40.000.000', '41.000.000', 'FT002'],
    ['', 'Tổng cộng', '85.000', '40.000.000', '', ''],
  ]
  const preset = detectPreset(table)
  assert.equal(preset.headerRow, 2)
  const rows = extractRows(table, preset)
  assert.deepEqual(rows, [
    { date: '2026-09-05', desc: 'GRAB*TRIP', amount: -85000, ref: 'FT001' },
    { date: '2026-09-06', desc: 'LUONG T9', amount: 40000000, ref: 'FT002' },
  ])
})

test('extractRows: một cột số tiền có dấu', () => {
  const table = [['Date', 'Description', 'Amount'], ['2026-09-01', 'Coffee', '-4.5'], ['2026-09-02', 'Refund', '10']]
  assert.deepEqual(extractRows(table, detectPreset(table)).map((r) => r.amount), [-4.5, 10])
})

test('fold bỏ dấu tiếng Việt', () => assert.equal(fold('  Chuyển  KHOẢN Đến '), 'chuyen khoan den'))
