// Sao lưu / khôi phục / chuyển dữ liệu từ trình duyệt lên Google Sheet.
import { EMPTY_DATA, TABS } from './schema.js'

export const BACKUP_KINDS = Object.keys(TABS) // personal, business, debts, savings, goals, accounts, rules, debts_bm, payments, bm
const clean = (rows) => (rows || []).map(({ _row, ...r }) => r) // bỏ số hàng trong Sheet

/** Toàn bộ dữ liệu -> object lưu được ra file JSON. */
export function makeBackup(data) {
  const out = {}
  for (const k of BACKUP_KINDS) out[k] = clean(data[k])
  return { app: 'finflow', version: 1, exportedAt: new Date().toISOString(), data: out }
}

/** Nội dung file sao lưu -> dữ liệu dùng được. Báo lỗi tiếng Việt nếu không phải file của FinFlow. */
export function parseBackup(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('Không đọc được file — đây không phải file sao lưu FinFlow (.json)') }
  if (!j || j.app !== 'finflow' || typeof j.data !== 'object' || j.data === null) throw new Error('Đây không phải file sao lưu của FinFlow')
  const data = EMPTY_DATA()
  for (const k of BACKUP_KINDS) if (Array.isArray(j.data[k])) data[k] = clean(j.data[k])
  return data
}

export const backupFileName = (d = new Date()) => `finflow-backup-${d.toISOString().slice(0, 10)}.json`
export const countRows = (data) => BACKUP_KINDS.reduce((s, k) => s + (data?.[k]?.length || 0), 0)

/**
 * Kế hoạch chuyển dữ liệu local lên Sheet: chỉ thêm các dòng CHƯA có (so theo id) nên bấm lại không bị trùng.
 * missing: các tab chưa có trong Sheet -> nếu cần ghi vào tab đó thì chặn toàn bộ (không ghi dở dang).
 */
export function planMigration(local, current, missing = []) {
  const toAdd = {}, blocked = []
  for (const k of BACKUP_KINDS) {
    const have = new Set((current[k] || []).map((r) => r.id))
    const rows = clean(local?.[k]).filter((r) => r.id && !have.has(r.id))
    if (!rows.length) continue
    if (missing.includes(k)) blocked.push(TABS[k].tab)
    else toAdd[k] = rows
  }
  return { toAdd, blocked, total: Object.values(toAdd).reduce((s, r) => s + r.length, 0) }
}

/** Tải một file JSON về máy (chạy trong trình duyệt). */
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- Nhắc sao lưu: nhớ lần sao lưu gần nhất (lưu trong trình duyệt) ----
const LAST_KEY = 'finflow:v1:lastBackup'
export const getLastBackup = () => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }
export const setLastBackup = (iso = new Date().toISOString()) => { try { localStorage.setItem(LAST_KEY, iso) } catch { /* ignore */ } return iso }

/** Số ngày từ lần sao lưu gần nhất và có nên nhắc không (chưa từng sao lưu hoặc quá staleDays ngày). */
export function backupStatus(lastIso, now = new Date(), staleDays = 7) {
  if (!lastIso) return { never: true, days: null, stale: true }
  const days = Math.max(0, Math.floor((now - new Date(lastIso)) / 86400000))
  return { never: false, days, stale: days >= staleDays }
}
export const backupLabel = (st) => (st.never ? 'chưa sao lưu' : st.days === 0 ? 'hôm nay' : `${st.days} ngày trước`)
