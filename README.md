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
| Personal_CashFlow | id, date, type (Income/Expense/Transfer), category, amount, account, note, created_by, ref, tag (nhiều tag cách nhau dấu phẩy; cột mới — Sheet cũ cần thêm cột `tag` hoặc chạy lại `setup.gs`) |
| BM_CashFlow | Giống hệt Personal_CashFlow — sổ thu/chi của **Ví BM**, tab tuỳ chọn |
| Business_CashFlow | id, date, type (Revenue/Expense/Transfer), category, amount, counterparty, note, created_by, account, ref, tag |
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
- **Chỉ làm việc và đẩy code trên `claude/finflow-finance-manager-ra1340`.** Phiên mới có thể bị giao sẵn một nhánh tự sinh (phiên 2026-10 là `claude/focused-hamilton-01rkj1`) — chủ dự án đã xác nhận KHÔNG dùng nhánh đó: đầu phiên chạy `git fetch origin claude/finflow-finance-manager-ra1340 && git checkout claude/finflow-finance-manager-ra1340`, không tạo nhánh mới, không tạo PR.
- **Quy tắc đẩy code (chủ dự án đã cho phép sẵn):** sau mỗi lần làm xong, đẩy commit vào `claude/finflow-finance-manager-ra1340` để Vercel tự deploy — không cần hỏi lại.
- Kiểm tra: `npm install` (nếu mới clone), rồi `npm test` (hiện 110 test) và `npm run build`; chạy cả hai TRƯỚC khi đẩy (không nối bằng `;` với lệnh push). Logic nằm trong `src/lib/` (có test), giao diện trong `src/pages/` và `src/components/`.
- Quy ước làm việc với chủ dự án: trả lời tiếng Việt, ngắn gọn; mỗi thay đổi giao diện: build + test + chụp thử (Playwright) rồi đẩy lên nhánh trên. Chụp thử: chạy `npx vite --port 5199` nền rồi dùng Playwright (cài global, import từ `$(npm root -g)/playwright/index.mjs`, Chromium có sẵn); dữ liệu mẫu (demo) nằm trong localStorage khoá `finflow:v1:demo`. Máy chạy phiên không mở được web Vercel (proxy chặn) nên không tự xem được bản deploy; sau khi đẩy, nhắc chủ dự án đợi 1-2 phút và tải lại cứng (Ctrl+Shift+R).

## Cập nhật gần đây (phiên 2026-10)
**Menu:** Tổng quan · Báo cáo · Ví cá nhân (tab màu xanh ngọc, trước là "Cá nhân") · Nợ cá nhân · Nợ CN forecast (cùng màu xanh ngọc) · Tích lũy · Forecast Tích lũy · Doanh nghiệp · Ví BM · Nợ BM · Nợ BM Forecast (3 tab BM màu tím) · Cài đặt. "Ví BM" = ví **ba mẹ**.

