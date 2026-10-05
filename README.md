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
| BM_CashFlow | Giống hệt Personal_CashFlow — sổ thu/chi của **Ví BM**, tab tuỳ chọn |
| Business_CashFlow | id, date, type (Revenue/Expense/Transfer), category, amount, counterparty, note, created_by, account, ref |
| Debts | id, name, lender, owner (Personal/Business), balance, apr (%/năm), min_payment (số tiền trả mỗi tháng), due_day, status (Active/Paid), note, repay_type (`Trả gốc và lãi` / `Trả lãi only`), term_months (số tháng còn lại) |
| Debts_BM | Giống Debts (`owner` có thêm giá trị `BM`) + `record_date`, `repay_type`, `term_months` (ngày ghi nhận, yyyy-mm-dd) — nguồn nợ thứ hai ("Nợ BM"), tách riêng, tab tuỳ chọn |
| Debt_Payments | id, date, source (`debts`/`debts_bm`), debt_id, debt_name, type (Trả gốc / Trả lãi / Gốc + lãi), amount, principal, interest, balance_after, note, created_by, adjust_prev — lịch sử trả nợ do app ghi, tab tuỳ chọn |
| Savings | id, name, type, owner, balance, monthly_contribution, annual_return (%/năm), goal_id, status (Active/Closed), note |
| Accounts | id, name, bank, owner, preset, status, note, badge, color (tài khoản/thẻ ngân hàng; `preset` do app tự lưu; `badge` = huy hiệu 2-3 chữ, `color` = màu #rrggbb hiện ở thẻ trên tab Ví cá nhân) |
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
Ở tab Nợ / Nợ BM, bấm **Ghi khoản trả** ở khoản nợ: nhập ngày, tổng số tiền, và chọn *Trả gốc* (toàn bộ vào gốc), *Trả lãi* (dư nợ không đổi) hoặc *Gốc + lãi* (tool tách: lãi một tháng trước, còn lại vào gốc). Tool lưu vào tab `Debt_Payments`, tự trừ dư nợ, và với khoản “Trả lãi only” tự tính lại tiền lãi hàng tháng. Bảng Lịch sử hiện ghi chú và cách điều chỉnh đã chọn của từng lần trả. **Sửa** lần trả mới nhất của một khoản nợ: đổi được cả số tiền/loại/cách điều chỉnh (tool hoàn lại rồi áp lại); các lần cũ hơn chỉ sửa được ngày và ghi chú. Xoá một lần trả sẽ hoàn lại phần gốc. Với khoản *Trả gốc và lãi*, sau khi trả bớt gốc bạn chọn ngân hàng xử lý thế nào: *giữ tiền trả mỗi tháng, rút ngắn thời hạn* hoặc *giữ thời hạn, giảm tiền trả mỗi tháng* (tool tự tính lại Trả/tháng hoặc Số tháng còn lại; xoá lần trả sẽ hoàn lại). Nếu ngân hàng chuyển sang chỉ thu lãi hàng tháng, chọn *Chuyển sang chỉ trả lãi* và nhập tiền lãi thực tế: tool đổi hình thức khoản nợ và suy ngược lãi suất (lãi × 12 ÷ dư nợ) để so với lãi suất đang lưu, cảnh báo nếu lệch (khi đó nên đối chiếu lại dư nợ gốc còn lại với sao kê). Khoản đã *Trả lãi only* cũng có phần này (*Điều chỉnh lãi suất / tiền lãi*): sau khi trả bớt gốc bạn giữ lãi suất, suy ra từ tiền lãi thực tế, hoặc nhập lãi suất mới; sửa lại lần trả sau này vẫn đổi được. Ô “ghi thêm vào dòng tiền” để tắt nếu bạn nhập sao kê ngân hàng (tránh tính trùng).

## Dữ liệu lưu ở đâu? Sao lưu
- **Địa chỉ đang dùng: https://finflow-dusky-five.vercel.app/** — dữ liệu trình duyệt gắn với từng địa chỉ riêng, chỉ dùng địa chỉ này (địa chỉ khác như `finflow-janie7.vercel.app` sẽ không thấy dữ liệu).
- **Mặc định: chỉ lưu trong trình duyệt** (tắt trình duyệt vẫn còn; **mất** nếu xoá dữ liệu trình duyệt, dùng ẩn danh hoặc đổi máy; người khác không thấy).
- **Sao lưu**: nút **⬇ Sao lưu** ở đầu trang (đổi màu vàng nếu chưa sao lưu hoặc quá 7 ngày) hoặc Cài đặt › Tải file sao lưu → `finflow-backup-ngày.json`. Trình duyệt khác: Cài đặt › Khôi phục từ file sao lưu. "Xoá toàn bộ dữ liệu…" tự tải sao lưu trước.
- **Google Sheets đang ẩn** (code còn nguyên, các mục 1–2 ở trên chỉ cần khi bật lại): đặt biến môi trường `VITE_ENABLE_SHEETS=true` trên Vercel rồi deploy lại. Kết nối không ghi đè dữ liệu trình duyệt; Cài đặt có nút "Đưa lên Google Sheet" (chỉ thêm dòng chưa có, thiếu tab thì không ghi). Mới test với API giả lập, chưa test với Google thật.

## Trạng thái và việc chưa làm
- Làm việc trên nhánh `claude/finflow-finance-manager-ra1340` (chưa merge vào `main`); Vercel cần trỏ Production Branch vào nhánh này. Phiên mới: lấy bản mới nhất của nhánh và đọc file này là đủ.
- **Quy tắc đẩy code (chủ dự án đã cho phép sẵn):** sau mỗi lần làm xong, đẩy commit vào `claude/finflow-finance-manager-ra1340` để Vercel tự deploy — không cần hỏi lại.
- Kiểm tra: `npm test` và `npm run build`. Logic nằm trong `src/lib/` (có test), giao diện trong `src/pages/` và `src/components/`.
- Quy ước làm việc với chủ dự án: trả lời tiếng Việt, ngắn gọn; mỗi thay đổi giao diện: build + test + chụp thử (Playwright) rồi đẩy lên nhánh trên. Máy chạy phiên không mở được web Vercel (proxy chặn) nên không tự xem được bản deploy; sau khi đẩy, nhắc chủ dự án đợi 1-2 phút và tải lại cứng (Ctrl+Shift+R).

## Cập nhật gần đây (phiên 2026-10)
**Menu:** Tổng quan · Báo cáo · Ví cá nhân (tab màu xanh ngọc, trước là "Cá nhân") · Nợ cá nhân · Nợ CN forecast (cùng màu xanh ngọc) · Tích lũy · Forecast Tích lũy · Doanh nghiệp · Ví BM · Nợ BM · Nợ BM Forecast (3 tab BM màu tím) · Cài đặt. "Ví BM" = ví **ba mẹ**.

**Sổ thu/chi (Ví cá nhân, Doanh nghiệp, Ví BM)** — `src/pages/CashFlow.jsx`:
- Chia thành các bảng dropdown (mặc định **đóng**), mỗi bảng gom **Năm › Tháng › giao dịch**: ⬆ Tiền đi ra · 💳 Trả nợ BM · 💳 Trả nợ cá nhân · 💳 Trả nợ (dòng cũ; Ví BM/Doanh nghiệp gộp một bảng Trả nợ) · ⇄ Chuyển ví · ⬇ Tiền đi vào · 📈 Đầu tư (tiền vào) · 🏦 Quỹ BM · ↔ Chuyển nội bộ. Bảng trống (trừ Ra/Vào) bị ẩn.
- Ô tick chọn từng dòng / cả tháng / cả năm / cả bảng, nút **Xoá đã chọn** (không hoàn tác; dòng đang đóng vẫn có thể đang được chọn — xem số N trên thanh).
- Thẻ tổng: Thu nhập, Chi (đỏ), Dòng tiền ròng + hàng 2 **Thu nhập / tháng**, **Chi / tháng** (trung bình theo số tháng từ giao dịch đầu đến cuối, tính cả tháng trống). Ví cá nhân nền xanh ngọc, Ví BM nền tím (`tinted` trong `ui.jsx`). Thẻ Chi tổng vẫn **tính cả** Trả nợ / Chuyển ví / Quỹ BM.
- Dropdown **Thẻ ngân hàng**: huy hiệu chữ 2-3 ký tự + màu (không dùng logo thương hiệu), dùng chung danh sách `Accounts` với trang Nhập sao kê (thêm 2 cột `badge`, `color` — Sheet cũ cần chạy lại `setup.gs`). Cột "Tài khoản" của giao dịch vẫn là chữ gõ tay.
- Nút **Nhập CSV** (`src/lib/csvImport.js`): cột `date,type,category,amount,account,note`; loại trùng, báo lỗi theo dòng, hỏi xác nhận trước khi ghi.
- Form thêm giao dịch: ô Loại có thêm lối tắt **Trả nợ** (lưu Expense + danh mục trả nợ). Ví cá nhân: Trả nợ chỉ có danh mục *Trả nợ BM* / *Trả nợ cá nhân*. Ví BM: danh mục Chi = Trả nợ, Chuyển ví, Chi phí sống; Thu = Chuyển ví, Quỹ BM (dòng cũ có danh mục khác vẫn giữ khi sửa). Đã **bỏ** nút "Xoá toàn bộ dữ liệu Ví BM".
- `isDebtPayment()` (schema.js) nhận cả "Trả nợ" cũ lẫn 2 danh mục mới nên Forecast/gợi ý vẫn loại khoản trả nợ khỏi chi cơ sở.

**Chi tiêu cá nhân forecast** (cuối trang Ví cá nhân; là **board 2** luôn hiện, có bộ lọc Năm / Tháng riêng để lọc timeline, không theo bộ lọc kỳ của board 1 phía trên) — `src/components/SpendPlan.jsx`, `src/lib/spendPlan.js`: nhập thu nhập trung bình theo tháng hoặc năm (năm = tháng × 12; có nút lấy từ dữ liệu thực tế), chia theo 6 quỹ Need 60 · Want 10 · Edu 10 · Reserve 10 · Investment 5 · Giving 5 (%, sửa được), ra bảng /tháng, /năm, **biểu đồ tròn** cơ cấu % và **timeline theo tháng (nằm ngang, mỗi tháng một cột)** với horizon chọn 1/2/3/5 năm tính từ T1 của năm hiện tại (mỗi năm đủ 12 tháng T1–T12; có cột Tổng kỳ lọc, hàng Tổng và Lũy kế — tổng 12 tháng khớp cột "/ năm"). Lưu trong `settings` của trình duyệt (không nằm trong file sao lưu, chưa lên Sheet).

**Nợ / Nợ BM:** thẻ **Lãi phát sinh / năm** (= lãi tháng × 12); dropdown "Kịch bản N năm & thống kê trả nợ" (mặc định đóng): trả gốc + lãi đều trong 10-30 năm → trả/tháng, tổng phải trả, tổng lãi, theo từng khoản và tổng; cột "Kịch bản" trong bảng.

## Việc chưa làm / cần quyết (phiên sau)
- **Dòng "Trả nợ" cũ chưa tách BM / cá nhân** (Ví cá nhân): sửa từng dòng sang Trả nợ BM / Trả nợ cá nhân, hoặc xoá và nhập lại bằng CSV.
- Cột "Tài khoản" trong bảng giao dịch chưa hiện huy hiệu và form chưa chọn thẻ từ danh sách thẻ (đang gõ tay).
- Nhập sao kê vào Ví BM vẫn mặc định danh mục "Khác" cho dòng không khớp quy tắc.
- Trạng thái mở/đóng các dropdown không lưu (tải lại là đóng hết).
- Danh mục "Ba Hoà" trong file thu nhập 2026 đang gán **Khác** (chủ dự án chưa chọn; có thể đổi sang Side project). Các ô có chú thích ẩn trong bảng Excel gốc chưa đưa vào.
- Thẻ tổng Chi/Thu: chưa loại Chuyển ví / Quỹ BM / Trả nợ khỏi tổng (chờ chủ dự án quyết).
- Doanh nghiệp chưa có màu riêng (Ví cá nhân xanh ngọc, Ví BM tím).
- Hàm `clearKind` (xoá toàn bộ một sổ) còn trong `store.jsx` nhưng không còn nút gọi.
- Các mục "Chưa làm" cũ ở trên vẫn còn hiệu lực.

## Việc cần làm để kết thúc phiên (chủ dự án)
1. Chờ Vercel deploy xong nhánh `claude/finflow-finance-manager-ra1340`, mở https://finflow-dusky-five.vercel.app/ và tải lại cứng; kiểm tra Ví cá nhân, Ví BM, Nợ BM hiển thị đúng.
2. Bấm **⬇ Sao lưu** lưu file `finflow-backup-ngày.json` (dữ liệu chỉ nằm trong trình duyệt, mất nếu xoá dữ liệu trình duyệt / ẩn danh / đổi máy).
3. Nếu chưa nhập thu nhập 2026: tab Ví cá nhân → **Nhập CSV** → file `thu-nhap-2026.csv` (45 dòng, tổng 475.135.587 ₫, ngày cuối tháng; file nằm ngoài repo, không commit vì là dữ liệu cá nhân — nếu mất, dựng lại từ bảng Excel gốc theo định dạng CSV ở trên). Muốn làm lại từ đầu: tick hết các bảng → Xoá đã chọn **trước**, rồi mới nhập CSV.
4. **Xoá nhánh thừa** `claude/stoic-wright-816kzb` trên GitHub (https://github.com/ChanTuDinh/finflow/branches → biểu tượng thùng rác). Phiên này không xoá được từ máy chạy phiên (kết nối bị ngắt khi xoá nhánh).
5. Mọi thay đổi đã nằm trên nhánh `claude/finflow-finance-manager-ra1340`; chưa merge vào `main`, chưa tạo PR.
