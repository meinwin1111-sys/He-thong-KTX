# Hệ thống quản lý ký túc xá

Ứng dụng web quản lý hoạt động ký túc xá, gồm giao diện Ban quản lý và giao diện Sinh viên. Backend dùng Node.js/Express; dữ liệu lưu trên Microsoft SQL Server.

## Chạy trên máy local

### 1. Chuẩn bị

Cài đặt:

- Node.js LTS và npm.
- Microsoft SQL Server (local hoặc máy chủ mà bạn được phép sử dụng).
- Git để tải mã nguồn.

Clone repository rồi mở terminal tại thư mục dự án:

```powershell
git clone https://github.com/meinwin1111-sys/He-thong-KTX.git
cd He-thong-KTX
npm install
```

### 2. Tạo database

Để chạy ứng dụng trên database mới, trước tiên tạo SQL Server login `DNKTX`, sau đó chạy `db\KTX_Group3_clean.sql` trên máy/database mới. Script này tạo database `[KTX_Group3]` và áp dụng schema cùng các cập nhật cần cho ứng dụng.

```powershell
sqlcmd -S <ten-may-chu-sql> -E -I -f 65001 -b -i db\KTX_Group3_clean.sql
```

Thay `<ten-may-chu-sql>` bằng địa chỉ SQL Server của bạn. Có thể chạy script bằng SQL Server Management Studio (SSMS) thay cho `sqlcmd`.

> **Cẩn thận:** `KTX_Group3_clean.sql` tạo cứng database `[KTX_Group3]`. Chỉ chạy khi database đó chưa có dữ liệu cần giữ. Không chạy trên database đang sử dụng.

### 3. Cấu hình kết nối

Tạo file `.env` từ mẫu:

```powershell
Copy-Item .env.example .env
```

Mở `.env`, điền thông tin SQL Server và các thiết lập cần dùng:

```dotenv
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=KTX_Group3
DB_USER=DNKTX
DB_PASSWORD=<mat-khau-sql-cua-ban>
PORT=3000
NODE_ENV=development
JWT_SECRET=<chuoi-bi-mat-ngau-nhien-dai>
JWT_EXPIRES_IN=8h
```

Đảm bảo SQL Server cho phép kết nối TCP/IP và cổng `DB_PORT` đang mở. Không chia sẻ file `.env` hoặc đưa mật khẩu, JWT secret, thông tin ngân hàng hay webhook secret lên GitHub.

Để dùng QR chuyển khoản thật, cấu hình các biến `PAYMENT_BANK_*` và tích hợp dịch vụ gửi webhook theo [PAYMENT_WEBHOOK.md](PAYMENT_WEBHOOK.md). Chế độ thanh toán demo tắt mặc định; chỉ bật `ALLOW_DEMO_PAYMENT=true` trên database/môi trường thử nghiệm. Không dùng demo để xác nhận thanh toán thật.

### 4. Khởi động và mở website

```powershell
npm start
```

Khi terminal báo server đã kết nối SQL Server và chạy tại cổng 3000, mở:

- Ban quản lý: <http://localhost:3000/Admin.html>
- Sinh viên: <http://localhost:3000/Student.html>
- Kiểm tra backend/database: <http://localhost:3000/api/health>

Giữ terminal đang chạy khi sử dụng website; nhấn `Ctrl+C` để dừng. Nếu đổi `PORT` trong `.env`, thay `3000` trong địa chỉ trình duyệt bằng cổng mới.

Đăng nhập bằng tài khoản đã được cấp trong database. Không có tài khoản/mật khẩu mặc định được công bố trong README. Sinh viên mới có thể gửi đăng ký và cần Ban quản lý duyệt trước khi sử dụng tài khoản.

> Khi backend khởi động, ứng dụng kiểm tra và băm lại mật khẩu legacy trong `TaiKhoan` nếu có, đồng thời khởi tạo nội dung dashboard cần thiết. Chỉ chạy trên database local/được phép chỉnh sửa, không trỏ ứng dụng vào database production nếu chưa được quản trị viên cho phép.

### Chỉ muốn xem cấu trúc database

