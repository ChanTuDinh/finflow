import { cardBadge } from '../lib/schema.js'

// Huy hiệu thẻ ngân hàng: ô màu + 2-3 chữ viết tắt
export default function BankBadge({ account, text, color, size = 'md' }) {
  const b = account ? cardBadge(account) : { text, color }
  const dim = size === 'lg' ? 'h-10 w-14 text-sm' : 'h-7 w-10 text-xs'
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold tracking-wide text-white ${dim}`} style={{ background: b.color }}>{b.text}</span>
}
