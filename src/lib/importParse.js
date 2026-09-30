// Đọc và chuẩn hóa sao kê ngân hàng -> [{ date, desc, amount (có dấu: âm = chi), ref }]. Logic thuần.

export const fold = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()

// ---------- CSV ----------
export function parseCsv(text) {
  const t = text.replace(/^﻿/, '')
  const head = t.split(/\r?\n/).slice(0, 10).join('\n')
  const count = (c) => head.split(c).length - 1
  const delim = [',', ';', '\t'].map((c) => [c, count(c)]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

// ---------- Số tiền ----------
// Nhận: 1.234.567 | 1,234,567.89 | 1.234,56 | -500.000 | (500,000) | "1 234 567 VND" | 12345 (number)
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v == null) return null
  let s = String(v).trim()
  if (!/\d/.test(s)) return null
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s)
  s = s.replace(/[^\d.,]/g, '')
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',')
  if (lastDot > -1 && lastComma > -1) {
    const dec = lastDot > lastComma ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    s = s.split(thou).join('').replace(dec, '.')
  } else if (lastDot > -1 || lastComma > -1) {
    const sep = lastDot > -1 ? '.' : ','
    const parts = s.split(sep)
    // nhiều dấu, hoặc nhóm cuối đúng 3 chữ số -> dấu phân cách hàng nghìn (VND không có phần thập phân)
    s = parts.length > 2 || parts.at(-1).length === 3 ? parts.join('') : `${parts[0]}.${parts[1]}`
  }
  const n = Number(s)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

// ---------- Ngày ----------
export function parseDate(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : ''
  const s = String(v).trim()
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return valid(m[1], m[2], m[3])
  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/) // dd/mm/yyyy [hh:mm:ss]
  if (m) return valid(m[3], m[2], m[1])
  return ''
}
function valid(y, mo, d) {
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  return dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(mo) - 1 && dt.getUTCDate() === Number(d)
    ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''
}

// ---------- Tự nhận diện cột ----------
const HEADER_WORDS = {
  date: [/^ngay giao dich$/, /^ngay gd$/, /^ngay hach toan$/, /^transaction date$/, /^ngay$/, /^date$/, /ngay giao dich/, /^ngay/, /date/],
  desc: [/noi dung/, /dien giai/, /mo ta/, /description/, /details?$/, /narrative/, /chi tiet/],
  debit: [/ghi no/, /so tien rut/, /rut ra/, /tien ra/, /debit/, /withdraw/, /so tien chi/, /^chi$/],
  credit: [/ghi co/, /so tien gui/, /gui vao/, /tien vao/, /credit/, /deposit/, /so tien thu/, /^thu$/],
  amount: [/^so tien/, /amount/, /gia tri/],
  ref: [/so tham chieu/, /ma giao dich/, /ma gd/, /so but toan/, /so chung tu/, /reference/, /^ref/, /trace/],
}

export function autoMapping(headerCells) {
  const cells = headerCells.map(fold)
  const used = new Set()
  const find = (key) => {
    for (const re of HEADER_WORDS[key]) {
      const i = cells.findIndex((c, idx) => !used.has(idx) && c && re.test(c))
      if (i > -1) { used.add(i); return i }
    }
    return -1
  }
  // thứ tự quan trọng: debit/credit trước 'amount' (vì "số tiền ghi nợ" chứa "số tiền")
  const debit = find('debit'), credit = find('credit')
  return { date: find('date'), desc: find('desc'), debit, credit, amount: debit > -1 || credit > -1 ? -1 : find('amount'), ref: find('ref') }
}

// Dòng tiêu đề = dòng đầu tiên có cột ngày + ít nhất 1 cột mô tả/tiền
export function findHeaderRow(table, scan = 40) {
  for (let i = 0; i < Math.min(table.length, scan); i++) {
    const m = autoMapping(table[i].map((c) => c ?? ''))
    if (m.date > -1 && (m.desc > -1 || m.debit > -1 || m.credit > -1 || m.amount > -1)) return i
  }
  return 0
}

export function detectPreset(table) {
  const headerRow = findHeaderRow(table)
  return { headerRow, ...autoMapping((table[headerRow] || []).map((c) => c ?? '')) }
}

// ---------- Trích giao dịch ----------
export function extractRows(table, mapping) {
  const out = []
  for (let i = (mapping.headerRow ?? 0) + 1; i < table.length; i++) {
    const r = table[i]
    const date = parseDate(r[mapping.date])
    if (!date) continue // dòng tổng kết, dòng trống, chú thích cuối file
    let amount = null
    const debit = mapping.debit > -1 ? parseAmount(r[mapping.debit]) : null
    const credit = mapping.credit > -1 ? parseAmount(r[mapping.credit]) : null
    if (debit || credit) amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0)
    else if (mapping.amount > -1) amount = parseAmount(r[mapping.amount])
    if (!amount) continue
    out.push({
      date,
      desc: mapping.desc > -1 ? String(r[mapping.desc] ?? '').replace(/\s+/g, ' ').trim() : '',
      amount,
      ref: mapping.ref > -1 && r[mapping.ref] != null ? String(r[mapping.ref]).trim() : '',
    })
  }
  return out
}
