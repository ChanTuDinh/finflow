# FinFlow

Quản lý tài chính cá nhân + doanh nghiệp (React + Vite + Tailwind), dữ liệu chung qua Google Sheets.

## Chạy thử (không cần Google)
```bash
npm install
npm run dev      # mở http://localhost:5173 — chạy chế độ Demo với dữ liệu mẫu (lưu localStorage)
npm test         # test engine forecast
```

## 1. Tạo Google Sheet
Cách A (khuyên dùng): tạo Sheet mới → Extensions › Apps Script → dán `sheet-template/setup.gs` → chạy `setupFinFlow`.
Cách B: tạo 3 tab tên đúng `Personal_CashFlow`, `Business_CashFlow`, `Debts`, rồi File › Import từng file CSV trong `sheet-template/` (Replace current sheet).

| Tab | Cột (hàng 1 = header, giữ đúng thứ tự) |
|---|---|
| Personal_CashFlow | id, date, type (Income/Expense), category, amount, account, note, created_by |
| Business_CashFlow | id, date, type (Revenue/Expense), category, amount, counterparty, note, created_by |
| Debts | id, name, lender, owner (Personal/Business), balance, apr (%/năm), min_payment, due_day, status (Active/Paid), note |

Quy ước: `date` dạng `yyyy-mm-dd`; `amount` là số dương (loại thu/chi nằm ở cột `type`); `id` bất kỳ, duy nhất (nhập tay thì cứ đặt p101, p102…). Tiền trả nợ ghi là Expense với category `Trả nợ` — forecast loại khoản này khỏi chi cơ sở để không tính trùng.

## 2. Kết nối
1. Google Cloud Console → tạo project → bật **Google Sheets API**.
2. Credentials → OAuth client ID (Web application); thêm `http://localhost:5173` (và domain deploy) vào *Authorized JavaScript origins*. Màn hình consent: thêm 1-2 người dùng chung vào *Test users*.
3. Copy `.env.example` → `.env`, điền `VITE_GOOGLE_CLIENT_ID` (hoặc nhập trong tab Cài đặt cùng Spreadsheet ID).
4. Share Sheet (Editor) cho người dùng chung; mỗi người đăng nhập bằng tài khoản Google của mình. Không có secret nào nằm trong code.

## Tính năng
Tổng quan (cá nhân vs DN, tách riêng) · Cá nhân/Doanh nghiệp (form thêm/sửa/xoá) · Nợ · Báo cáo tháng/quý · Forecast nợ 3-5 năm (trả tối thiểu / trả nhanh / % thu nhập, avalanche hoặc snowball, lãi riêng từng khoản) · Gợi ý cải thiện.
