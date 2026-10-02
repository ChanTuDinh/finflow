# FinFlow — bàn giao

Nhánh làm việc: `claude/finflow-finance-manager-ra1340` (chưa merge vào `main`). Triển khai: Vercel (Hobby, miễn phí) — cần trỏ **Production Branch** vào nhánh này hoặc merge vào `main`.
Chạy thử: `npm install && npm run dev` · kiểm tra: `npm test` (node --test, logic thuần) và `npm run build`.

## Cách lưu dữ liệu (quan trọng)
- **Mặc định: chỉ lưu trong trình duyệt** (localStorage, khoá `finflow:v1:*`). Mất nếu xoá dữ liệu trình duyệt / ẩn danh / đổi máy. Người khác không thấy.
- **Sao lưu**: nút `⬇ Sao lưu` ở đầu trang (đổi màu vàng nếu chưa sao lưu hoặc quá 7 ngày) và Cài đặt › Tải file sao lưu → `finflow-backup-ngày.json`. Khôi phục: Cài đặt › Khôi phục từ file. `Xoá toàn bộ dữ liệu…` tự tải sao lưu trước.
- **Google Sheets đang ẩn** (code còn nguyên). Bật: biến môi trường `VITE_ENABLE_SHEETS=true` + deploy lại; cần OAuth Client ID (xem `README.md`). Kết nối không ghi đè dữ liệu trình duyệt; có nút "Đưa lên Google Sheet" (dedupe theo id, thiếu tab thì không ghi). Phần Sheets chỉ được test với API giả lập, **chưa test với Google thật**.

## Các tab (thứ tự menu)
Tổng quan · Cá nhân · Doanh nghiệp · **Ví BM · Nợ BM · Nợ BM Forecast** (tô tím, xếp cạnh nhau) · Nợ · Forecast Nợ · Tích lũy · Forecast Tích lũy · Báo cáo · Cài đặt.
- **Bộ lọc dùng chung** (`FilterBar`): Năm / Quý / Tháng (mặc định *Tất cả năm*) + "Xem theo" (Tháng|Quý|Năm|Ngày); bấm cột/dòng ở Báo cáo, Tổng quan để xuống cấp con. Logic: `src/lib/period.js`.
- **Cá nhân / Doanh nghiệp / Ví BM**: sổ thu-chi (`Income|Revenue|Expense|Transfer`). `Transfer` (chuyển nội bộ) không tính vào thu/chi. Ví BM = cùng cấu trúc Cá nhân, dữ liệu tách riêng (`bm`), có nút xoá toàn bộ.
- **Nhập sao kê** (`src/pages/Import.jsx`, `importParse.js`, `importLogic.js`): .xlsx/.csv, tự nhận cột, nhớ cách đọc theo tài khoản, quy tắc từ khoá → danh mục, loại trùng (mã GD hoặc ngày+tiền+nội dung), ghép chuyển nội bộ ±2 ngày (kể cả giữa các sổ và với giao dịch đã có). Tài khoản có chủ Personal/Business/BM.
- **Nợ / Nợ BM** (`src/pages/Debts.jsx`, cùng component, prop `kind`): hình thức *Trả gốc và lãi* / *Trả lãi only*; form tự tính lãi suất từ dư nợ + tiền trả + số tháng (`rate.js`), hoặc ước tính số tháng còn lại khi biết lãi suất. Cột Lãi % tô vàng. Ô tick khoản nợ → số liệu và Forecast chỉ tính các khoản đã tick. Nợ BM có `owner` Personal|Business|BM và `record_date`.
- **Ghi khoản trả** (`PaymentForm.jsx`, `payments.js`): một số tổng → tách gốc/lãi (Trả gốc | Trả lãi | Gốc + lãi). Tự trừ dư nợ; khoản gốc+lãi chọn cách điều chỉnh (rút ngắn thời hạn / giảm tiền trả / chuyển sang chỉ trả lãi / không đổi); khoản đã chỉ trả lãi chọn *Điều chỉnh lãi suất / tiền lãi* (giữ / suy ra / nhập lãi mới). Lịch sử có ghi chú + mô tả điều chỉnh; Sửa (lần mới nhất sửa được tất cả, lần cũ chỉ ngày/ghi chú) và Xoá (hoàn lại cả điều chỉnh qua `adjust_prev`). Ô tick trong lịch sử = lần trả được tính vào dư nợ (bỏ tick → xem dư nợ giả định, chỉ là cách xem, lưu trong trình duyệt).
- **Forecast Nợ / Nợ BM**: 3 kịch bản (tối thiểu / trả nhanh / % thu nhập), avalanche|snowball, lãi tính riêng từng khoản (`forecast.js`); khoản Trả lãi only mỗi tháng trả đúng lãi, chưa mô phỏng tất toán gốc khi đáo hạn. Cơ sở thu/chi = TB 3 tháng (Nợ BM "Chỉ BM" dùng Ví BM).
- **Tích lũy / Forecast Tích lũy**: tài khoản tích lũy + mục tiêu (`savings.js`); dự báo 3-5 năm, bao lâu đạt mục tiêu, so sánh trả nợ nhanh vs tích lũy.

## Mô hình dữ liệu (`src/lib/schema.js`, `TABS`)
`personal, business, bm` (sổ thu-chi) · `debts, debts_bm` · `payments` (lịch sử trả nợ) · `savings, goals` · `accounts, rules`. Mỗi key tương ứng một tab Google Sheet (`sheet-template/setup.gs` tạo đủ tab, chạy lại an toàn, không xoá dữ liệu).

## Chưa làm / ý tưởng
- Preset đọc sao kê theo từng ngân hàng (cần file mẫu đã ẩn thông tin cá nhân của 10+ ngân hàng).
- Lịch sử lãi suất theo giai đoạn; ngày đáo hạn + mô phỏng tất toán gốc; số tháng còn lại tự giảm theo thời gian.
- Tổng quan chưa có khối Ví BM / Nợ BM; Forecast Tích lũy chưa gồm Ví BM.
- `docs/USER_GUIDE.md` cho người dùng ít rành công nghệ, `vercel.json`, PR vào `main`.
- Tuỳ chọn lưu lựa chọn tick / bộ lọc vào dữ liệu thay vì trình duyệt.
