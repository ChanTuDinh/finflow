// Google Sheets qua REST + Google Identity Services (OAuth, chạy hoàn toàn ở trình duyệt).
// Mỗi người dùng đăng nhập bằng tài khoản Google của mình và cần được share quyền Editor trên Sheet.
import { TABS, CORE_KINDS, EMPTY_DATA, rowFromValues, valuesFromRow } from './schema.js'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const API = 'https://sheets.googleapis.com/v4/spreadsheets'

let token = null
let tokenExpiry = 0
let tokenClient = null
const sheetIdCache = {}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = resolve
    s.onerror = () => reject(new Error('Không tải được Google Identity Services'))
    document.head.appendChild(s)
  })
}

export async function signIn(clientId) {
  if (!clientId) throw new Error('Thiếu Google OAuth Client ID (VITE_GOOGLE_CLIENT_ID)')
  await loadGis()
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (res) => {
        if (res.error) return reject(new Error(res.error_description || res.error))
        token = res.access_token
        tokenExpiry = Date.now() + (res.expires_in - 60) * 1000
        resolve()
      },
    })
    tokenClient.requestAccessToken({ prompt: token ? '' : 'consent' })
  })
}

export const isSignedIn = () => !!token && Date.now() < tokenExpiry
export function signOut() {
  if (token) window.google?.accounts?.oauth2?.revoke(token)
  token = null
}

function friendlyError(status, msg = '') {
  if (status === 401) return 'Phiên đăng nhập Google đã hết hạn — bấm Kết nối lại trong Cài đặt'
  if (status === 403) return 'Tài khoản Google này chưa có quyền Editor trên Sheet — nhờ chủ Sheet share lại'
  if (status === 404) return 'Không tìm thấy Sheet — kiểm tra lại Spreadsheet ID trong Cài đặt'
  if (/Unable to parse range|not found/i.test(msg)) return 'Sheet thiếu một tab cần thiết (Savings / Goals?) — chạy lại setup.gs hoặc tạo tab đúng tên'
  return msg || `Sheets API ${status}`
}

async function call(path, options = {}) {
  if (!isSignedIn()) throw new Error('Phiên đăng nhập Google đã hết hạn — hãy kết nối lại')
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(friendlyError(res.status, body.error?.message))
  }
  return res.json()
}

const q = (s) => encodeURIComponent(s)

export async function loadAll(sheetId) {
  const meta = await call(`/${sheetId}?fields=sheets.properties.title`)
  const have = new Set(meta.sheets.map((x) => x.properties.title))
  const kinds = Object.keys(TABS).filter((k) => have.has(TABS[k].tab))
  const missingCore = CORE_KINDS.filter((k) => !kinds.includes(k))
  if (missingCore.length) throw new Error(`Sheet thiếu tab: ${missingCore.map((k) => TABS[k].tab).join(', ')}`)
  const ranges = kinds.map((k) => `ranges=${q(`${TABS[k].tab}!A2:Z`)}`).join('&')
  const data = await call(`/${sheetId}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`)
  const out = EMPTY_DATA()
  kinds.forEach((kind, i) => {
    const rows = data.valueRanges[i].values || []
    out[kind] = rows.map((vals, idx) => ({ ...rowFromValues(kind, vals), _row: idx + 2 })).filter((r) => r.id !== '')
  })
  out._missing = Object.keys(TABS).filter((k) => !kinds.includes(k))
  return out
}

const lastCol = (kind) => String.fromCharCode(64 + TABS[kind].columns.length)

export async function appendRow(sheetId, kind, row) {
  await call(
    `/${sheetId}/values/${q(`${TABS[kind].tab}!A:${lastCol(kind)}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [valuesFromRow(kind, row)] }) },
  )
}

export async function updateRow(sheetId, kind, row) {
  const r = row._row
  await call(`/${sheetId}/values/${q(`${TABS[kind].tab}!A${r}:${lastCol(kind)}${r}`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [valuesFromRow(kind, row)] }),
  })
}

async function tabGid(sheetId, kind) {
  const key = `${sheetId}:${kind}`
  if (sheetIdCache[key] == null) {
    const meta = await call(`/${sheetId}?fields=sheets.properties`)
    meta.sheets.forEach((s) => (sheetIdCache[`${sheetId}:${Object.keys(TABS).find((k) => TABS[k].tab === s.properties.title)}`] = s.properties.sheetId))
  }
  return sheetIdCache[key]
}

export async function deleteRow(sheetId, kind, row) {
  const gid = await tabGid(sheetId, kind)
  await call(`/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: row._row - 1, endIndex: row._row } } }],
    }),
  })
}
