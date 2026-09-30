import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { TABS, TRANSFER_CATEGORY } from '../lib/schema.js'
import { detectPreset, extractRows } from '../lib/importParse.js'
import { buildWrites, detectTransfers, stageRows, suggestKeyword } from '../lib/importLogic.js'
import { readFileTable } from '../lib/importFile.js'
import { Field, SelectField } from '../components/ui.jsx'
import EntryForm from '../components/EntryForm.jsx'

const colLetter = (i) => String.fromCharCode(65 + (i % 26))
const FIELDS = [['date', 'Ngày giao dịch'], ['desc', 'Nội dung'], ['debit', 'Số tiền chi (ghi nợ)'], ['credit', 'Số tiền thu (ghi có)'], ['amount', 'Hoặc: một cột số tiền có dấu ±'], ['ref', 'Mã giao dịch (nếu có)']]
const TYPE_LABEL = { out: 'Chi', in: 'Thu', transfer: 'Chuyển nội bộ' }

const kindOfType = (row, dir) => (dir === 'transfer' ? 'Transfer' : dir === 'out' ? 'Expense' : row.kind === 'business' ? 'Revenue' : 'Income')
const dirOfType = (t) => (t === 'Transfer' ? 'transfer' : t === 'Expense' ? 'out' : 'in')