**Sổ thu/chi (Ví cá nhân, Doanh nghiệp, Ví BM)** — `src/pages/CashFlow.jsx`:
- **Dropdown "📒 Ghi chép chi tiêu cá nhân"** (Doanh nghiệp: "Ghi chép thu / chi doanh nghiệp", Ví BM: "Ghi chép thu / chi Ví BM"; nền vàng nhạt, mặc định **đóng**) gồm bộ lọc Loại → Danh mục → Tag và tất cả các bảng giao dịch bên dưới; Ví cá nhân có thêm 2 khối nằm ngoài, mỗi khối một màu: Phân tích chi tiêu (xanh dương nhạt) và Dự đoán chi tiêu cá nhân (xanh ngọc). Thẻ tổng và thanh "đang bỏ tick" nằm ngoài dropdown, luôn hiện.
- Chia thành các bảng dropdown (mặc định **đóng**), mỗi bảng gom **Năm › Tháng › giao dịch**: ⬆ Tiền đi ra · 💳 Trả nợ BM · 💳 Trả nợ cá nhân · 💳 Trả nợ (dòng cũ; Ví BM/Doanh nghiệp gộp một bảng Trả nợ) · ⇄ Chuyển ví · ⬇ Tiền đi vào · 📈 Đầu tư (tiền vào) · 🏦 Quỹ BM · ↔ Chuyển nội bộ. Bảng trống (trừ Ra/Vào) bị ẩn.
- Ô tick = dòng **được tính vào các thẻ tổng** (Thu nhập, Chi, Dòng tiền ròng, mỗi tháng). Mặc định tick hết; bỏ tick từng dòng / cả tháng / cả năm / cả bảng thì thẻ tổng tính lại. Id dòng bỏ tick lưu trong trình duyệt (`useDebtSelection(kind)`), dòng mới thêm tự được tick. Khi có dòng bỏ tick hiện thanh với **Tick lại tất cả** và **Xoá N dòng bỏ tick** (không hoàn tác). Mỗi dòng vẫn có nút Xoá riêng.
- Danh sách **Năm** ở bộ lọc của từng sổ (Ví cá nhân, Doanh nghiệp, Ví BM) chỉ có các năm sổ đó có dữ liệu (cộng năm hiện tại); Tổng quan / Báo cáo / Nợ vẫn gộp cả ba ví.
- Cột **Loại** và bộ lọc Loại hiển thị khoản trả nợ là "Trả nợ" (dữ liệu vẫn lưu `Expense` + danh mục trả nợ để forecast nhận ra), chuyển khoản là "Chuyển nội bộ"; "Expense" trong bộ lọc không còn gồm các khoản trả nợ.
- **Bộ lọc Loại → Danh mục → Tag** (theo thứ tự này, ô sau chỉ liệt kê giá trị còn lại của các ô trước) ngay trên các bảng giao dịch (Ví cá nhân, Doanh nghiệp, Ví BM): chọn một giá trị mỗi ô (tag có thêm "Chưa gắn tag", kèm số dòng), các ô kết hợp bằng "và"; đổi Loại thì Danh mục / Tag không còn phù hợp tự về Tất cả; có nút Xoá bộ lọc và dòng "Hiển thị N/M giao dịch". Lựa chọn lấy từ các dòng trong kỳ đang lọc. Bộ lọc **chỉ lọc các bảng giao dịch**; thẻ tổng, Phân tích theo tag và forecast vẫn theo kỳ Năm / Quý / Tháng và ô tick.
- Thẻ tổng: Thu nhập, Chi (đỏ), Dòng tiền ròng + hàng 2 **Thu nhập / tháng**, **Chi / tháng** (**Thu nhập / tháng** = tổng thu ÷ số tháng từ dòng thu sớm nhất đến muộn nhất, tính cả tháng trống; **Chi / tháng và trung bình các thẻ Trả nợ dùng cùng khoảng tháng với thu nhập** — chỉ lấy khoản nằm trong khoảng đó, chia cho số tháng thu nhập; khoản chi / trả nợ nằm ngoài khoảng không tính và được ghi trên thẻ, vd. "9 tháng (T1/2026 → T9/2026, cùng kỳ thu nhập) · ngoài kỳ 2.000.000 ₫ không tính"; bấm **Xem** cạnh dòng "ngoài kỳ" trên thẻ để mở danh sách các khoản đó (ngày, loại, danh mục, tag, số tiền) kèm nút **Sửa** để đổi ngày; chưa có dòng thu thì chia theo khoảng của chính loại đó; theo các dòng đang tick và kỳ lọc). Ví cá nhân nền xanh ngọc, Ví BM nền tím (`tinted` trong `ui.jsx`). **Trả nợ tách riêng khỏi Chi**: thẻ Chi (và Chi / tháng) không gồm khoản Trả nợ; thẻ **Trả nợ** riêng (tổng, số khoản, trung bình/tháng, vẫn theo kỳ lọc và ô tick); ở **Ví cá nhân** tách thành 2 thẻ **Trả nợ BM** và **Trả nợ cá nhân** (hàng thứ 3), thêm thẻ "Trả nợ chưa phân loại BM / cá nhân" chỉ khi còn dòng "Trả nợ" cũ chưa tách; Doanh nghiệp / Ví BM giữ một thẻ Trả nợ; Dòng tiền ròng = Thu − Chi − Trả nợ (không đổi so với trước). Áp dụng cho cả Ví cá nhân, Doanh nghiệp, Ví BM. Chi vẫn **tính cả** Chuyển ví / Quỹ BM.
- Dropdown **Thẻ ngân hàng**: huy hiệu chữ 2-3 ký tự + màu (không dùng logo thương hiệu), dùng chung danh sách `Accounts` với trang Nhập sao kê (thêm 2 cột `badge`, `color` — Sheet cũ cần chạy lại `setup.gs`). Cột "Tài khoản" của giao dịch vẫn là chữ gõ tay.
- Nút **Nhập CSV** (`src/lib/csvImport.js`): cột `date,type,category,amount,account,note`; loại trùng, báo lỗi theo dòng, hỏi xác nhận trước khi ghi.
- Form thêm giao dịch: ô Loại có thêm lối tắt **Trả nợ** (lưu Expense + danh mục trả nợ). Ví cá nhân: Trả nợ chỉ có danh mục *Trả nợ BM* / *Trả nợ cá nhân*. Ví BM: danh mục Chi = Trả nợ, Chuyển ví, Chi phí sống; Thu = Chuyển ví, Quỹ BM (dòng cũ có danh mục khác vẫn giữ khi sửa). Đã **bỏ** nút "Xoá toàn bộ dữ liệu Ví BM".
- `isDebtPayment()` (schema.js) nhận cả "Trả nợ" cũ lẫn 2 danh mục mới nên Forecast/gợi ý vẫn loại khoản trả nợ khỏi chi cơ sở.

