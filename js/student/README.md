# Student Front-end

Open Admin.html on localhost or Live Server and choose the registration link. Submit a Gmail address and complete the profile. New applications are stored by `POST /api/student/register` with a bcrypt hash and remain pending until a manager approves them in the `Đăng ký sinh viên` tab under `Duyệt & Kiểm soát`. The approval API creates the linked `SinhVien` and `TaiKhoan` rows atomically; only then can the new account sign in.

Required: name, student code, birthday, gender, mobile phone, email, school, class, password and confirmation. Address is optional. Birthday is entered as `dd/mm/yyyy` and converted to ISO before submission. Passwords require at least 8 characters (and at most 72 UTF-8 bytes for bcrypt). Student code and email must not already exist or have another pending application. Phone accepts Vietnamese mobile numbers (10 digits or +84). Invalid, future, and unreasonable-age birthdays are rejected by both client and server.

- auth.js: backend-linked Sinh viên accounts use an API JWT session. Legacy local demo credentials and residence/payment data are removed once when the Student auth script loads.
- DangKy.js: two-column registration form; single column on small screens.
- data.js: contains isolated demo data only; database-linked pages use root API responses instead.
- ThongTinCaNhan.js: displays all registered profile fields.
- app.js: routes, account dropdown and demo interactions.
- Other screen files and helpers.js retain their existing responsibilities.

Missing profile fields display an unavailable label. Browser demo login is disabled by default. To explicitly enable the legacy demo authentication in a local development frontend build only, set `KTX_ENABLE_STUDENT_DEMO=true`; Vercel builds always keep it disabled. Production login never falls back to local demo credentials.

Quản lý and approved database-linked Sinh viên accounts sign in through `POST /api/login` and receive role-scoped JWT sessions. A demo Student session never grants API access. A backend-linked Student session reads profile, room, contracts, requests, password changes, invoices, payment history, shared rules, and contact from the root API. The registration approval schema is in `db/migrations/011_student_registration_approval.sql`; review and run it after its documented prerequisite migrations before deploying the new endpoints.

## Invoice payments — DEMO / SANDBOX

Demo Student accounts may still use the browser-only payment sandbox. It does not update the database or process real money. Database-linked Student accounts see only their own invoices and payment history from the API. Opening the QR first creates an online payment request; it remains `PENDING` until a signed bank notification verifies the exact outstanding amount. Cash requests remain `PENDING` until Quản lý confirms receipt in Hóa đơn.

- Student chọn từng hạng mục trên hóa đơn (danh sách `invoice.items`, không hard-code loại phí). Có checkbox “Chọn tất cả” theo hóa đơn và trên toàn trang. Thanh sticky hiển thị số hạng mục / tổng tiền rồi mới bấm thanh toán.
- Online: Thanh toán online (QR) → kiểm tra QR đúng các hạng mục đã chọn → DEMO · Giả lập thanh toán thành công → xác nhận. Mô phỏng SUCCESS tại chỗ, đánh dấu đúng item đó là PAID, tạo biên nhận `DEMO-date-UUID` kèm danh sách hạng mục và giảm công nợ tương ứng. Không cần Admin và không gọi ngân hàng. Mở/quét QR không đổi dữ liệu.
- QR chứa JSON `{ studentId, amount, paymentContent, items: [{ invoiceId, itemId, amount }] }`. `paymentContent` dạng `KTX [mã SV] [mã tham chiếu ngắn]`. Nếu payload quá lớn, QR chỉ còn mã tham chiếu + tổng tiền; danh sách hạng mục vẫn hiện trong modal. Không invent thông tin ngân hàng.
- Tiền mặt: chọn hạng mục → Thanh toán tiền mặt → Đăng ký. Các item chuyển `WAITING_CASH` (khóa, không trả online/trả trùng); công nợ và lịch sử thành công chưa đổi.
- Quản lý: Duyệt & Kiểm soát reads and processes database-backed requests; invoice rows show payment history from `GET /api/payments/history?MaHoaDon=...`; Quản lý can confirm or reject pending cash requests. Pending QR transfers are audit-only and become successful only after a signed bank notification verifies them. The Management dashboard manages shared rules and support contact details; Sinh viên can only read these through `GET /api/noi-quy` and `GET /api/lien-he`.
- Trạng thái hóa đơn suy ra từ item: tất cả PAID → PAID; có item PAID nhưng chưa hết → PARTIAL (“Đã thanh toán một phần”); mọi item còn nợ đều WAITING_CASH → WAITING_CASH; còn lại quá hạn → OVERDUE, chưa hạn → UNPAID.

`js/payment-demo.js` stores a demo ledger per Student in localStorage. It is strictly separate from the API-backed invoice/history view and must not be treated as a real payment record.

Demo Student payment state is browser-local and is not loaded by the Admin app. Demo refresh events and checkbox selections apply only to that demo path.

The Admin invoice history and database-linked Student invoice/history views use the existing `GiaoDichThanhToan`, `ChiTietGiaoDich`, and `ChiTietHoaDon` tables. Student list/detail/history and payment-request creation are scoped to the `MaSinhVien` bound to the signed JWT. Bank notification verification and cash confirmation atomically update the transaction and its unpaid invoice items. A Student's click only reads the online transaction status and never confirms payment.

Set `PAYMENT_BANK_BIN`, `PAYMENT_BANK_ACCOUNT_NO`, and `PAYMENT_BANK_ACCOUNT_NAME` in the local `.env` to enable QR transfer; `.env.example` contains placeholders only. Configure `PAYMENT_WEBHOOK_SECRET` for the trusted bank/payment-provider adapter to enable signed transfer notifications. See [PAYMENT_WEBHOOK.md](../../PAYMENT_WEBHOOK.md) for the endpoint and HMAC format. The QR payload is generated locally in the backend and rendered locally in the browser. `vendor/qrcode.js` is qrcode-generator 1.4.4 (Kazuhiko Arase, MIT), running locally.

Run checks: `node --test js/student/billing.test.cjs`.
Coverage: QR đúng item đã chọn, thanh toán một phần / toàn bộ / xuyên hóa đơn, SUCCESS/biên nhận/công nợ, tiền mặt khóa item, Admin xác nhận/từ chối, refresh, trả trùng và ghi đồng thời, cách ly sinh viên, lỗi storage, migration ledger cũ.

The bank notification endpoint is an application-side contract; it does not connect directly to a bank. A trusted provider adapter must securely forward signed verified-transfer events. Without that adapter and secret configuration, online requests stay `PENDING`; never use the browser-only demo "simulate success" flow to record a real payment.