import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, buildCsvRows } from './csvImport.js'

const csv = 'date,type,category,amount,account,note\n2026-01-31,Income,Lương,"11,110,000",,"Lương, Mon1"\n2026-02-28,Income,Thưởng,12500000,,\n'

test('parseCsv: ngoặc kép, dấu phẩy trong ô, BOM, CRLF', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x,1","y""z"\r\n'), [['a', 'b'], ['x,1', 'y"z']])
})

test('buildCsvRows: đọc dòng hợp lệ, bỏ dòng trùng và báo lỗi theo số dòng', () => {
  const r = buildCsvRows('personal', csv)
  assert.equal(r.rows.length, 2)
  assert.deepEqual([r.rows[0].date, r.rows[0].amount, r.rows[0].note], ['2026-01-31', 11110000, 'Lương, Mon1'])
  const again = buildCsvRows('personal', csv, r.rows)
  assert.equal(again.rows.length, 0)
  assert.equal(again.skipped, 2)
  const bad = buildCsvRows('personal', 'date,type,category,amount\n31/13/2026,Income,Lương,1\n2026-01-01,Foo,Lương,1\n2026-01-01,Income,Lương,0\n')
  assert.equal(bad.rows.length, 0)
  assert.equal(bad.errors.length, 3)
  assert.match(bad.errors[0], /Dòng 2/)
  assert.match(buildCsvRows('personal', 'a,b\n1,2').errors[0], /Thiếu cột/)
})

test('CSV: cột tag tuỳ chọn, chuẩn hoá nhiều tag', () => {
  const csv = 'date,type,category,amount,account,note,tag\n2026-05-01,Expense,Need,100000,VCB,ăn trưa,"ăn ngoài, Tết, ăn ngoài"\n2026-05-02,Expense,Want,50000,VCB,cafe,\n'
  const { rows, errors } = buildCsvRows('personal', csv, [], 'me')
  assert.deepEqual(errors, [])
  assert.deepEqual(rows.map((r) => r.tag), ['ăn ngoài, Tết', ''])
  // file cũ không có cột tag vẫn nhập được
  const old = buildCsvRows('personal', 'date,type,category,amount\n2026-05-03,Expense,Need,1000\n', [], 'me')
  assert.equal(old.rows.length, 1)
  assert.equal(old.rows[0].tag, '')
})
