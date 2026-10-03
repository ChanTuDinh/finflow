// Nhập giao dịch thu/chi từ file CSV (cột: date,type,category,amount,account,note). Dòng đã có (cùng ngày, loại, danh mục, số tiền, ghi chú) bị bỏ qua.
import { TABS, newId, normalizeDate, parseNumber } from './schema.js'

export const CSV_HEADER = ['date', 'type', 'category', 'amount', 'account', 'note']

// Đọc CSV có ngoặc kép; hỗ trợ dấu phẩy và xuống dòng trong ô, bỏ BOM.
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

const isRealDate = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}
const sig = (r) => [r.date, r.type, r.category, r.amount, (r.note || '').trim()].join('|')

/**
 * Trả { rows, skipped, errors }: rows = dòng hợp lệ chưa có trong `existing` (đã gán id, created_by),
 * skipped = số dòng trùng, errors = thông báo tiếng Việt kèm số dòng trong file.
 */
export function buildCsvRows(kind, text, existing = [], createdBy = 'me') {
  const cfg = TABS[kind]
  const table = parseCsv(text)
  if (!table.length) return { rows: [], skipped: 0, errors: ['File trống'] }
  const head = table[0].map((h) => h.trim().toLowerCase())
  const miss = ['date', 'type', 'category', 'amount'].filter((h) => !head.includes(h))
  if (miss.length) return { rows: [], skipped: 0, errors: [`Thiếu cột: ${miss.join(', ')}. Hàng đầu phải là: ${CSV_HEADER.join(',')}`] }
  const col = (r, name) => (r[head.indexOf(name)] ?? '').trim()
  const seen = new Set(existing.map(sig))
  const rows = [], errors = []
  let skipped = 0
  table.slice(1).forEach((r, i) => {
    const line = i + 2
    const date = normalizeDate(col(r, 'date'))
    const type = col(r, 'type'), category = col(r, 'category')
    const amount = parseNumber(col(r, 'amount'))
    if (!isRealDate(date)) return errors.push(`Dòng ${line}: ngày "${col(r, 'date')}" không hợp lệ (cần yyyy-mm-dd)`)
    if (!cfg.types.includes(type)) return errors.push(`Dòng ${line}: loại "${type}" không hợp lệ (${cfg.types.join(' / ')})`)
    if (!category) return errors.push(`Dòng ${line}: thiếu danh mục`)
    if (!(amount > 0)) return errors.push(`Dòng ${line}: số tiền phải lớn hơn 0`)
    const row = { id: newId(), date, type, category, amount, account: col(r, 'account'), note: col(r, 'note'), created_by: createdBy, ref: '' }
    if (kind === 'business') row.counterparty = ''
    const k = sig(row)
    if (seen.has(k)) return skipped++
    seen.add(k)
    rows.push(row)
  })
  return { rows, skipped, errors }
}