`db\KTX_Group3_schema_only.sql` tạo database rỗng `[KTX_Group3_Schema]` với các bảng và quan hệ để xem/làm báo cáo. File này **không** bao gồm dữ liệu, view, stored procedure hoặc trigger cần thiết để chạy ứng dụng; không dùng thay cho `KTX_Group3_clean.sql`.

Chi tiết dựng mới, cập nhật và các script chỉ dành cho kiểm thử được ghi trong [db/README_DB.md](db/README_DB.md).

## Các chức năng và luồng chính

### Ban quản lý

- Xem dashboard, thống kê và báo cáo hoạt động.
- Quản lý phòng, hạng phòng, dịch vụ và thông tin sinh viên.
- Duyệt đăng ký tài khoản Sinh viên.
- Tạo hợp đồng, quản lý thành viên/phòng, chuyển phòng, kết thúc hợp đồng và gia hạn cho thành viên.
- Tạo hóa đơn, xuất tiền phòng theo kỳ, quản lý khoản phát sinh, nhắc nợ và hủy hóa đơn.
- Theo dõi giao dịch/phiếu thu; xác nhận hoặc hủy thu tiền mặt; xử lý đối soát thanh toán và hoàn khoản chuyển dư.
- Duyệt yêu cầu của Sinh viên, gửi thông báo, chỉnh nội quy và thông tin liên hệ.

### Sinh viên

- Đăng ký tài khoản; sau khi được duyệt có thể đăng nhập, xem/cập nhật thông tin cá nhân và đổi mật khẩu.
- Xem trang chủ, phòng hiện tại, thành viên hợp đồng và ngày hiệu lực của mình.
- Xem hóa đơn, số tiền còn nợ, hạn thanh toán và lịch sử giao dịch; tạo yêu cầu thanh toán QR hoặc chọn quy trình tiền mặt tại văn phòng.
- Gửi yêu cầu/hỗ trợ, xem trạng thái xử lý và nhận thông báo từ Ban quản lý.

### Một số luồng nghiệp vụ

1. **Đăng ký Sinh viên:** Sinh viên gửi thông tin → Ban quản lý duyệt → tài khoản được kích hoạt để đăng nhập.
2. **Hợp đồng và gia hạn:** Ban quản lý tạo hợp đồng hoặc gia hạn cho thành viên cụ thể → hệ thống ghi nhận hợp đồng/gia hạn và hóa đơn liên quan → Sinh viên xem thông tin và hóa đơn của mình.
3. **Hóa đơn và thanh toán:** Hóa đơn được tạo thủ công hoặc theo kỳ → Sinh viên tạo yêu cầu thanh toán → chuyển khoản chỉ được ghi nhận sau khi nhận webhook hợp lệ; thanh toán tiền mặt cần Ban quản lý xác nhận.
4. **Gia hạn quá hạn:** Khi có truy cập endpoint liên quan, hệ thống kiểm tra và hủy gia hạn chờ thanh toán đã quá hạn; không cần job nền riêng cho luồng này.
5. **Yêu cầu hỗ trợ:** Sinh viên gửi yêu cầu → Ban quản lý xem và cập nhật trạng thái/kết quả → Sinh viên theo dõi trong tài khoản.

Các luồng QR thật cần cấu hình ngân hàng và tích hợp webhook; khả năng bật thanh toán demo phụ thuộc biến môi trường và chỉ dành cho kiểm thử. Những chức năng tích hợp dịch vụ bên ngoài cần cấu hình riêng mới hoạt động đầy đủ.

## Kiểm thử

Chạy bộ kiểm thử tự động:

```powershell
npm test
```

Một số kiểm thử tích hợp SQL chỉ chạy khi được cấu hình rõ cho database kiểm thử. Fixture kiểm thử phải dùng database riêng `KTX_Group3_test`; không trỏ tác vụ kiểm thử hoặc script dọn dữ liệu vào database đang dùng thật.

> Các migration `035`, `036`, `038`, `039`, `040`, thư mục `db/maintenance` và `npm run test:fixture` chỉ dành cho database kiểm thử. Không chạy chúng trên `KTX_Group3`.
