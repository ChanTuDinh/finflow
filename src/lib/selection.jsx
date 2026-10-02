import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applySelection, setManySelected, toggleExcluded } from './selection.js'
import { effectiveDebts } from './payments.js'
import { useStore } from './store.jsx'

const KEY = 'finflow:v1:excluded'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} } }

const Ctx = createContext(null)

// Chọn khoản nợ theo từng nguồn (debts, debts_bm); nhớ trong trình duyệt để lần sau mở lại vẫn giữ.
export function SelectionProvider({ children }) {
  const [excluded, setExcluded] = useState(read)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(excluded)) } catch { /* ignore */ } }, [excluded])
  const value = useMemo(() => ({ excluded, setExcluded }), [excluded])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDebtSelection(kind) {
  const { excluded, setExcluded } = useContext(Ctx)
  const ex = excluded[kind] || []
  const update = (fn) => setExcluded((all) => ({ ...all, [kind]: fn(all[kind] || []) }))
  return {
    excluded: ex,
    isSelected: (id) => !ex.includes(id),
    filter: (rows) => applySelection(rows, ex),
    toggle: (id) => update((e) => toggleExcluded(e, id)),
    setMany: (ids, selected) => update((e) => setManySelected(e, ids, selected)),
  }
}

/**
 * Tick/bỏ tick từng lần trả trong Lịch sử trả nợ: lần trả nào bỏ tick thì dư nợ hiển thị như thể chưa có lần trả đó
 * ("dư nợ giả định", chỉ để xem — dữ liệu ghi trong Sheet không đổi). Lưu trong trình duyệt như ô tick khoản nợ.
 * Trả về debts = danh sách khoản nợ đã áp dụng các lần bỏ tick.
 */
export function useCountedPayments(kind) {
  const { excluded, setExcluded } = useContext(Ctx)
  const { data } = useStore()
  const pays = useMemo(() => data.payments.filter((x) => x.source === kind), [data.payments, kind])
  const ex = useMemo(() => (excluded.payments || []).filter((id) => pays.some((x) => x.id === id)), [excluded.payments, pays]) // bỏ id của lần trả đã xoá
  const debts = useMemo(() => effectiveDebts(data[kind], pays, ex), [data, kind, pays, ex])
  const update = (fn) => setExcluded((all) => ({ ...all, payments: fn(all.payments || []) }))
  return {
    excludedIds: ex,
    debts,
    isCounted: (id) => !ex.includes(id),
    toggle: (id) => update((e) => toggleExcluded(e, id)),
    setMany: (ids, counted) => update((e) => setManySelected(e, ids, counted)),
    clear: () => update((e) => e.filter((id) => !pays.some((x) => x.id === id))),
  }
}