export default function Import({ onBack }) {
  const { data, money, importBatch, upsert, remove, status } = useStore()
  const accounts = data.accounts.filter((a) => a.status !== 'Closed')
  const [accountId, setAccountId] = useState('')
  const account = accounts.find((a) => a.id === accountId) || null
  const [table, setTable] = useState(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [edits, setEdits] = useState({})
  const [msg, setMsg] = useState({ text: '', error: false })
  const [editing, setEditing] = useState(null)

  const existing = useMemo(() => [...data.personal.map((r) => ({ ...r, _kind: 'personal' })), ...data.business.map((r) => ({ ...r, _kind: 'business' }))], [data])
  const savedPreset = useMemo(() => { try { return account?.preset ? JSON.parse(account.preset) : null } catch { return null } }, [account])

  const base = useMemo(() => {
    if (!table || !account || !mapping) return { rows: [], convert: [] }
    return detectTransfers(stageRows({ parsed: extractRows(table, mapping), account, rules: data.rules, existing }), existing)
  }, [table, account, mapping, data.rules, existing])
  const rows = base.rows.map((r) => ({ ...r, ...edits[r.key] }))
  const convert = base.convert.filter((c) => { const r = rows.find((x) => x.key === c.partnerKey); return r && r.include && r.type === 'Transfer' })
  const patch = (key, p) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...p } }))

  const reset = () => { setTable(null); setFileName(''); setMapping(null); setEdits({}); setShowMap(false) }
  const loadTable = (t, acc) => {
    const preset = (() => { try { return acc?.preset ? JSON.parse(acc.preset) : null } catch { return null } })()
    setTable(t); setMapping(preset || detectPreset(t)); setShowMap(!preset); setEdits({})
  }
  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg({ text: '', error: false })
    try { const t = await readFileTable(file); setFileName(file.name); loadTable(t, account) }
    catch (err) { reset(); setMsg({ text: err.message, error: true }) }
  }
  const pickAccount = (id) => { setAccountId(id); if (table) loadTable(table, accounts.find((a) => a.id === id)) }

  const included = rows.filter((r) => r.include)
  const stats = {
    total: rows.length, dupes: rows.filter((r) => r.dupe).length, transfers: included.filter((r) => r.type === 'Transfer').length,
    uncat: included.filter((r) => r.type !== 'Transfer' && r.category === 'Khác' && !r.auto).length,
  }
  const doImport = async () => {
    const w = buildWrites(included)
    const n = w.personal.length + w.business.length
    if (await importBatch({ ...w, convert })) {
      setMsg({ text: `Đã nhập ${n} giao dịch${stats.transfers ? `, trong đó ${stats.transfers} chuyển nội bộ` : ''}${convert.length ? `; đổi ${convert.length} giao dịch cũ thành chuyển nội bộ` : ''}.`, error: false })
      if (!savedPreset) await upsert('accounts', { ...account, preset: JSON.stringify(mapping) }) // lần sau không phải chọn cột nữa
      reset()
    }
  }
  const newRule = (r) => {
    const kw = prompt('Từ khóa để tự phân loại các giao dịch giống thế này (không cần dấu):', suggestKeyword(r.note))
    if (kw?.trim()) upsert('rules', { keyword: kw.trim(), category: r.category, direction: r.type === 'Expense' ? 'out' : 'in', owner: account.owner })
  }
  const setMap = (k, v) => { setMapping((m) => ({ ...m, [k]: Number(v) })); setEdits({}) }
  const maxCols = table ? Math.max(...table.slice(0, 60).map((r) => r.length)) : 0
  const headerCells = table && mapping ? table[mapping.headerRow] || [] : []
  const colOptions = [{ value: '-1', label: '— Không có —' }, ...Array.from({ length: maxCols }, (_, i) => ({ value: String(i), label: `Cột ${colLetter(i)}${headerCells[i] ? `: ${String(headerCells[i]).slice(0, 28)}` : ''}` }))]
  const cats = (r) => TABS[r.kind].categories[r.type] || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><button className="btn-ghost" onClick={onBack}>← Quay lại</button><h2 className="font-semibold text-lg">Nhập sao kê ngân hàng</h2></div>
      {msg.text && <div className={`rounded-lg border text-sm p-2 ${msg.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{msg.text}</div>}
      <p className="text-xs text-slate-500">File được đọc ngay trong trình duyệt của bạn, không gửi đi đâu; chỉ các giao dịch bạn duyệt mới được ghi vào Google Sheet. Hỗ trợ .xlsx và .csv (file .xls cũ: mở bằng Excel, Lưu thành .xlsx).</p>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="Tài khoản ngân hàng" value={accountId} onChange={pickAccount}
            options={[{ value: '', label: accounts.length ? '— Chọn tài khoản —' : '(chưa có tài khoản)' }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.owner === 'Business' ? 'DN' : 'Cá nhân'}${a.preset ? ' ✓' : ''}` }))]} />
          <button className="btn-ghost" onClick={() => setEditing({ kind: 'accounts' })}>+ Thêm tài khoản</button>
          <Field label="File sao kê"><input type="file" accept=".csv,.txt,.xlsx" disabled={!account} onChange={onFile} className="text-sm" /></Field>
        </div>
        {!account && <p className="text-sm text-slate-500">Chọn (hoặc thêm) tài khoản trước: app nhớ cách đọc file của từng ngân hàng (✓) và tự đưa giao dịch vào đúng tab Cá nhân / Doanh nghiệp.</p>}
        {table && <p className="text-sm text-slate-500">Đã đọc <b>{fileName}</b> · {table.length} dòng thô · {mapping && extractRows(table, mapping).length} giao dịch nhận diện được</p>}
      </section>

      {table && mapping && (
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Cách đọc file {!savedPreset && <span className="text-xs font-normal text-amber-600">— lần đầu với tài khoản này, kiểm tra các cột</span>}</h3>
            <button className="btn-ghost ml-auto" onClick={() => setShowMap(!showMap)}>{showMap ? 'Ẩn' : 'Chỉnh cột'}</button>
          </div>
          {showMap && (<>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Dòng tiêu đề (số dòng trong file)"><input type="number" min="1" className="input" value={mapping.headerRow + 1} onChange={(e) => { setMapping((m) => ({ ...m, headerRow: Math.max(Number(e.target.value) - 1, 0) })); setEdits({}) }} /></Field>
              {FIELDS.map(([k, label]) => <SelectField key={k} label={label} value={String(mapping[k] ?? -1)} onChange={(v) => setMap(k, v)} options={colOptions} />)}
            </div>
            <div className="overflow-x-auto text-xs border border-slate-200 rounded-lg">
              <table className="w-full"><tbody>
                {table.slice(Math.max(mapping.headerRow, 0), mapping.headerRow + 5).map((r, i) => (
                  <tr key={i} className={i === 0 ? 'bg-slate-100 font-medium' : 'border-t border-slate-100'}>{Array.from({ length: maxCols }, (_, c) => <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[160px] truncate">{String(r[c] ?? '')}</td>)}</tr>
                ))}
              </tbody></table>
            </div>
            <button className="btn" disabled={status.loading} onClick={() => upsert('accounts', { ...account, preset: JSON.stringify(mapping) })}>Lưu cách đọc này cho “{account.name}”</button>
          </>)}
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span><b>{included.length}</b>/{stats.total} giao dịch sẽ nhập</span>
            {stats.dupes > 0 && <span className="text-slate-500">{stats.dupes} trùng (đã bỏ chọn)</span>}
            {stats.transfers > 0 && <span className="text-blue-600">↔ {stats.transfers} chuyển nội bộ{convert.length ? ` (+${convert.length} dòng cũ)` : ''}</span>}
            {stats.uncat > 0 && <span className="text-amber-600">{stats.uncat} chưa phân loại</span>}
            <button className="btn ml-auto" disabled={!included.length || status.loading} onClick={doImport}>Nhập {included.length} giao dịch</button>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 text-left"><tr>{['', 'Ngày', 'Nội dung', 'Số tiền', 'Loại', 'Danh mục', ''].map((h, i) => <th key={i} className="px-2 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={`border-t border-slate-100 ${!r.include ? 'opacity-50' : ''} ${r.transfer ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-2 py-1"><input type="checkbox" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} /></td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                    <td className="px-2 py-1 min-w-[180px]">{r.note}
                      {r.dupe && <span className="ml-1 text-xs text-slate-500">· trùng</span>}
                      {r.transfer && r.pair && <span className="ml-1 text-xs text-blue-600">· ↔ {r.pair}</span>}
                    </td>
                    <td className={`px-2 py-1 text-right whitespace-nowrap ${r.type === 'Transfer' ? 'text-slate-500' : r.type === 'Expense' ? 'text-red-600' : 'text-emerald-600'}`}>{r.type === 'Expense' ? '−' : r.type === 'Transfer' ? '↔' : '+'}{money(r.amount)}</td>
                    <td className="px-2 py-1">
                      <select className="input !py-1" value={dirOfType(r.type)} onChange={(e) => { const type = kindOfType(r, e.target.value); patch(r.key, { type, category: type === 'Transfer' ? TRANSFER_CATEGORY : (TABS[r.kind].categories[type] || ['Khác']).includes(r.category) ? r.category : 'Khác', auto: false, transfer: type === 'Transfer' && r.transfer }) }}>
                        {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><select className={`input !py-1 ${r.type !== 'Transfer' && r.category === 'Khác' && !r.auto ? 'border-amber-400' : ''}`} value={r.category} onChange={(e) => patch(r.key, { category: e.target.value, auto: false })}>{cats(r).map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.type !== 'Transfer' && <button className="text-xs text-blue-600" onClick={() => newRule(r)}>＋ quy tắc</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card space-y-2">
        <div className="flex items-center"><h3 className="font-semibold">Quy tắc phân loại tự động</h3><button className="btn-ghost ml-auto" onClick={() => setEditing({ kind: 'rules' })}>+ Thêm quy tắc</button></div>
        <p className="text-xs text-slate-500">Nội dung giao dịch chứa từ khóa → tự gán danh mục. Từ khóa dài hơn được ưu tiên.</p>
        <div className="flex flex-wrap gap-2">
          {data.rules.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
              <b>{r.keyword}</b> → {r.category}{r.direction === 'in' ? ' (thu)' : r.direction === 'out' ? ' (chi)' : ''}{r.owner ? ` · ${r.owner === 'Business' ? 'DN' : 'CN'}` : ''}
              <button className="text-blue-600" onClick={() => setEditing({ kind: 'rules', row: r })}>sửa</button>
              <button className="text-red-600" onClick={() => remove('rules', r)}>✕</button>
            </span>
          ))}
          {!data.rules.length && <span className="text-sm text-slate-400">Chưa có quy tắc</span>}
        </div>
      </section>

      <section className="card space-y-2">
        <h3 className="font-semibold">Tài khoản ngân hàng</h3>
        <div className="space-y-1 text-sm">
          {data.accounts.map((a) => (
            <div key={a.id} className={`flex items-center gap-2 ${a.status === 'Closed' ? 'opacity-50' : ''}`}>
              <span className="font-medium">{a.name}</span><span className="text-slate-400">{a.owner === 'Business' ? 'Doanh nghiệp' : 'Cá nhân'} · {a.preset ? 'đã lưu cách đọc file' : 'chưa có cách đọc file'}</span>
              <span className="ml-auto whitespace-nowrap"><button className="text-blue-600 mr-2" onClick={() => setEditing({ kind: 'accounts', row: a })}>Sửa</button><button className="text-red-600" onClick={() => confirm('Xoá tài khoản này? Giao dịch đã nhập không bị xoá.') && remove('accounts', a)}>Xoá</button></span>
            </div>
          ))}
          {!data.accounts.length && <span className="text-slate-400">Chưa có tài khoản</span>}
        </div>
      </section>
      {editing && <EntryForm kind={editing.kind} row={editing.row?.id ? editing.row : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
