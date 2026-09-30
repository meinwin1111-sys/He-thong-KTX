# Student Front-end

Open Admin.html on localhost or Live Server and choose the registration link. Register with a Gmail address and complete your personal profile. No mock roster matching is required. Sign in using the new Gmail and password.

Required: name, student code, birthday, gender, mobile phone, Gmail, school, class, password and confirmation. Address is optional. Passwords require at least 8 characters. Student code and Gmail must be unique among stored Student accounts. Phone accepts Vietnamese mobile numbers (10 digits or +84). Future and invalid birthdays are rejected.

- auth.js: mock account/profile storage and 24-hour session. Keys: ktx.student.mock.accounts.v1 and ktx.student.mock.session.v1.
- DangKy.js: two-column registration form; single column on small screens.
- data.js: loads the signed-in profile. Other residence records remain sample data.
- ThongTinCaNhan.js: displays all registered profile fields.
- app.js: routes, account dropdown and demo interactions.
- Other screen files and helpers.js retain their existing responsibilities.

Old registered accounts are retained; missing profile fields display an unavailable label. The original demo student@ktx.com / 123456 remains supported. New registrations require 8-character passwords.

This is local demo authentication, not Gmail verification. Credentials are stored locally; use test passwords only. Student account emails use the mock branch; other emails continue through the unchanged Admin API. Do not register a real Admin email as a Student demo account. Logout removes only the Student session. Payment and password-change pages remain UI demos.

## Invoice payments — shared DEMO / SANDBOX

Open both Admin.html and Student.html through the same localhost/HTTPS origin in the same browser profile. Use a browser supporting Web Locks (current Chrome/Edge/Firefox). File URLs are not supported for demo payment writes. Student authentication and the Admin login/API remain unchanged.

- Online: choose an unpaid/overdue invoice → Thanh toán online → inspect its QR → DEMO · Giả lập thanh toán thành công → confirm. This simulates a SUCCESS result locally, immediately marks that invoice PAID, creates a DEMO-date-UUID receipt and reduces debt. There is no Admin approval or bank call.
- QR contains JSON with invoiceId, studentId, amount and paymentContent (`KTX [invoiceId] [studentId]`). The amount comes from that invoice's remainingAmount, totalAmount, or room/electricity/water sum. Opening/scanning QR changes nothing. No bank details are invented.
- Cash: choose Thanh toán tiền mặt → Đăng ký thanh toán tiền mặt → confirm. The invoice becomes WAITING_CASH; debt and successful history stay unchanged.
- Admin: Duyệt & Kiểm soát → Thanh toán Student · DEMO / SANDBOX → Xác nhận thu tiền mặt. Confirm receipt of the shown amount/student/invoice to mark PAID and create a CASH-date-UUID receipt with the Admin identity. Lịch sử thanh toán in this area shows both Online and Tiền mặt.
- UNPAID/OVERDUE can start payment. WAITING_CASH blocks both another cash request and online payment. PAID cannot be paid again. No cash cancellation is implemented.

`js/payment-demo.js` stores one ledger per student under `ktx.billing.demo.v1.[encoded student code]`. Each ledger contains invoices, cash requests and receipts, committed together with one localStorage write. Existing mock invoices and successful history seed the ledger only on first use. Invoice IDs may repeat between students; the student code scopes every operation. Web Locks serialize updates across tabs; each write rechecks the persisted invoice status. Failed storage writes do not change the displayed invoice to PAID. Corrupt stored records are reported instead of silently overwritten.

Both screens read this same ledger. Storage events refresh other open tabs; returning focus also refreshes data. Reloading and signing out preserve payments. A different browser/profile/device/origin has independent data; clearing site storage deletes demo records. Admin sees a student's demo ledger after that student first opens the Student page. Browser storage is user-editable and is not a production payment or authorization boundary.

Only this new Student payment flow and its Admin confirmation/history area use the shared demo ledger. The existing Admin invoice module continues to call its real API/database unchanged. Its totals/reports do not include these demo transactions. Older sample approval/history rows remain in Duyệt & Kiểm soát as separate sample data. No database schema, backend, login or authentication files are changed.

`payment-config.js` remains in demo mode with empty bank fields. Changing the mode alone does not enable real payment. `vendor/qrcode.js` is qrcode-generator 1.4.4 (Kazuhiko Arase, MIT), bundled locally; invoice data is not sent to an external QR service.

Run checks: `node --test js/student/billing.test.cjs`.
Coverage: selected QR payload, SUCCESS/receipt/debt, cash waiting/Admin receipt, refresh persistence, duplicate and concurrent writes, student isolation, storage failure and preservation of existing paid history.