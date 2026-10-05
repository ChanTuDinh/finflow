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