**Dự đoán chi tiêu cá nhân** (cuối trang Ví cá nhân; là **board 2**, dropdown mặc định **đóng** (bấm tiêu đề để mở), có bộ lọc Năm / Tháng riêng để lọc timeline, không theo bộ lọc kỳ của board 1 phía trên) — `src/components/SpendPlan.jsx`, `src/lib/spendPlan.js`: nhập thu nhập trung bình **riêng cho từng năm**, theo tháng hoặc năm (năm = tháng × 12; sang năm mới phải nhập lại, có nút "Dùng số năm trước" và nút lấy từ dữ liệu thực tế; chỉ hiện ô nhập của năm đang chọn; chọn "Tất cả năm" thì ô thu nhập, bảng quỹ và biểu đồ hiện **trung bình cộng** các năm đã nhập, không sửa được). Số thu nhập chung cũ được coi là của năm hiện tại. Thu nhập được chia theo 6 quỹ Need 60 · Want 10 · Edu 10 · Reserve 10 · Investment 5 · Giving 5 (%, sửa được); nút **＋ Thêm quỹ** để thêm quỹ tuỳ ý (muốn quỹ Trả nợ thì gõ tên đúng "Trả nợ") — tên + %, lưu trong `settings.spendPlan.extraFunds`, xoá bằng ✕ ở cuối dòng. Quỹ thêm có mặt ở mọi nơi: bảng %, biểu đồ kế hoạch, timeline, biểu đồ Thực tế phân bổ. Thực tế của quỹ thường = chi cá nhân có danh mục **trùng tên quỹ** (quỹ thêm tự có trong danh mục Chi của form giao dịch, đứng sau 6 quỹ mặc định); quỹ tên **"Trả nợ"** lấy thực tế từ các khoản Trả nợ BM / Trả nợ cá nhân / Trả nợ cũ (khi chưa có quỹ này, trả nợ không tính vào thực tế phân bổ). Hàm `fundsFrom`, `newFund`, `fundCategories` trong `src/lib/spendPlan.js`, ra bảng /tháng, /năm, **biểu đồ tròn** cơ cấu % và **timeline theo tháng (nằm ngang, mỗi tháng một cột)** cho 5 năm từ T1 của năm hiện tại (không có nút chọn horizon; mỗi năm đủ 12 tháng T1–T12; cột Tổng kỳ lọc nằm ngay sau cột Quỹ (cố định khi cuộn ngang) và hàng Tổng — tổng 12 tháng khớp cột "/ năm"). Lưu trong `settings` của trình duyệt (không nằm trong file sao lưu, chưa lên Sheet).

