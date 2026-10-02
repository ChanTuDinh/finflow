import { createContext, useContext, useMemo, useState } from 'react'
import { ALL, fromKey, resolveGrain } from './period.js'

const Ctx = createContext(null)
export const usePeriod = () => useContext(Ctx)

export function PeriodProvider({ children }) {
  const [period, setPeriod] = useState(ALL) // mặc định xem tất cả các năm
  const [chosenGrain, setGrain] = useState(null) // null = tự chọn cấp con liền kề
  const grain = resolveGrain(period, chosenGrain)
  // Bấm vào một kỳ con (key như '2026-Q3') để xem chi tiết; bỏ qua nếu là ngày.
  const drill = (key) => { const p = fromKey(key); if (p) setPeriod(p) }
  const value = useMemo(() => ({ period, setPeriod, grain, setGrain, drill }), [period, grain])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
