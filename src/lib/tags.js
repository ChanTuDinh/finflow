// Tag của giao dịch: nhiều tag trong một ô, ngăn cách bằng dấu phẩy (vd. "du lịch, gia đình"). Dùng để phân loại / làm biểu đồ sau này.
export const parseTags = (s) => {
  const seen = new Set(), out = []
  for (const t of String(s ?? '').split(/[,;\n]/)) {
    const tag = t.trim().replace(/\s+/g, ' ')
    const k = tag.toLowerCase()
    if (tag && !seen.has(k)) { seen.add(k); out.push(tag) }
  }
  return out
}
export const joinTags = (tags) => tags.join(', ')
/** Bật/tắt một tag trong chuỗi tag hiện có (không phân biệt hoa thường). */
export const toggleTag = (s, tag) => {
  const cur = parseTags(s), k = tag.toLowerCase()
  return joinTags(cur.some((t) => t.toLowerCase() === k) ? cur.filter((t) => t.toLowerCase() !== k) : [...cur, tag])
}
/** Mọi tag đang dùng trong các dòng, kèm số dòng, nhiều nhất trước: [{ tag, count }]. */
export function tagCounts(rows) {
  const m = new Map()
  for (const r of rows) for (const t of parseTags(r.tag)) { const k = t.toLowerCase(); m.set(k, { tag: m.get(k)?.tag ?? t, count: (m.get(k)?.count ?? 0) + 1 }) }
  return [...m.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Phân tích chi theo tag: rows = các dòng chi. Dòng nhiều tag được CHIA ĐỀU số tiền cho các tag của nó (để tổng các phần = tổng chi, vẽ biểu đồ tròn đúng 100%);
 * dòng không có tag vào mục "untagged". pct = tỷ lệ so với tổng chi; count = số dòng có tag đó.
 * Trả { total, count, items: [{ tag, amount, count, pct }], untagged }.
 */
export function tagBreakdown(rows) {
  const m = new Map()
  const untagged = { amount: 0, count: 0, pct: 0 }
  let total = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    total += amt
    const tags = parseTags(r.tag)
    if (!tags.length) { untagged.amount += amt; untagged.count++; continue }
    for (const t of tags) {
      const k = t.toLowerCase(), e = m.get(k) || { tag: t, amount: 0, count: 0 }
      e.amount += amt / tags.length; e.count++
      m.set(k, e)
    }
  }
  const pct = (a) => (total > 0 ? a / total : 0)
  untagged.pct = pct(untagged.amount)
  const items = [...m.values()].map((e) => ({ ...e, amount: Math.round(e.amount), pct: pct(e.amount) })).sort((a, b) => b.amount - a.amount || a.tag.localeCompare(b.tag))
  return { total, count: rows.length, items, untagged }
}

/**
 * Các lát cho biểu đồ tròn: tối đa maxTags tag lớn nhất, phần còn lại gộp thành một lát "rest", dòng chưa gắn tag là lát "none" (nếu có).
 * Trả [{ key, kind: 'tag' | 'rest' | 'none', name, amount, pct, count }].
 */
export function pieSlices(b, maxTags = 7) {
  const head = b.items.slice(0, maxTags)
  const tail = b.items.slice(maxTags)
  const out = head.map((x) => ({ key: x.tag, kind: 'tag', name: x.tag, amount: x.amount, pct: x.pct, count: x.count }))
  if (tail.length) out.push({ key: '__rest', kind: 'rest', name: `Các tag nhỏ khác (${tail.length})`, amount: tail.reduce((a, x) => a + x.amount, 0), pct: tail.reduce((a, x) => a + x.pct, 0), count: tail.reduce((a, x) => a + x.count, 0) })
  if (b.untagged.count) out.push({ key: '__none', kind: 'none', name: 'Chưa gắn tag', amount: b.untagged.amount, pct: b.untagged.pct, count: b.untagged.count })
  return out
}
