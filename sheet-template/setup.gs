/**
 * FinFlow — tạo cấu trúc Sheet mẫu.
 * Cách dùng: tạo Google Sheet mới → Extensions > Apps Script → dán file này → Run `setupFinFlow`.
 * Header phải giữ đúng thứ tự cột (app đọc theo vị trí cột).
 */
const TABS = {
  Personal_CashFlow: {
    header: ['id', 'date', 'type', 'category', 'amount', 'account', 'note', 'created_by'],
    validation: { 3: ['Income', 'Expense'] },
    sample: [['p001', '2026-09-05', 'Income', 'Lương', 40000000, 'Vietcombank', 'Lương tháng 9', 'me'],
             ['p002', '2026-09-06', 'Expense', 'Nhà ở', 9000000, 'Vietcombank', 'Tiền thuê nhà', 'me']],
  },
  Business_CashFlow: {
    header: ['id', 'date', 'type', 'category', 'amount', 'counterparty', 'note', 'created_by'],
    validation: { 3: ['Revenue', 'Expense'] },
    sample: [['b001', '2026-09-08', 'Revenue', 'Dịch vụ', 25000000, 'Khách A', 'Hợp đồng tư vấn', 'me']],
  },
  Debts: {
    header: ['id', 'name', 'lender', 'owner', 'balance', 'apr', 'min_payment', 'due_day', 'status', 'note'],
    validation: { 4: ['Personal', 'Business'], 9: ['Active', 'Paid'] },
    sample: [['d001', 'Thẻ tín dụng', 'Techcombank', 'Personal', 45000000, 30, 2500000, 15, 'Active', '']],
  },
};

function setupFinFlow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((name) => {
    const cfg = TABS[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, cfg.header.length).setValues([cfg.header]).setFontWeight('bold').setBackground('#e2e8f0');
    sh.setFrozenRows(1);
    if (cfg.sample.length) sh.getRange(2, 1, cfg.sample.length, cfg.sample[0].length).setValues(cfg.sample);
    Object.keys(cfg.validation).forEach((col) => {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(cfg.validation[col], true).build();
      sh.getRange(2, Number(col), 1000, 1).setDataValidation(rule);
    });
    // Ngày ở dạng chữ yyyy-mm-dd để app đọc ổn định (Personal/Business: cột 2)
    if (cfg.header[1] === 'date') sh.getRange(2, 2, 1000, 1).setNumberFormat('@');
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