- Danh mục Chi của Ví cá nhân trong form chỉ còn: Need (mặc định), Want, Edu, Reserve, Investment, Giving (6 quỹ của Dự đoán chi tiêu cá nhân), Chuyển ví, Khác, và Trả nợ BM / Trả nợ cá nhân (chọn qua Loại "Trả nợ") (đã bỏ Nhà ở, Ăn uống, Đi lại, Hoá đơn, Giải trí, Sức khoẻ, Học tập, Mua sắm; dòng cũ đang dùng các danh mục này vẫn giữ nguyên và sửa được; quy tắc nhập sao kê gán vào danh mục đã bỏ bị bỏ qua → "Khác"). Danh sách cố định nằm trong `src/lib/schema.js`.

- Form thêm giao dịch ở **Ví cá nhân**: ô "Tài khoản / ví" mặc định là `Ví CH` (hằng `DEFAULT_PERSONAL_ACCOUNT` trong `EntryForm.jsx`); sửa dòng cũ giữ nguyên giá trị đã lưu; Ví BM và Doanh nghiệp vẫn để trống.
- **Tag** (`src/lib/tags.js`): mỗi giao dịch có ô Tag, nhiều tag cách nhau bằng dấu phẩy (vd. `du lịch, gia đình`), dùng để phân loại / làm biểu đồ sau này. Form hiện các tag đã dùng trong sổ đó để bấm gắn nhanh; bảng giao dịch có cột Tag; **Nhập CSV** nhận thêm cột `tag` (tuỳ chọn). **Phân tích chi tiêu cá nhân** (dropdown mặc định đóng, nền xanh dương nhạt để phân biệt với board forecast xanh ngọc, Ví cá nhân, `src/components/TagAnalysis.jsx`): **biểu đồ tròn** chi theo tag, kèm chú thích số tiền và %; tính trên các dòng chi đúng kỳ lọc Năm / Quý / Tháng và đang tick, **không gồm khoản Trả nợ** (cùng cách tính với thẻ Chi nên tổng khớp thẻ Chi; Chuyển ví vẫn tính). Tối đa 7 tag lớn nhất có màu riêng, các tag còn lại gộp một lát xám "Các tag nhỏ khác" trên biểu đồ nhưng **vẫn liệt kê từng tag nhỏ ngay dưới trong chú thích** (tick riêng được; tick dòng nhóm = chọn cả nhóm), dòng chưa gắn tag là lát xám nhạt. Giao dịch nhiều tag được **chia đều** tiền cho các tag (để tổng = 100%). **Chọn nhiều tag để xem tổng %**: tick trong chú thích (hoặc bấm lát trên biểu đồ); biểu đồ vẫn đủ 100% tổng chi, lát được chọn nổi bật, lát khác mờ đi; giữa vòng tròn và dòng cuối hiện tổng % + số tiền của các tag đã chọn trên tổng chi; có nút Chọn tất cả / Bỏ chọn; trạng thái chọn không lưu khi tải lại. Logic ở `tagBreakdown` / `pieSlices` trong `src/lib/tags.js`. Nhập sao kê chưa gán tag tự động.

**Ô tick "Hiển thị so sánh KH/TT"** (cạnh bộ lọc Năm / Tháng của board 2, mặc định tắt): tắt thì chỉ có kế hoạch (timeline 6 quỹ + Tổng); bật thì hiện thêm biểu đồ + bảng "Thực tế phân bổ theo quỹ" và các dòng so sánh trong timeline.
- **Timeline so sánh từng quỹ** (khi bật so sánh): mỗi quỹ có 4 dòng liền nhau — **KH** (kế hoạch), **Thực tế**, **KH − TT** (dương xanh = còn trong ngân sách, âm đỏ = vượt kế hoạch) và **% so KH** kiểu chứng khoán = (KH − TT) / KH với ▲ xanh (còn trong ngân sách) / ▼ đỏ (vượt KH), "—" khi KH = 0 — để so sánh từng cặp; sau 6 quỹ là dòng "Chưa phân quỹ" (chỉ thực tế) rồi Tổng KH / Tổng thực tế / Tổng KH − TT / Tổng % so KH. Cột Tổng kỳ lọc nằm ngay sau cột Quỹ, cả hai cố định khi cuộn ngang.
- **Thực tế phân bổ theo quỹ** (trong board 2, ngay dưới biểu đồ kế hoạch; chỉ hiện khi bật "Hiển thị so sánh KH/TT"): biểu đồ tròn chi thật theo quỹ + danh sách quỹ (số tiền, %). **Bấm một vùng màu (hoặc một dòng quỹ)** để hiện bên cạnh các **tag con** của quỹ đó: số tiền, % trong quỹ, số giao dịch (+ "Chưa gắn tag"); bấm lại để bỏ chọn; giao dịch nhiều tag chia đều tiền. Không còn bảng so sánh KH % / TT % (so sánh KH/TT nằm ở timeline). Thực tế = chi cá nhân thật có danh mục Need / Want / Edu / Reserve / Investment / Giving, **theo bộ lọc Năm / Tháng của board 2** (không theo kỳ lọc board 1; ô tick **"Tính đến [Tháng N]"** chỉ lấy từ T1 đến hết tháng N của **mỗi năm**); vẫn theo ô tick; không gồm Chuyển ví và (nếu chưa thêm quỹ Trả nợ) Trả nợ; chi có danh mục khác (dòng cũ) vào lát xám "Chưa phân quỹ" (cũng bấm xem tag được). Logic `actualByFund`, `actualFundTags` trong `src/lib/spendPlan.js`.

