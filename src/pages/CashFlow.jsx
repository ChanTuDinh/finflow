import { useRef, useState } from 'react'
import { useDebtSelection } from '../lib/selection.jsx'
import { useStore } from '../lib/store.jsx'
import { isInflow, isTransfer, TABS, WALLET_MOVE_CATEGORY, BM_FUND_CATEGORY, isDebtPayment } from '../lib/schema.js'
import { totals } from '../lib/calc.js'
import { usePeriod } from '../lib/period.jsx'
import { inPeriod, spanMonths, spanRange, monthLabelShort } from '../lib/period.js'
import { Stat, SelectField, FilterRow } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'
import FilterBar from '../components/FilterBar.jsx'
import BankBadge from '../components/BankBadge.jsx'
import SpendPlan from '../components/SpendPlan.jsx'
import TagAnalysis from '../components/TagAnalysis.jsx'
import { parseTags, tagCounts } from '../lib/tags.js'
import { buildCsvRows, CSV_HEADER } from '../lib/csvImport.js'

export default function CashFlow({ kind, onImport }) {
  const { data, money, remove, removeMany, importBatch, settings } = useStore()
  const cardOwner = { personal: 'Personal', business: 'Business', bm: 'BM' }[kind]
  const cards = data.accounts.filter((a) => a.owner === cardOwner && a.status !== 'Closed')
  const [editingCard, setEditingCard] = useState(null) // null | {} (mới) | account
  const [cardsOpen, setCardsOpen] = useState(false) // dropdown Thẻ ngân hàng, mặc định đóng
  const rows = data[kind]
  const { period } = usePeriod()
  const csvRef = useRef(null)
  const onCsv = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng file
    if (!file) return
    const { rows: fresh, skipped, errors } = buildCsvRows(kind, await file.text(), rows, settings.user || 'me')
    if (errors.length) return alert(`Không nhập được — file có lỗi (chưa ghi gì):\n\n${errors.slice(0, 8).join('\n')}${errors.length > 8 ? `\n… và ${errors.length - 8} lỗi khác` : ''}`)
    if (!fresh.length) return alert(`Không có dòng mới${skipped ? ` (${skipped} dòng đã có sẵn)` : ''}.`)
    const total = fresh.reduce((a, x) => a + x.amount, 0)
    if (confirm(`Nhập ${fresh.length} giao dịch (tổng ${money(total)}) vào ${TABS[kind].tab}?${skipped ? `\nBỏ qua ${skipped} dòng đã có sẵn.` : ''}`)) await importBatch({ [kind]: fresh })
  }
  const [editing, setEditing] = useState(null) // null | {} (mới) | row
  const [logOpen, setLogOpen] = useState(false) // dropdown "Ghi chép" (bộ lọc + các bảng giao dịch), mặc định đóng
  const [openMonths, setOpenMonths] = useState({}) // `${bảng}:${yyyy-mm}` -> mở/đóng; chưa chọn thì chỉ mở tháng mới nhất
  // Ô tick = dòng được tính vào các thẻ tổng. Mặc định tick hết; bỏ tick (dòng / tháng / năm / bảng) thì thẻ tổng tính lại.
  // Lưu id các dòng BỎ tick trong trình duyệt (cùng cơ chế với ô tick khoản nợ), dòng mới thêm tự được tick.
  const pick = useDebtSelection(kind)
  const periodRows = rows.filter((r) => inPeriod(period, r.date)).sort((a, b) => b.date.localeCompare(a.date))
  const counted = periodRows.filter((r) => pick.isSelected(r.id))
  const unticked = periodRows.filter((r) => !pick.isSelected(r.id))
  // Bộ lọc Loại / Danh mục / Tag chỉ lọc các bảng giao dịch bên dưới (thẻ tổng vẫn theo kỳ + ô tick). '' = tất cả; NO_TAG = chưa gắn tag
  const NO_TAG = '__none'
  const [fCat, setFCat] = useState('')
  const [fType, setFType] = useState('')
  const [fTag, setFTag] = useState('')
  // Lọc theo thứ tự Loại → Danh mục → Tag: danh sách Danh mục chỉ gồm loại đang chọn, danh sách Tag chỉ gồm loại + danh mục đang chọn
  const hasTag = (r, tag) => parseTags(r.tag).some((x) => x.toLowerCase() === tag.toLowerCase())
  // Loại hiển thị: khoản trả nợ lưu là Expense + danh mục trả nợ (để forecast nhận ra) nhưng hiện / lọc là "Trả nợ", như Loại trong form
  const rowType = (r) => (isTransfer(r) ? 'Chuyển nội bộ' : !isInflow(r) && isDebtPayment(r.category) ? 'Trả nợ' : r.type)
  const typeOpts = [...new Set(periodRows.map(rowType).filter(Boolean))]
  const vType = typeOpts.includes(fType) ? fType : '' // lựa chọn không còn tồn tại (đổi kỳ / xoá dòng) -> về Tất cả
  const byType = vType ? periodRows.filter((r) => rowType(r) === vType) : periodRows
  const catOpts = [...new Set(byType.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const vCat = catOpts.includes(fCat) ? fCat : ''
  const byCat = vCat ? byType.filter((r) => r.category === vCat) : byType
  const tagOpts = tagCounts(byCat)
  const hasUntagged = byCat.some((r) => !parseTags(r.tag).length)
  const vTag = fTag === NO_TAG ? (hasUntagged ? NO_TAG : '') : tagOpts.some((x) => x.tag === fTag) ? fTag : ''
  const filtered = !!(vCat || vType || vTag)
  const shown = vTag ? byCat.filter((r) => (vTag === NO_TAG ? !parseTags(r.tag).length : hasTag(r, vTag))) : byCat
  // Trả nợ tách riêng khỏi Chi: thẻ Chi không gồm khoản trả nợ, thẻ Trả nợ có riêng; Dòng tiền ròng = Thu − Chi − Trả nợ (tiền thật ra / vào)
  const isDebt = (r) => !isInflow(r) && !isTransfer(r) && isDebtPayment(r.category)
  const debtCounted = counted.filter(isDebt)
  const debtTotal = debtCounted.reduce((a, r) => a + r.amount, 0)
  // Ví cá nhân: thẻ Trả nợ tách thành Trả nợ BM / Trả nợ cá nhân (+ "chưa phân loại" nếu còn dòng "Trả nợ" cũ); ví khác giữ một thẻ Trả nợ
  const sumOf2 = (rs) => rs.reduce((a, r) => a + r.amount, 0)
  const debtBmC = debtCounted.filter((r) => r.category === 'Trả nợ BM')
  const debtCnC = debtCounted.filter((r) => r.category === 'Trả nợ cá nhân')
  const debtOldC = debtCounted.filter((r) => r.category !== 'Trả nợ BM' && r.category !== 'Trả nợ cá nhân')
  const t0 = totals(counted.filter((r) => !isDebt(r)))
  const t = { ...t0, net: t0.income - t0.expense - debtTotal }
  const delUnticked = async () => { if (confirm(`Xoá ${unticked.length} giao dịch đang bỏ tick?\n\nKhông thể hoàn tác.`)) await removeMany(kind, unticked) }
  // Thẻ tổng có nền màu theo tab: Ví cá nhân xanh ngọc, Ví BM (ba mẹ) tím
  const tint = { personal: 'teal', bm: 'violet' }[kind] || ''
  const statCls = { teal: '!bg-teal-300 !border-teal-500', violet: '!bg-violet-300 !border-violet-500' }[tint] || ''
  const nMonths = spanMonths(counted)
  const range = spanRange(counted)
  const avgNote = nMonths ? `Trung bình trong ${nMonths} tháng (${monthLabelShort(range.from)} → ${monthLabelShort(range.to)})` : 'Chưa có dữ liệu'
  const perMonth = (v) => (nMonths ? Math.round(v / nMonths) : 0)
  const inLabel = kind === 'business' ? 'Doanh thu' : 'Thu nhập'

  const isWalletMove = (r) => !isTransfer(r) && r.category === WALLET_MOVE_CATEGORY
  const isFund = (r) => !isTransfer(r) && r.category === BM_FUND_CATEGORY
  const debtOf = (c) => shown.filter((r) => isDebt(r) && r.category === c)
  // Chỉ Ví cá nhân tách Trả nợ BM / Trả nợ cá nhân; Ví BM và Doanh nghiệp giữ một bảng Trả nợ
  const split = kind === 'personal'
  const debtBmRows = split ? debtOf('Trả nợ BM') : []
  const debtPersonalRows = split ? debtOf('Trả nợ cá nhân') : []
  const debtOldRows = split ? debtOf('Trả nợ') : shown.filter(isDebt) // Ví cá nhân: dòng cũ chưa tách BM / cá nhân
  const isInvest = (r) => isInflow(r) && r.category === 'Đầu tư'
  const investRows = shown.filter(isInvest)
  const walletRows = shown.filter(isWalletMove)
  const fundRows = shown.filter(isFund)
  const outRows = shown.filter((r) => !isInflow(r) && !isTransfer(r) && !isWalletMove(r) && !isFund(r) && !isDebt(r))
  const inRows = shown.filter((r) => isInflow(r) && !isWalletMove(r) && !isFund(r) && !isInvest(r))
  const sumOf = (rs) => rs.reduce((a, r) => a + r.amount, 0)
  const moveRows = shown.filter(isTransfer)
  const sumLabel = (key, rs) => (key === 'wallet' ? `+${money(sumOf(rs.filter(isInflow)))} / −${money(sumOf(rs.filter((x) => !isInflow(x))))}` : money(sumOf(rs)))
  const groups = [
    { key: 'out', title: '⬆ Tiền đi ra', rows: outRows, always: true, tone: 'text-red-600', sum: sumLabel('out', outRows) },
    { key: 'debtBm', title: '💳 Trả nợ BM', rows: debtBmRows, always: false, tone: 'text-red-600', sum: sumLabel('debtBm', debtBmRows) },
    { key: 'debtPersonal', title: '💳 Trả nợ cá nhân', rows: debtPersonalRows, always: false, tone: 'text-red-600', sum: sumLabel('debtPersonal', debtPersonalRows) },
    { key: 'debtOld', title: split ? '💳 Trả nợ (chưa phân loại BM / cá nhân)' : '💳 Trả nợ', rows: debtOldRows, always: false, tone: 'text-red-600', sum: sumLabel('debtOld', debtOldRows) },
    { key: 'wallet', title: '⇄ Chuyển ví', rows: walletRows, always: false, tone: 'text-indigo-600', sum: sumLabel('wallet', walletRows) },
    { key: 'in', title: `⬇ Tiền đi vào`, rows: inRows, always: true, tone: 'text-emerald-600', sum: sumLabel('in', inRows) },
    { key: 'invest', title: '📈 Đầu tư (tiền đi vào)', rows: investRows, always: false, tone: 'text-emerald-600', sum: sumLabel('invest', investRows) },
    { key: 'fund', title: '🏦 Quỹ BM', rows: fundRows, always: false, tone: 'text-emerald-600', sum: sumLabel('fund', fundRows) },
    { key: 'move', title: '↔ Chuyển nội bộ (không tính thu/chi)', rows: moveRows, always: false, tone: 'text-slate-500' },
  ]
  const monthLabel = (ym) => (ym ? `Tháng ${ym.slice(5)}/${ym.slice(0, 4)}` : 'Chưa có ngày')
  const table = (g) => {
    const years = [] // [{ y, rows, months: [{ ym, rows }] }] — mới -> cũ (g.rows đã sắp theo ngày giảm dần)
    for (const x of g.rows) {
      const ym = (x.date || '').slice(0, 7), y = ym.slice(0, 4)
      let Y = years[years.length - 1]
      if (!Y || Y.y !== y) years.push((Y = { y, rows: [], months: [] }))
      Y.rows.push(x)
      const M = Y.months[Y.months.length - 1]
      if (M && M.ym === ym) M.rows.push(x); else Y.months.push({ ym, rows: [x] })
    }
    const key = (k) => `${g.key}:${k}`
    // mặc định đóng hết cho gọn; bấm vào năm/tháng để mở
    const yearOpen = (y) => openMonths[key(y)] ?? false
    const monthOpen = (ym) => openMonths[key(ym)] ?? false
    const setOpen = (k, v) => setOpenMonths((o) => ({ ...o, [key(k)]: v }))
    const allKeys = years.flatMap((Y) => [Y.y, ...Y.months.map((M) => M.ym)])
    const allOpen = years.length > 0 && years.every((Y) => yearOpen(Y.y) && Y.months.every((M) => monthOpen(M.ym)))
    const tickRows = (rs) => pick.setMany(rs.map((x) => x.id), !rs.every((x) => pick.isSelected(x.id)))
    const secOpen = openMonths[key('__section')] ?? false // cả bảng là dropdown, mặc định đóng
    const all = g.rows.length > 0 && g.rows.every((r) => pick.isSelected(r.id))
    const toggleAll = () => tickRows(g.rows)
    return (
      <div key={g.key} className="space-y-1">
        <div className="flex cursor-pointer select-none items-baseline justify-between rounded-lg px-1 py-1 hover:bg-slate-100" onClick={() => setOpen('__section', !secOpen)}>
          <h3 className={`font-semibold ${g.tone}`}><span className="mr-1 inline-block w-4 text-slate-400">{secOpen ? '▾' : '▸'}</span>{g.title} <span className="text-xs font-normal text-slate-400">({g.rows.length})</span></h3>
          <div className="flex items-baseline gap-3">
            {secOpen && allKeys.length > 2 && <button className="text-xs text-blue-600" onClick={(e) => e.stopPropagation() || setOpenMonths((o) => ({ ...o, ...Object.fromEntries(allKeys.map((k) => [key(k), !allOpen])) }))}>{allOpen ? 'Thu gọn tất cả' : 'Mở tất cả'}</button>}
            {g.sum != null && <span className={`text-sm font-medium ${g.tone}`}>{g.sum}</span>}
          </div>
        </div>
        {secOpen && <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 text-left"><tr><th className="px-3 py-2 w-8"><input type="checkbox" aria-label="Tính cả bảng" checked={all} onChange={toggleAll} /></th>{['Ngày', 'Loại', 'Danh mục', 'Tag', 'Số tiền', kind === 'business' ? 'Đối tác' : 'Tài khoản', 'Ghi chú', 'Bởi', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {years.map((Y) => {
                const yOpen = yearOpen(Y.y)
                return [
                  <tr key={`y-${Y.y}`} className="border-t border-slate-200 bg-slate-100 cursor-pointer select-none hover:bg-slate-200" onClick={() => setOpen(Y.y, !yOpen)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Tính cả năm ${Y.y}`} checked={Y.rows.every((x) => pick.isSelected(x.id))} onChange={() => tickRows(Y.rows)} /></td>
                    <td colSpan={5} className="px-3 py-2 font-semibold text-slate-800"><span className="inline-block w-4 text-slate-500">{yOpen ? '▾' : '▸'}</span>{Y.y ? `Năm ${Y.y}` : 'Chưa có ngày'} <span className="text-xs font-normal text-slate-500">· {Y.rows.length} giao dịch</span></td>
                    <td colSpan={4} className={`px-3 py-2 text-right font-semibold ${g.tone}`}>{sumLabel(g.key, Y.rows)}</td>
                  </tr>,
                  ...(yOpen ? Y.months.flatMap((M) => {
                    const mOpen = monthOpen(M.ym)
                    return [
                      <tr key={`h-${M.ym}`} className="border-t border-slate-100 bg-slate-50 cursor-pointer select-none hover:bg-slate-100" onClick={() => setOpen(M.ym, !mOpen)}>
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Tính cả ${monthLabel(M.ym)}`} checked={M.rows.every((x) => pick.isSelected(x.id))} onChange={() => tickRows(M.rows)} /></td>
                        <td colSpan={5} className="px-3 py-1.5 pl-8 font-medium text-slate-700"><span className="inline-block w-4 text-slate-400">{mOpen ? '▾' : '▸'}</span>{monthLabel(M.ym)} <span className="text-xs font-normal text-slate-400">· {M.rows.length} giao dịch</span></td>
                        <td colSpan={4} className={`px-3 py-1.5 text-right font-medium ${g.tone}`}>{sumLabel(g.key, M.rows)}</td>
                      </tr>,
                    mOpen && M.rows.map((r) => (
                      <tr key={r.id} className={`border-t border-slate-100 ${pick.isSelected(r.id) ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-1.5"><input type="checkbox" aria-label="Tính dòng này" checked={pick.isSelected(r.id)} onChange={() => pick.toggle(r.id)} /></td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-1.5">{rowType(r)}</td>
                        <td className="px-3 py-1.5">{r.category}</td>
                        <td className="px-3 py-1.5"><div className="flex flex-wrap gap-1">{parseTags(r.tag).map((t) => <span key={t} className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-800">{t}</span>)}</div></td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap ${isTransfer(r) ? 'text-slate-400' : isInflow(r) ? 'text-emerald-600' : 'text-red-600'}`}>{isTransfer(r) ? '↔' : isInflow(r) ? '+' : '−'}{money(r.amount)}</td>
                        <td className="px-3 py-1.5">{r.account ?? r.counterparty}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.note}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.created_by}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <button className="text-blue-600 mr-2" onClick={() => setEditing(r)}>Sửa</button>
                          <button className="text-red-600" onClick={() => confirm('Xoá giao dịch này?') && remove(kind, r)}>Xoá</button>
                        </td>
                      </tr>
                    ))

                    ]
                  }) : []),
                ]
              })}
              {!g.rows.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data._missing?.includes(kind) && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Sheet chưa có tab {TABS[kind].tab}. Chạy lại <code>setup.gs</code> (không xoá dữ liệu cũ) hoặc tạo tab đúng tên để lưu dữ liệu.</div>}
      <FilterBar rows={rows} action={<div className="flex gap-2"><button className="btn-ghost" onClick={onImport}>Nhập sao kê</button><button className="btn-ghost" title={`File CSV, hàng đầu: ${CSV_HEADER.join(',')}`} onClick={() => csvRef.current?.click()}>Nhập CSV</button><input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} /><button className="btn" onClick={() => setEditing({})}>+ Thêm giao dịch</button></div>} />
      <section className="space-y-2">
        <div className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-slate-100" onClick={() => setCardsOpen((v) => !v)}>
          <h3 className="flex items-center gap-2 font-semibold text-slate-700">
            <span className="inline-block w-4 text-slate-400">{cardsOpen ? '▾' : '▸'}</span>Thẻ ngân hàng <span className="text-xs font-normal text-slate-400">({cards.length})</span>
            {!cardsOpen && <span className="flex gap-1">{cards.map((a) => <BankBadge key={a.id} account={a} />)}</span>}
          </h3>
          <button className="text-sm font-normal text-blue-600" onClick={(e) => { e.stopPropagation(); setCardsOpen(true); setEditingCard({}) }}>+ Thêm thẻ</button>
        </div>
        {cardsOpen && (cards.length > 0
          ? <div className="flex flex-wrap gap-2">
              {cards.map((a) => (
                <div key={a.id} className="card !p-2 flex items-center gap-2">
                  <BankBadge account={a} size="lg" />
                  <div className="leading-tight">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-slate-400">{a.bank}</div>
                  </div>
                  <div className="ml-2 text-xs whitespace-nowrap"><button className="text-blue-600" onClick={() => setEditingCard(a)}>Sửa</button> · <button className="text-red-600" onClick={() => confirm(`Xoá thẻ "${a.name}"? (Giao dịch đã ghi không bị xoá)`) && remove('accounts', a)}>Xoá</button></div>
                </div>))}
            </div>
          : <div className="text-sm text-slate-400 px-1">Chưa có thẻ — bấm “+ Thêm thẻ” để gán huy hiệu và màu cho từng thẻ ngân hàng.</div>)}
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat tinted={tint} className={statCls} label={inLabel} value={money(t.income)} />
        <Stat tinted={tint} className={statCls} label="Chi" value={money(t.expense)} tone="neg" sub="Không gồm Trả nợ" />
        <Stat tinted={tint} className={statCls} label="Dòng tiền ròng" value={money(t.net)} tone={t.net < 0 ? 'neg' : 'pos'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat tinted={tint} className={statCls} label={`${inLabel} / tháng`} value={money(perMonth(t.income))} sub={avgNote} />
        <Stat tinted={tint} className={statCls} label="Chi / tháng" tone="neg" value={money(perMonth(t.expense))} sub={avgNote} />
        {kind !== 'personal' && (<Stat tinted={tint} className={statCls} label="Trả nợ" tone="neg" value={money(debtTotal)} sub={debtCounted.length ? `${debtCounted.length} khoản · TB ${money(perMonth(debtTotal))}/tháng · tách riêng khỏi Chi` : 'Chưa có khoản trả nợ'} />)}
      </div>
      {kind === 'personal' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat tinted={tint} className={statCls} label="Trả nợ BM" tone="neg" value={money(sumOf2(debtBmC))} sub={debtBmC.length ? `${debtBmC.length} khoản · TB ${money(perMonth(sumOf2(debtBmC)))}/tháng` : 'Chưa có khoản trả nợ'} />
          <Stat tinted={tint} className={statCls} label="Trả nợ cá nhân" tone="neg" value={money(sumOf2(debtCnC))} sub={debtCnC.length ? `${debtCnC.length} khoản · TB ${money(perMonth(sumOf2(debtCnC)))}/tháng` : 'Chưa có khoản trả nợ'} />
          {debtOldC.length > 0 && <Stat tinted={tint} className={statCls} label="Trả nợ chưa phân loại BM / cá nhân" tone="neg" value={money(sumOf2(debtOldC))} sub={debtOldC.length ? `${debtOldC.length} khoản · TB ${money(perMonth(sumOf2(debtOldC)))}/tháng` : 'Chưa có khoản trả nợ'} />}
        </div>)}
      {unticked.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <span>Đang bỏ tick <b>{unticked.length}</b> giao dịch — các thẻ tổng không tính những dòng này.</span>
          <button className="text-blue-600 underline" onClick={() => pick.setMany(unticked.map((r) => r.id), true)}>Tick lại tất cả</button>
          <button className="rounded-lg border border-red-300 text-red-700 px-3 py-1 hover:bg-red-50" onClick={delUnticked}>Xoá {unticked.length} dòng bỏ tick</button>
        </div>)}
      <section className={`rounded-xl border border-amber-300 bg-amber-100 ${logOpen ? 'space-y-3 p-4' : 'px-4 py-2'}`}>
        <div className="flex cursor-pointer select-none items-baseline justify-between gap-2" onClick={() => setLogOpen((v) => !v)}>
          <h3 className="font-semibold text-slate-800">
            <span className="mr-1 inline-block w-4 text-slate-600">{logOpen ? '▾' : '▸'}</span>📒 {{ personal: 'Ghi chép chi tiêu cá nhân', business: 'Ghi chép thu / chi doanh nghiệp', bm: 'Ghi chép thu / chi Ví BM' }[kind]}
            <span className="ml-2 text-xs font-normal text-slate-600">{periodRows.length} giao dịch{filtered ? ` · đang lọc ${shown.length}` : ''}</span>
          </h3>
          <span className="text-xs text-slate-600">{logOpen ? 'Bấm để đóng' : 'Bấm để mở'}</span>
        </div>
        {logOpen && <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 px-3 pt-2">
            <FilterRow>
              <SelectField label="Loại" value={vType} onChange={setFType} options={[{ value: '', label: 'Tất cả loại' }, ...typeOpts.map((t) => ({ value: t, label: t }))]} />
              <SelectField label="Danh mục" value={vCat} onChange={setFCat} options={[{ value: '', label: 'Tất cả danh mục' }, ...catOpts.map((c) => ({ value: c, label: c }))]} />
              <SelectField label="Tag" value={vTag} onChange={setFTag} options={[{ value: '', label: 'Tất cả tag' }, ...tagOpts.map((x) => ({ value: x.tag, label: `${x.tag} (${x.count})` })), ...(hasUntagged ? [{ value: NO_TAG, label: 'Chưa gắn tag' }] : [])]} />
              {filtered && <div className="flex items-center gap-3 pb-1.5 text-sm"><span className="text-slate-600">Hiển thị <b>{shown.length}</b>/{periodRows.length} giao dịch</span><button className="text-blue-600 underline" onClick={() => { setFCat(''); setFType(''); setFTag('') }}>Xoá bộ lọc</button></div>}
            </FilterRow>
          </div>
          {groups.map((g) => g.rows.length > 0 || g.always ? table(g) : null)}
        </div>}
      </section>
      {kind === 'personal' && <TagAnalysis rows={counted.filter((r) => !isInflow(r) && !isTransfer(r) && !isDebt(r))} />}
      {kind === 'personal' && <SpendPlan actualMonthly={perMonth(t.income)} actualRows={rows.filter((r) => pick.isSelected(r.id) && !isInflow(r) && !isTransfer(r) && !isWalletMove(r))} />}
      {editingCard && <EntryForm kind="accounts" row={editingCard.id ? editingCard : { name: '', bank: '', owner: cardOwner, preset: '', status: 'Active', note: '', badge: '', color: '' }} onClose={() => setEditingCard(null)} />}
      {editing && <EntryForm kind={kind} row={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
