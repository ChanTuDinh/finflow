/**
 * FinFlow — tạo cấu trúc Sheet mẫu.
 * Cách dùng: tạo Google Sheet mới → Extensions > Apps Script → dán file này → Run `setupFinFlow`.
 * Header phải giữ đúng thứ tự cột (app đọc theo vị trí cột).
 */
const TABS = {
  Personal_CashFlow: {
    header: ['id', 'date', 'type', 'category', 'amount', 'account', 'note', 'created_by', 'ref'],
    validation: { 3: ['Income', 'Expense', 'Transfer'] },
    sample: [['p001', '2026-09-05', 'Income', 'Lương', 40000000, 'Vietcombank', 'Lương tháng 9', 'me'],
             ['p002', '2026-09-06', 'Expense', 'Nhà ở', 9000000, 'Vietcombank', 'Tiền thuê nhà', 'me']],
  },
  Business_CashFlow: {
    header: ['id', 'date', 'type', 'category', 'amount', 'counterparty', 'note', 'created_by', 'account', 'ref'],
    validation: { 3: ['Revenue', 'Expense', 'Transfer'] },
    sample: [['b001', '2026-09-08', 'Revenue', 'Dịch vụ', 25000000, 'Khách A', 'Hợp đồng tư vấn', 'me']],
  },
  Debts: {
    header: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note'],
    validation: { 4: ['Personal', 'Business'], 9: ['Active', 'Paid'] },
    sample: [['d001', 'Thẻ tín dụng', 'Techcombank', 'Personal', 45000000, 30, 2500000, 15, 'Active', '']],
  },
  Debts_BM: {
    // Nguồn nợ thứ hai ("Nợ BM"): cùng cấu trúc với Debts, dữ liệu tách riêng
    header: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note', 'record_date'],
    validation: { 4: ['Personal', 'Business', 'BM'], 9: ['Active', 'Paid'] },
    sample: [['m001', 'Vay BM #1', 'BM', 'Business', 90000000, 12, 3500000, 10, 'Active', '', '2026-10-01']],
    textCols: [11], // record_date dạng chữ yyyy-mm-dd
  },
  Savings: {
    header: ['id', 'name', 'type', 'owner', 'balance', 'monthly_contribution', 'annual_return', 'goal_id', 'status', 'note'],
    validation: { 3: ['Tiết kiệm', 'Chứng khoán', 'Vàng', 'Quỹ dự phòng', 'Quỹ đầu tư', 'Khác'], 4: ['Personal', 'Business'], 9: ['Active', 'Closed'] },
    sample: [['s001', 'Sổ tiết kiệm VCB', 'Tiết kiệm', 'Personal', 60000000, 4000000, 5.5, 'g001', 'Active', '']],
  },
  Accounts: {
    // preset: app tự ghi cấu hình cột sao kê (JSON) — không cần sửa tay
    header: ['id', 'name', 'bank', 'owner', 'preset', 'status', 'note'],
    validation: { 4: ['Personal', 'Business'], 6: ['Active', 'Closed'] },
    sample: [['a001', 'Vietcombank', 'Vietcombank', 'Personal', '', 'Active', '']],
  },
  Rules: {
    // direction: out (chi) | in (thu) | any ; owner: Personal | Business | để trống = cả hai
    header: ['id', 'keyword', 'category', 'direction', 'owner'],
    validation: { 4: ['out', 'in', 'any'] },
    sample: [['r001', 'grab', 'Đi lại', 'out', ''], ['r002', 'luong', 'Lương', 'in', 'Personal']],
  },
  Goals: {
    header: ['id', 'name', 'owner', 'target_amount', 'target_date', 'status', 'note'],
    validation: { 3: ['Personal', 'Business'], 6: ['Active', 'Done'] },
    sample: [['g001', 'Quỹ khẩn cấp 6 tháng', 'Personal', 150000000, '2028-03-31', 'Active', '']],
    textCols: [5], // target_date dạng chữ yyyy-mm-dd
  },
};

function setupFinFlow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((name) => {
    const cfg = TABS[name];
    let sh = ss.getSheetByName(name);
    const existed = !!sh;
    if (!existed) sh = ss.insertSheet(name);
    // Chạy lại nhiều lần vẫn an toàn: tab đã có dữ liệu thì chỉ bổ sung header/dropdown, không xoá.
    const hasData = existed && sh.getLastRow() > 1;
    sh.getRange(1, 1, 1, cfg.header.length).setValues([cfg.header]).setFontWeight('bold').setBackground('#e2e8f0');
    sh.setFrozenRows(1);
    if (!hasData && cfg.sample.length) sh.getRange(2, 1, cfg.sample.length, cfg.sample[0].length).setValues(cfg.sample);
    Object.keys(cfg.validation).forEach((col) => {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(cfg.validation[col], true).build();
      sh.getRange(2, Number(col), 1000, 1).setDataValidation(rule);
    });
    // Ngày ở dạng chữ yyyy-mm-dd để app đọc ổn định (Personal/Business: cột 2)
    if (cfg.header[1] === 'date') sh.getRange(2, 2, 1000, 1).setNumberFormat('@');
    (cfg.textCols || []).forEach((c) => sh.getRange(2, c, 1000, 1).setNumberFormat('@'));
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
