// Chọn khoản nợ để tính toán. Lưu danh sách các id BỎ CHỌN (mặc định mọi khoản đều được chọn,
// nên khoản mới thêm vào tự được tính).
export const applySelection = (rows, excluded) => rows.filter((r) => !excluded.includes(r.id))

export const toggleExcluded = (excluded, id) => (excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id])

// Chọn / bỏ chọn nhiều dòng cùng lúc
export function setManySelected(excluded, ids, selected) {
  const rest = excluded.filter((x) => !ids.includes(x))
  return selected ? rest : [...rest, ...ids]
}