**Nợ / Nợ BM:** cột **Trả / năm** (= Trả / tháng × 12) cạnh Trả / tháng trong bảng và thẻ khoản nợ trên điện thoại; thẻ "Trả tối thiểu / tháng" có thêm dòng "= … / năm"; thẻ **Lãi phát sinh / năm** (= lãi tháng × 12); dropdown "Kịch bản N năm & thống kê trả nợ" (mặc định đóng): trả gốc + lãi đều trong 10-30 năm → trả/tháng, tổng phải trả, tổng lãi, theo từng khoản và tổng; cột "Kịch bản" trong bảng.

## Việc chưa làm / cần quyết (phiên sau)
- **Dòng "Trả nợ" cũ chưa tách BM / cá nhân** (Ví cá nhân): sửa từng dòng sang Trả nợ BM / Trả nợ cá nhân, hoặc xoá và nhập lại bằng CSV.
- Cột "Tài khoản" trong bảng giao dịch chưa hiện huy hiệu và form chưa chọn thẻ từ danh sách thẻ (đang gõ tay).
- Nhập sao kê vào Ví BM vẫn mặc định danh mục "Khác" cho dòng không khớp quy tắc.
- Trạng thái mở/đóng các dropdown không lưu (tải lại là đóng hết).
- Danh mục "Ba Hoà" trong file thu nhập 2026 đang gán **Khác** (chủ dự án chưa chọn; có thể đổi sang Side project). Các ô có chú thích ẩn trong bảng Excel gốc chưa đưa vào.
- Thẻ tổng Chi: đã tách Trả nợ ra thẻ riêng; **chưa loại Chuyển ví / Quỹ BM** khỏi Chi (chờ chủ dự án quyết).
- Doanh nghiệp chưa có màu riêng (Ví cá nhân xanh ngọc, Ví BM tím).
- Hàm `clearKind` (xoá toàn bộ một sổ) còn trong `store.jsx` nhưng không còn nút gọi.
- **Nhớ trạng thái giao diện khi tải lại:** ô tick "Hiển thị so sánh KH/TT", "Tính đến [Tháng N]", năm/tháng lọc của board 2, các tag đang chọn trong Phân tích chi tiêu, bộ lọc Loại/Danh mục/Tag (hiện đều không lưu).
- **Nhập sao kê chưa tự gán** danh mục quỹ (Need/Want/…) và tag theo từ khoá (quy tắc hiện chỉ gán danh mục; quy tắc trỏ tới danh mục đã bỏ bị bỏ qua → "Khác").
- **Giao dịch cũ chưa có tag / chưa có danh mục quỹ:** sửa từng dòng hoặc nhập lại bằng CSV (`tag` và `category` là Need/Want/Edu/Reserve/Investment/Giving) thì biểu đồ Thực tế phân bổ và Phân tích theo tag mới đầy đủ; còn lại hiện là "Chưa phân quỹ" / "Chưa gắn tag".
- **Cần quyết:** thẻ tổng Chi và bộ lọc Loại/Danh mục/Tag có nên nối với nhau không (hiện bộ lọc chỉ lọc các bảng giao dịch); Tổng quan / Báo cáo có theo ô tick không (hiện chỉ trang sổ thu/chi); Phân tích theo tag có loại cả **Chuyển ví** không (hiện chỉ loại Trả nợ — chủ dự án sẽ dùng dữ liệu trả nợ ở chỗ khác); TT % của biểu đồ Thực tế phân bổ có bỏ "Chưa phân quỹ" khỏi mẫu số không; mũi tên ▲▼ của dòng "% so KH" đang theo quy ước ▲ xanh = còn trong ngân sách (có thể đổi ▲ = chi vượt); tách "Trả nợ" thành lát riêng / tăng số tag có màu riêng (đang 7) trong biểu đồ tag.
- Thu nhập dự kiến từng năm (`settings.spendPlan`) và trạng thái chọn lưu trong trình duyệt, **không nằm trong file sao lưu `.json`** và chưa lên Sheet. Cột `tag` mới ở các tab thu/chi: nếu bật lại Google Sheets cần thêm cột `tag` hoặc chạy lại `setup.gs`.
- Các mục "Chưa làm" cũ ở trên vẫn còn hiệu lực.

