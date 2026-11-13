# Hướng dẫn dựng và cập nhật cơ sở dữ liệu

## Dựng mới từ đầu

`db/KTX_Group3_clean.sql` tạo cứng database `[KTX_Group3]`; chỉ chạy trên máy trống, không chạy trên database đang có dữ liệu. Trước khi chạy, cần có SQL Server login `DNKTX` để các migration có thể cấp quyền cho đúng database user.

Chạy từ thư mục gốc repository bằng `sqlcmd` với `QUOTED_IDENTIFIER` và UTF-8:

```powershell
sqlcmd -S <server> -E -I -f 65001 -b -i db\KTX_Group3_clean.sql
```

## Xem/dựng schema bảng để làm báo cáo

`db/KTX_Group3_schema_only.sql` là script độc lập gồm 25 bảng ứng dụng, cột, khóa, ràng buộc, index và quan hệ khóa ngoại; không chứa dữ liệu. Script tạo database rỗng `[KTX_Group3_Schema]`, vì vậy không ghi đè database hiện có. Đổi tên database trong script nếu tên đó đã được dùng.

Chạy bằng SQL Server Management Studio hoặc từ thư mục gốc repository:

```powershell
sqlcmd -S <server> -E -I -f 65001 -b -i db\KTX_Group3_schema_only.sql
```

Script phục vụ xem cấu trúc/quan hệ bảng, không bao gồm view, stored procedure hoặc trigger và không thay thế `KTX_Group3_clean.sql` để cài ứng dụng.

## Nâng cấp database hiện có

Chọn database đích trước khi chạy. Đảm bảo login và database user `DNKTX` đã tồn tại, sau đó chạy migration theo thứ tự trong `db/run_all.sql`:

```powershell
sqlcmd -S <server> -E -d <database> -I -f 65001 -b -i db\run_all.sql
```

`run_all.sql` chạy migration 001–018, bootstrap 041, rồi 019–034, 037 và 042. Migration 041 được đặt ngay sau 018 để tạo `dbo.ThongBao` trước các bước sau; migration 023/024/026 tiếp tục bổ sung quyền, khóa ngoại và chỉ mục theo thứ tự thông thường. Migration 042 giữ một hợp đồng cha cho mỗi phòng; mỗi sinh viên là một hợp đồng con có ngày thuê, kỳ hạn và hóa đơn tiền phòng riêng. Hóa đơn dịch vụ vẫn thuộc hợp đồng cha/phòng. Các migration được đánh dấu trong `SchemaMigration` để có thể chạy lại an toàn.

## Chỉ dành cho database kiểm thử

Các migration 035, 036, 038, 039 và 040 chỉ dùng cho `KTX_Group3_test`; không đưa vào `run_all.sql` hoặc `KTX_Group3_clean.sql`. Thư mục `db/maintenance` và lệnh `npm run test:fixture` cũng chỉ dành cho database kiểm thử. Không chạy script dọn fixture trên database thật.
