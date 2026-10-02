// Bật tuỳ chọn kết nối Google Sheets: đặt biến môi trường VITE_ENABLE_SHEETS=true (vd. trên Vercel) rồi deploy lại.
// Mặc định tắt: dữ liệu lưu trong trình duyệt và sao lưu bằng file JSON.
export const SHEETS_ENABLED = import.meta.env?.VITE_ENABLE_SHEETS === 'true'
