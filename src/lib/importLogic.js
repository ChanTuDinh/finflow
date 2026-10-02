// Từ dòng sao kê chuẩn hóa -> giao dịch chờ duyệt: phân loại theo quy tắc, loại trùng, phát hiện chuyển nội bộ.
import { TABS, TRANSFER_CATEGORY, isInflow, isTransfer, newId } from './schema.js'
import { fold } from './importParse.js'

const kindOf = (owner) => (owner === 'Business' ? 'business' : owner === 'BM' ? 'bm' : 'personal')
const dayDiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)

/** Quy tắc khớp từ khóa (bỏ dấu, không phân biệt hoa thường); từ khóa dài nhất thắng. Trả '' nếu không khớp. */
export function applyRules(rules, desc, dir, owner, type) {
  const text = fold(desc)
  const valid = TABS[kindOf(owner)].categories[type] || []
  let best = null
  for (const r of rules) {
    const kw = fold(r.keyword)
    if (!kw || (r.direction && r.direction !== 'any' && r.direction !== dir)) continue
    if (r.owner && r.owner !== owner) continue
    if (!valid.includes(r.category) || !text.includes(kw)) continue
    if (!best || kw.length > fold(best.keyword).length) best = r
  }
  return best ? best.category : ''
}

// Khóa loại trùng: mã giao dịch của ngân hàng nếu có, không thì ngày + số tiền + nội dung
const refKey = (account, ref) => (account && ref ? `ref|${account}|${ref}` : null)
const fuzzyKey = (account, date, amount, note) => `fz|${account}|${date}|${Math.round(amount)}|${fold(note).slice(0, 60)}`

/**
 * parsed: [{date, desc, amount, ref}] ; account: {name, owner} ; existing: [{...row, _kind}]
 * Dòng trùng với dữ liệu đã có sẽ có dupe=true và include=false. Hai dòng giống hệt trong CÙNG file vẫn giữ
 * (vd. 2 lần cà phê cùng giá); chỉ trừ theo số lượng đã có sẵn trong Sheet.
 */
export function stageRows({ parsed, account, rules = [], existing = [] }) {
  const kind = kindOf(account.owner)
  const refs = new Set(), fuzzy = new Map()
  for (const r of existing) {
    const acc = r.account || ''
    const rk = refKey(acc, r.ref)
    if (rk) refs.add(rk)
    const fk = fuzzyKey(acc, r.date, r.amount, r.note)
    fuzzy.set(fk, (fuzzy.get(fk) || 0) + 1)
  }
  return parsed.map((p, i) => {
    const dir = p.amount > 0 ? 'in' : 'out'
    const type = dir === 'in' ? (kind === 'business' ? 'Revenue' : 'Income') : 'Expense'
    const amount = Math.abs(p.amount)
    const note = p.desc.slice(0, 200)
    let dupe = false
    const rk = refKey(account.name, p.ref)
    if (rk && refs.has(rk)) dupe = true
    else {
      const fk = fuzzyKey(account.name, p.date, amount, note)
      if ((fuzzy.get(fk) || 0) > 0) { dupe = true; fuzzy.set(fk, fuzzy.get(fk) - 1) }
    }
    const category = applyRules(rules, p.desc, dir, account.owner, type)
    return { key: `${i}`, include: !dupe, dupe, kind, date: p.date, type, category: category || 'Khác', auto: !!category, amount, note, account: account.name, ref: p.ref, transfer: false, pair: null }
  })
}

const inflowType = (t) => t === 'Income' || t === 'Revenue'

/**
 * Ghép cặp chuyển nội bộ: 1 dòng chi và 1 dòng thu cùng số tiền, khác tài khoản, lệch tối đa maxDays ngày.
 * Ghép trong file đang nhập và với giao dịch ĐÃ CÓ trong Sheet (import từng ngân hàng riêng vẫn bắt được).
 * Trả { rows, convert }: convert = các dòng đã có cần đổi thành Transfer.
 */
export function detectTransfers(staged, existing = [], maxDays = 2) {
  const rows = staged.map((r) => ({ ...r }))
  const pool = [
    ...rows.map((r, i) => ({ src: 'staged', i, r, inflow: inflowType(r.type), account: r.account })),
    ...existing.filter((r) => !isTransfer(r) && r.account).map((r) => ({ src: 'existing', r, inflow: isInflow(r), account: r.account })),
  ].filter((c) => c.src === 'existing' || (rows[c.i].include && !rows[c.i].dupe))
  const convert = []
  // Mọi cặp (chi, thu) hợp lệ, ít nhất một bên là dòng đang nhập; ghép tham lam theo độ lệch ngày nhỏ nhất.
  const outs = pool.filter((c) => !c.inflow), ins = pool.filter((c) => c.inflow)
  const edges = []
  for (const o of outs) for (const i of ins) {
    if (o.account === i.account || (o.src === 'existing' && i.src === 'existing')) continue
    if (Math.round(o.r.amount) !== Math.round(i.r.amount)) continue
    const d = dayDiff(o.r.date, i.r.date)
    if (d <= maxDays) edges.push({ o, i, d })
  }
  edges.sort((x, y) => x.d - y.d)
  const used = new Set()
  for (const { o, i } of edges) {
    if (used.has(o) || used.has(i)) continue
    used.add(o); used.add(i)
    for (const [x, other] of [[o, i], [i, o]]) {
      if (x.src === 'staged') Object.assign(rows[x.i], { type: 'Transfer', category: TRANSFER_CATEGORY, transfer: true, pair: other.account })
      else convert.push({ kind: x.r._kind, row: { ...x.r, type: 'Transfer', category: TRANSFER_CATEGORY }, partnerKey: rows[other.i].key })
    }
  }
  return { rows, convert }
}

/** Dòng đã duyệt -> bản ghi để ghi vào Sheet (tab Personal/Business). */
export function buildWrites(rows, createdBy = 'import') {
  const out = { personal: [], business: [], bm: [] }
  for (const r of rows.filter((x) => x.include)) {
    const base = { id: newId(), date: r.date, type: r.type, category: r.category, amount: r.amount, note: r.note, created_by: createdBy, ref: r.ref }
    if (r.kind === 'business') out.business.push({ ...base, counterparty: '', account: r.account })
    else if (r.kind === 'bm') out.bm.push({ ...base, account: r.account })
    else out.personal.push({ ...base, account: r.account })
  }
  return out
}

// Gợi ý từ khóa cho quy tắc từ một mô tả giao dịch: 2 từ đầu có nghĩa, bỏ số và từ ngắn.
export function suggestKeyword(desc) {
  return fold(desc).split(' ').filter((w) => w.length > 2 && !/\d/.test(w)).slice(0, 2).join(' ')
}