## Việc cần làm để kết thúc phiên (chủ dự án)
Tóm tắt phiên 2026-10: đổi tên + màu tab Nợ cá nhân / Nợ CN forecast; tab Doanh nghiệp cạnh Ví BM; ô tick thẻ tổng (bỏ tick năm/tháng/dòng thì Thu/Chi tính lại); bộ lọc Năm chỉ có năm có dữ liệu; danh mục Chi Ví cá nhân = 6 quỹ + Chuyển ví + Khác; Tag + bộ lọc Loại → Danh mục → Tag; cột Loại hiện "Trả nợ"; **Phân tích chi tiêu cá nhân** (biểu đồ tròn theo tag, chọn nhiều tag, không gồm Trả nợ); **board 2 Dự đoán chi tiêu cá nhân** (thu nhập từng năm, timeline ngang 5 năm, so sánh KH/TT với dòng KH − TT và % ▲▼, biểu đồ Thực tế phân bổ, tính đến tháng N).

1. Chờ Vercel deploy xong nhánh `claude/finflow-finance-manager-ra1340` (1–2 phút), mở https://finflow-dusky-five.vercel.app/ và **tải lại cứng** (Ctrl+Shift+R). Kiểm tra: Ví cá nhân (thẻ tổng, bộ lọc, Phân tích chi tiêu, board 2), tab Doanh nghiệp / Ví BM, Nợ cá nhân.
2. Bấm **⬇ Sao lưu** lưu file `finflow-backup-ngày.json` (dữ liệu chỉ nằm trong trình duyệt, mất nếu xoá dữ liệu trình duyệt / ẩn danh / đổi máy). Lưu ý: thu nhập dự kiến từng năm của board 2 **không** nằm trong file sao lưu — ghi lại số đã nhập (năm 2026 đang là 44.479.813 ₫/tháng).
3. Gắn **danh mục quỹ** (Need/Want/Edu/Reserve/Investment/Giving) và **tag** cho các khoản chi để biểu đồ Thực tế phân bổ và Phân tích theo tag có số liệu đầy đủ (sửa từng dòng hoặc nhập lại bằng CSV).
4. Nếu chưa nhập thu nhập 2026: tab Ví cá nhân → **Nhập CSV** → file `thu-nhap-2026.csv` (45 dòng, tổng 475.135.587 ₫, ngày cuối tháng; file nằm ngoài repo, không commit vì là dữ liệu cá nhân — nếu mất, dựng lại từ bảng Excel gốc theo định dạng CSV ở trên). Muốn làm lại từ đầu: bỏ tick hết các bảng → **Xoá N dòng bỏ tick** **trước**, rồi mới nhập CSV.
5. **Xoá nhánh thừa** `claude/stoic-wright-816kzb` và `claude/focused-hamilton-01rkj1` trên GitHub (https://github.com/ChanTuDinh/finflow/branches → biểu tượng thùng rác). Phiên máy chủ không xoá được nhánh từ môi trường chạy phiên.
6. Mọi thay đổi đã nằm trên nhánh `claude/finflow-finance-manager-ra1340`; chưa merge vào `main`, chưa tạo PR. Phiên sau: đọc mục "Việc chưa làm / cần quyết", chọn việc, rồi làm tiếp trên cùng nhánh.
