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
| Personal_CashFlow | id, date, type (Income/Expense/Transfer), category, amount, account, note, created_by, ref |
| Business_CashFlow | id, date, type (Revenue/Expense/Transfer), category, amount, counterparty, note, created_by, account, ref |
| Debts | id, name, lender, owner (Personal/Business), balance, apr (%/năm), min_payment (số tiền trả mỗi tháng), due_day, status (Active/Paid), note, repay_type (`Trả gốc và lãi` / `Trả lãi only`), term_months (số tháng còn lại) |
| Debts_BM | Giống Debts (`owner` có thêm giá trị `BM`) + `record_date`, `repay_type`, `term_months` (ngày ghi nhận, yyyy-mm-dd) — nguồn nợ thứ hai ("Nợ BM"), tách riêng, tab tuỳ chọn |
| Debt_Payments | id, date, source (`debts`/`debts_bm`), debt_id, debt_name, type (Trả gốc / Trả lãi / Gốc + lãi), amount, principal, interest, balance_after, note, created_by, adjust_prev — lịch sử trả nợ do app ghi, tab tuỳ chọn |
| Savings | id, name, type, owner, balance, monthly_contribution, annual_return (%/năm), goal_id, status (Active/Closed), note |
| Accounts | id, name, bank, owner, preset, status, note (tài khoản ngân hàng; `preset` do app tự lưu) |
| Rules | id, keyword, category, direction (out/in/any), owner |
| Goals | id, name, owner, target_amount, target_date (yyyy-mm-dd), status (Active/Done), note |

`Savings`, `Goals`, `Accounts`, `Rules` là tab tuỳ chọn: Sheet cũ chưa có thì app vẫn chạy, chỉ cần chạy lại `setup.gs` (không xoá dữ liệu tab đã có) để thêm. `goal_id` trong Savings trỏ tới `id` trong Goals.

Quy ước: `date` dạng `yyyy-mm-dd`; `amount` là số dương (loại thu/chi nằm ở cột `type`); `id` bất kỳ, duy nhất (nhập tay thì cứ đặt p101, p102…). Tiền trả nợ ghi là Expense với category `Trả nợ` — forecast loại khoản này khỏi chi cơ sở để không tính trùng.

## 2. Kết nối
1. Google Cloud Console → tạo project → bật **Google Sheets API**.
2. Credentials → OAuth client ID (Web application); thêm `http://localhost:5173` (và domain deploy) vào *Authorized JavaScript origins*. Màn hình consent: thêm 1-2 người dùng chung vào *Test users*.
3. Copy `.env.example` → `.env`, điền `VITE_GOOGLE_CLIENT_ID` (hoặc nhập trong tab Cài đặt cùng Spreadsheet ID).
4. Share Sheet (Editor) cho người dùng chung; mỗi người đăng nhập bằng tài khoản Google của mình. Không có secret nào nằm trong code.

## Tính năng
Tổng quan (cá nhân vs DN, tách riêng) · Xem theo Năm › Quý › Tháng (bấm xuống từng cấp) · Cá nhân/Doanh nghiệp (form thêm/sửa/xoá) · Nợ · Báo cáo tháng/quý · Forecast nợ 3-5 năm (trả tối thiểu / trả nhanh / % thu nhập, avalanche hoặc snowball, lãi riêng từng khoản) · Gợi ý cải thiện · Tích lũy & mục tiêu · Forecast Tích lũy (tài sản sau 3-5 năm, bao lâu đạt mục tiêu, trả nợ nhanh vs tích lũy).

## Nhập sao kê nhiều ngân hàng
Cá nhân / Doanh nghiệp › **Nhập sao kê**.
1. Thêm mỗi tài khoản ngân hàng một lần (chọn thuộc Cá nhân hay Doanh nghiệp).
2. Chọn tài khoản → chọn file `.xlsx` / `.csv` tải từ app ngân hàng. Lần đầu, kiểm tra các cột app tự nhận (ngày, nội dung, chi/thu hoặc một cột số tiền có dấu, mã giao dịch); sau khi nhập app nhớ cách đọc cho tài khoản đó.
3. Xem trước: danh mục tự gán theo **quy tắc từ khóa** (bấm “＋ quy tắc” để dạy app), giao dịch đã có bị bỏ chọn (**loại trùng**), cặp chi–thu cùng số tiền giữa 2 tài khoản của bạn trong ±2 ngày được đánh dấu **Chuyển nội bộ** (kể cả khi 2 ngân hàng nhập ở 2 lần khác nhau, hoặc cá nhân ↔ doanh nghiệp) và không tính vào thu/chi.
4. Bấm Nhập. File sao kê được đọc hoàn toàn trong trình duyệt; chỉ các giao dịch bạn duyệt mới ghi vào Sheet. File `.xls` cũ: mở bằng Excel, lưu lại thành `.xlsx`.

## Nhập khoản nợ và để tool tính lãi suất
Khi thêm khoản nợ, chọn **Hình thức trả**, nhập dư nợ và số tiền trả mỗi tháng; để “Lãi suất: Tool tự tính”:
- **Trả lãi only**: lãi suất = 12 × tiền lãi mỗi tháng ÷ dư nợ (không cần số tháng).
- **Trả gốc và lãi**: nhập thêm **số tháng còn lại**; tool suy ra lãi suất từ khoản trả đều hàng tháng. (Chỉ có dư nợ và số tiền trả thì chưa đủ để tính — cần biết khoản vay còn bao lâu.)
Lãi suất là lãi danh nghĩa theo năm (lãi tháng × 12), cùng cách tính với phần Forecast. Nếu ngân hàng cho sẵn lãi suất, chọn “Tôi tự nhập”. Với khoản chỉ trả lãi, Forecast mô phỏng mỗi tháng trả đúng tiền lãi (dư nợ không giảm cho tới khi trả thêm gốc); chưa tính việc tất toán gốc một lần khi đáo hạn.

## Ghi khoản trả nợ
Ở tab Nợ / Nợ BM, bấm **Ghi khoản trả** ở khoản nợ: nhập ngày, tổng số tiền, và chọn *Trả gốc* (toàn bộ vào gốc), *Trả lãi* (dư nợ không đổi) hoặc *Gốc + lãi* (tool tách: lãi một tháng trước, còn lại vào gốc). Tool lưu vào tab `Debt_Payments`, tự trừ dư nợ, và với khoản “Trả lãi only” tự tính lại tiền lãi hàng tháng. Xoá một lần trả sẽ hoàn lại phần gốc. Với khoản *Trả gốc và lãi*, sau khi trả bớt gốc bạn chọn ngân hàng xử lý thế nào: *giữ tiền trả mỗi tháng, rút ngắn thời hạn* hoặc *giữ thời hạn, giảm tiền trả mỗi tháng* (tool tự tính lại Trả/tháng hoặc Số tháng còn lại; xoá lần trả sẽ hoàn lại). Ô “ghi thêm vào dòng tiền” để tắt nếu bạn nhập sao kê ngân hàng (tránh tính trùng).
