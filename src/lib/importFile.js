import { parseCsv } from './importParse.js'

// CSV của ngân hàng VN đôi khi là Windows-1258 thay vì UTF-8: nếu giải mã UTF-8 ra ký tự lỗi thì thử lại.
async function readText(file) {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  if (!utf8.includes('�')) return utf8
  try { return new TextDecoder('windows-1258').decode(buf) } catch { return utf8 }
}

/** File sao kê (.csv | .txt | .xlsx) -> mảng các dòng (mỗi dòng là mảng ô). Chỉ chạy trong trình duyệt, file không được gửi đi đâu. */
export async function readFileTable(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser') // tải khi cần, không làm nặng trang chính
    return readSheet(file)
  }
  if (name.endsWith('.xls')) throw new Error('File .xls (định dạng cũ) chưa đọc được — mở bằng Excel rồi Lưu thành .xlsx hoặc .csv')
  return parseCsv(await readText(file))
}
