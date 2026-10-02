import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as sheets from './sheets.js'
import { demoData } from './demo.js'
import { newId, EMPTY_DATA, CASH_KINDS } from './schema.js'
import { makeMoney, todayIso } from './format.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const LS = 'finflow:v1'
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
// Dữ liệu demo cũ trong localStorage có thể chưa có savings/goals: bổ sung để không lỗi.
const loadDemo = () => {
  const fresh = demoData(todayIso().slice(0, 7))
  const saved = load(`${LS}:demo`, null)
  if (!saved) return fresh
  return { ...EMPTY_DATA(), ...saved, savings: saved.savings ?? fresh.savings, goals: saved.goals ?? fresh.goals, accounts: saved.accounts ?? fresh.accounts, rules: saved.rules ?? fresh.rules, bm: saved.bm ?? fresh.bm, debts_bm: saved.debts_bm ?? fresh.debts_bm, payments: saved.payments ?? fresh.payments }
}
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    sheetId: import.meta.env.VITE_SHEET_ID || '',
    currency: 'VND',
    user: '',
    ...load(`${LS}:settings`, {}),
  }))
  const [mode, setMode] = useState('demo') // 'demo' | 'sheets'
  const [data, setData] = useState(loadDemo)
  const [status, setStatus] = useState({ loading: false, error: '' })

  useEffect(() => save(`${LS}:settings`, { ...settings, clientId: settings.clientId }), [settings])
  useEffect(() => { if (mode === 'demo') save(`${LS}:demo`, data) }, [data, mode])

  const money = useMemo(() => makeMoney(settings.currency), [settings.currency])
  const run = useCallback(async (fn) => {
    setStatus({ loading: true, error: '' })
    try { await fn() } catch (e) { setStatus({ loading: false, error: e.message }); return false }
    setStatus({ loading: false, error: '' })
    return true
  }, [])

  const refresh = useCallback(() => run(async () => setData(await sheets.loadAll(settings.sheetId))), [run, settings.sheetId])

  const connect = () => run(async () => {
    await sheets.signIn(settings.clientId)
    setData(await sheets.loadAll(settings.sheetId))
    setMode('sheets')
  })
  const disconnect = () => { sheets.signOut(); setMode('demo'); setData(loadDemo()) }
  const resetDemo = () => setData(demoData(todayIso().slice(0, 7)))

  // Thêm / sửa / xoá. Sheets: ghi rồi tải lại để giữ số hàng (_row) đúng khi nhiều người cùng sửa.
  const upsert = (kind, row) => run(async () => {
    const isNew = !row.id
    const r = { ...row, id: row.id || newId(), ...(isNew && CASH_KINDS.includes(kind) ? { created_by: settings.user || 'me' } : {}) }
    if (mode === 'sheets') {
      if (isNew) await sheets.appendRow(settings.sheetId, kind, r)
      else await sheets.updateRow(settings.sheetId, kind, r)
      setData(await sheets.loadAll(settings.sheetId))
    } else {
      setData((d) => ({ ...d, [kind]: isNew ? [...d[kind], r] : d[kind].map((x) => (x.id === r.id ? r : x)) }))
    }
  })
  // Ghi một lô sao kê đã duyệt: dòng mới (personal/business) + đổi các dòng đã có thành Transfer.
  const importBatch = ({ personal = [], business = [], bm = [], convert = [] }) => run(async () => {
    if (mode === 'sheets') {
      await sheets.appendRows(settings.sheetId, 'personal', personal)
      await sheets.appendRows(settings.sheetId, 'business', business)
      await sheets.appendRows(settings.sheetId, 'bm', bm)
      for (const c of convert) await sheets.updateRow(settings.sheetId, c.kind, c.row)
      setData(await sheets.loadAll(settings.sheetId))
    } else {
      setData((d) => {
        const swap = (kind) => d[kind].map((x) => convert.find((c) => c.kind === kind && c.row.id === x.id)?.row ?? x)
        return { ...d, personal: [...swap('personal'), ...personal], business: [...swap('business'), ...business], bm: [...swap('bm'), ...bm] }
      })
    }
  })
  // Ghi một lần trả nợ: thêm vào lịch sử + cập nhật dư nợ (+ tuỳ chọn thêm dòng chi vào sổ dòng tiền).
  const recordPayment = ({ kind, debt, payment, cash }) => run(async () => {
    if (mode === 'sheets') {
      await sheets.appendRows(settings.sheetId, 'payments', [payment])
      await sheets.updateRow(settings.sheetId, kind, debt)
      if (cash) await sheets.appendRows(settings.sheetId, cash.kind, [cash.row])
      setData(await sheets.loadAll(settings.sheetId))
    } else {
      setData((d) => ({
        ...d, payments: [...d.payments, payment], [kind]: d[kind].map((x) => (x.id === debt.id ? debt : x)),
        ...(cash ? { [cash.kind]: [...d[cash.kind], cash.row] } : {}),
      }))
    }
  })
  // Sửa một lần trả: payment đã tính lại (giữ id/_row), debt = khoản nợ sau khi áp lại (null nếu chỉ sửa ngày/ghi chú)
  const updatePayment = ({ kind, payment, debt }) => run(async () => {
    if (mode === 'sheets') {
      await sheets.updateRow(settings.sheetId, 'payments', payment)
      if (debt) await sheets.updateRow(settings.sheetId, kind, debt)
      setData(await sheets.loadAll(settings.sheetId))
    } else {
      setData((d) => ({ ...d, payments: d.payments.map((x) => (x.id === payment.id ? payment : x)), ...(debt ? { [kind]: d[kind].map((x) => (x.id === debt.id ? debt : x)) } : {}) }))
    }
  })
  // Xoá một lần trả: bỏ khỏi lịch sử rồi hoàn lại phần gốc vào dư nợ (debt = khoản nợ đã hoàn lại; null nếu khoản nợ không còn)
  const deletePayment = ({ kind, debt, payment }) => run(async () => {
    if (mode === 'sheets') {
      await sheets.deleteRow(settings.sheetId, 'payments', payment)
      if (debt) await sheets.updateRow(settings.sheetId, kind, debt)
      setData(await sheets.loadAll(settings.sheetId))
    } else {
      setData((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== payment.id), ...(debt ? { [kind]: d[kind].map((x) => (x.id === debt.id ? debt : x)) } : {}) }))
    }
  })
  const remove = (kind, row) => run(async () => {
    if (mode === 'sheets') {
      await sheets.deleteRow(settings.sheetId, kind, row)
      setData(await sheets.loadAll(settings.sheetId))
    } else setData((d) => ({ ...d, [kind]: d[kind].filter((x) => x.id !== row.id) }))
  })

  return (
    <Ctx.Provider value={{ data, mode, settings, setSettings, money, status, connect, disconnect, refresh, resetDemo, upsert, remove, importBatch, recordPayment, deletePayment, updatePayment }}>
      {children}
    </Ctx.Provider>
  )
}
