import { createContext, useContext, useMemo, useState } from 'react'
import { currentPeriod, fromKey } from './period.js'

const Ctx = createContext(null)
export const usePeriod = () => useContext(Ctx)

export function PeriodProvider({ children }) {
  const [period, setPeriod] = useState(() => currentPeriod())
  // Bấm vào một kỳ con (key như '2026-Q3') để xem chi tiết; bỏ qua nếu là ngày.
  const drill = (key) => { const p = fromKey(key); if (p) setPeriod(p) }
  const value = useMemo(() => ({ period, setPeriod, drill }), [period])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
