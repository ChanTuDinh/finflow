import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applySelection, setManySelected, toggleExcluded } from './selection.js'

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
