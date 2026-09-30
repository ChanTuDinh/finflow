export const monthKey = (iso) => iso.slice(0, 7)
export const quarterKey = (iso) => `${iso.slice(0, 4)}-Q${Math.ceil(Number(iso.slice(5, 7)) / 3)}`

export function makeMoney(currency = 'VND') {
  const f = new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 })
  return (n) => f.format(n || 0)
}
export const compact = (n) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)
export const pct = (n) => `${(n * 100).toFixed(1)}%`
export const todayIso = () => new Date().toISOString().slice(0, 10)
