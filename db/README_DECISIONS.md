# Quyết định triển khai CSDL và BE

## Quyết định schema

- **Tổng hóa đơn:** giữ nguyên `HoaDon.TongTien` computed column để không phá tương thích dump/trigger; tổng chuẩn là `vw_HoaDonTongHop.TongThuc = SUM(ChiTietHoaDon.SoTien)`. Admin GET `/api/HoaDon` hiện đọc `TongThuc AS TongTien`. Mọi endpoint Student và endpoint xem/in hóa đơn cần dùng cùng view này; không dùng `TongTienCotTinh` làm số hiển thị. Như vậy các khoản INTERNET/CLEANING/PENALTY được cộng giống nhau ở mọi vai trò.
- **Vai trò:** chỉ có `Quản lý` (quyền quản trị KTX) và `Sinh viên`. Migration 009 đổi role legacy `Admin` thành `Quản lý`, rồi thay `CK_TaiKhoan_VaiTro` bằng constraint chỉ chấp nhận hai role này.
- **Tài khoản quản trị:** master seed chỉ tạo `quanlyktx@gmail.com` với `VaiTro = Quản lý`. Khi chạy lại, seed xóa đúng tài khoản mặc định cũ `adminktx@gmail.com`/`Quản trị viên` nếu còn. Không seed tài khoản sinh viên.
- **Dữ liệu nền:** chỉ phòng, cấu hình hệ thống và một tài khoản Quản lý được đưa vào master seed. Không seed sinh viên, hợp đồng, hóa đơn, thanh toán, yêu cầu, lịch sử, nhật ký hay tài khoản sinh viên. `db/seed/master/001_phong.sql` trích đủ 137 phòng từ dump gốc; trạng thái phòng hoạt động đặt về `Trống`, `Bảo trì`/`Ngưng sử dụng` giữ nguyên; sĩ số ban đầu là 0.
- **Giá phòng:** seed dùng theo sức chứa: 4 -> 1.200.000, 6 -> 800.000, 8 -> 500.000. Migration 006 cũ có thể đã backfill từ hóa đơn; migration 008 ghi đè mọi `GiaPhong` theo sức chứa, không phụ thuộc dữ liệu vận hành. Dump có 137 phòng: 22 phòng sức chứa 4, 49 phòng sức chứa 6, 66 phòng sức chứa 8; trạng thái gốc gồm 116 `Trống`, 19 `Đầy`, 2 `Ngưng sử dụng`, không có `Bảo trì`.
- **Lịch sử hợp đồng:** proc là nguồn ghi duy nhất. FE không POST `/api/history` sau khi tạo/gia hạn/kết thúc vì `sp_TaoHopDong`, `sp_GiaHanHopDong`, `sp_KetThucHopDong`, `sp_ChuyenPhong` đã ghi `LichSuHopDong`. API đọc dùng `vw_LichSuHopDongFE`, có `MaLS`, `ThoiDiem` và các trường mà `HopDong.js` cần. `MaLS` có dạng `LS001`–`LS999`, sau đó là `LS1000`, `LS1001`...; vẫn không dùng làm khóa cơ sở dữ liệu.
- **Mã sinh viên:** migration mở rộng mọi cột `MaSinhVien` lên `nvarchar(30)`, giữ nullability, tháo/dựng lại FK và index do migration 002-005 tạo. Tham số của các proc BE mới/cập nhật phải dùng độ dài tối đa 30 để không cắt mã trước khi tới cột.
- **Mã hóa đơn:** `sp_TaoHoaDon` cấp `INVyyyymmNNNN`. Bộ đếm theo tháng được khóa trong transaction bằng `UPDLOCK, HOLDLOCK`, nên các request đồng thời không lấy cùng số. Gọi proc với `@MaHoaDon = NULL`; FE không tự tạo mã. Hết 9.999 số trong một tháng thì proc báo lỗi thay vì tạo mã trùng.
- **Mã hợp đồng:** giữ `Seq_MaHopDong`/`sp_TaoHopDong` từ migration 005; `NEXT VALUE FOR` cấp số an toàn đồng thời. BE gọi proc không truyền mã (hoặc `NULL`), FE không tự sinh mã.
- **Chuẩn hóa:** gọi `dbo.sp_KiemTraChuanHoaDuLieu` không tham số để chỉ báo cáo. Chỉ khi chủ động chọn áp dụng mới gọi `EXEC dbo.sp_KiemTraChuanHoaDuLieu @ApDung = 1;`. Proc gọi `sp_CapNhatHopDong` để đóng các hợp đồng quá hạn. Danh sách sinh viên vẫn `Đang ở` dù hợp đồng đã kết thúc chỉ được xuất ra, không tự đổi trạng thái sinh viên/phòng.
- **Điện thoại Student:** `StudentAuth.register` chuẩn hóa `+84xxxxxxxxx` thành `0xxxxxxxxx` trước khi lưu/gửi tiếp; biểu mẫu vẫn nhận cả hai định dạng.

## Map thanh toán tập trung

`server.js` là nơi duy nhất để chuyển giá trị giao diện sang giá trị CSDL. Các endpoint ghi thanh toán BE phải gọi `mapPaymentStatusToDatabase` và `mapPaymentMethodToDatabase`; không tự map trong từng route.

| Giá trị FE | Giá trị CSDL | Cột/ý nghĩa |
| --- | --- | --- |
| `PAID` | `Đã thanh toán` | Trạng thái hạng mục; trạng thái hóa đơn được trigger tổng hợp |
| `UNPAID` | `Chưa thanh toán` | Trạng thái hạng mục/hóa đơn |
| `WAITING_CASH` | `Chờ tiền mặt` | `ChiTietHoaDon.TrangThai`; không ghi vào header `HoaDon.TrangThaiThanhToan` |
| `Tiền mặt` | `CASH` | `GiaoDichThanhToan.PhuongThuc` |
| `Chuyển khoản` | `ONLINE` | `GiaoDichThanhToan.PhuongThuc` |
| `Ví điện tử` | `ONLINE` | Nhóm thanh toán không tiền mặt trong schema hiện tại |

Header `HoaDon.TrangThaiThanhToan` chỉ nhận `Đã thanh toán`/`Chưa thanh toán`; trạng thái chờ tiền mặt nằm ở các hạng mục. Phương thức `ONLINE` hiện gộp chuyển khoản và ví điện tử vì schema chỉ có hai giá trị `CASH`/`ONLINE`.

## Endpoint FE đang gọi nhưng server.js chưa có

`server.js` hiện có `POST /api/login` và `GET /api/HoaDon`; các endpoint dưới đây chưa được cài. Student hiện là demo localStorage và chưa gọi API.

| Method + endpoint | Nguồn dữ liệu/đối tượng BE nên dùng |
| --- | --- |
| `GET /api/nam-co-du-lieu` | `HoaDon.NgayLap`, `SinhVien.NgayRoiKTX`, `HopDong.NgayBatDau`/`NgayKetThuc` |
| `GET /api/tyle-roi-bo/:year` | `SinhVien.NgayRoiKTX`, `TrangThaiSinhVien` |
| `GET /api/gioi-tinh-sinh-vien` | `SinhVien.GioiTinh` |
| `GET /api/doanhthu/:year` | `vw_DoanhThuThang` (tổng từ `ChiTietHoaDon`) |
| `GET /api/Phong` | `Phong` |
| `POST /api/Phong` | `Phong`; `TRG_UpdatePhong` duy trì sĩ số |
| `PUT /api/Phong/:id` | `Phong` |
| `GET /api/SinhVien/Phong/:room` | `SinhVien` JOIN `HopDong` |
| `GET /api/HopDong` | `HopDong` JOIN `SinhVien`/`Phong` |
| `POST /api/HopDong` | `sp_TaoHopDong` (ghi `LichSuHopDong` trong proc) |
| `PUT /api/HopDong/extend/:id` | `sp_GiaHanHopDong` |
| `PUT /api/HopDong/end/:id` | `sp_KetThucHopDong` |
| `PUT /api/HopDong/note/:id` | `HopDong.GhiChu`; ghi một dòng `LichSuHopDong` trong cùng transaction |
| `GET /api/history` | `vw_LichSuHopDongFE` |
| `GET /api/SinhVienById/:mssv` | `vw_SinhVienChiTiet` hoặc `SinhVien` JOIN hợp đồng hiệu lực |
| `GET /api/sinhvien/thongke` | `SinhVien` group theo giới tính/trạng thái |
| `GET /api/sinhvien?page=...&pageSize=...` | `vw_SinhVienChiTiet` với lọc/phân trang |
| `GET /api/sinhvien/chitiet/:mssv` | `vw_SinhVienChiTiet` |
| `POST /api/sinhvien` | `sp_ThemSinhVien` |
| `PUT /api/sinhvien/:mssv` | `SinhVien`; dùng `sp_ChuyenPhong` nếu có đổi phòng |
| `POST /api/change-password` | `TaiKhoan`; xác thực tài khoản và cập nhật hash mật khẩu |
| `POST /api/HoaDon` | `sp_TaoHoaDon` với `@MaHoaDon = NULL`; `ChiTietHoaDon` được trigger đồng bộ |
| `GET /api/HoaDon/:id` | `vw_HoaDonTongHop` JOIN `HoaDon`, `ChiTietHoaDon`; trả `TongThuc AS TongTien` |
| `PUT /api/HoaDon/:id` | `HoaDon`; trigger đồng bộ các hạng mục chưa thanh toán |
| `PUT /api/HoaDon/:id/thanhtoan` | `sp_ThanhToan` hoặc proc thanh toán hạng mục; cập nhật `ChiTietHoaDon`/`GiaoDichThanhToan` theo map ở trên |

`POST /api/history` đã được loại khỏi luồng FE để tránh ghi lịch sử lần hai. API thay thế cần tiếp tục coi các proc hợp đồng là nơi ghi lịch sử duy nhất.

## Bảo mật: việc cần làm trước khi mở BE

- Chuyển cấu hình SQL sang biến môi trường (`DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`); chỉ commit `.env.example`, không commit `.env`. Xóa mật khẩu khỏi log và xoay vòng credential đã từng nằm trong source/ghi chú backup.
- Bỏ log request đăng nhập có chứa mật khẩu. Không log body đăng nhập, mật khẩu cũ/mới hay chuỗi kết nối.
- Dùng `bcrypt` với cost phù hợp. Vì `TaiKhoan.MatKhau` hiện plaintext và `NOT NULL`, triển khai theo giai đoạn: thêm cột hash nullable; login thử bcrypt nếu hash có giá trị, nếu chưa có thì so sánh plaintext cũ; sau lần đăng nhập legacy thành công, tạo hash bcrypt và ghi hash; khi mọi tài khoản đã chuyển hoặc hết thời hạn chuyển đổi, đặt lại mật khẩu cho tài khoản chưa migrate, sau đó xóa plaintext/cột cũ. Không hash plaintext hàng loạt bằng một lần băm không có xác minh người dùng.
- Tách tài khoản SQL chỉ quyền tối thiểu cho ứng dụng; đổi credential SQL sau khi chuyển cấu hình và không dùng chung tài khoản quản trị.

## Dựng DB sạch

`db/KTX_Group3_clean.sql` là một file sqlcmd UTF-8 tự chứa: schema từ dump gốc (đã loại các dòng INSERT dữ liệu vận hành), nội dung migrations 001-010 được nhúng trực tiếp, rồi master seeds và quyền database cho login `DNKTX`. File tạo DB đúng tên `KTX_Group3` để khớp `server.js`, bật database `QUOTED_IDENTIFIER`, đặt ANSI session options cần cho filtered indexes, dùng đường dẫn MDF/LDF mặc định của instance, giữ `DNKTX` trong `db_datareader`/`db_datawriter` và cấp `EXECUTE`. Yêu cầu login server-level `DNKTX` đã tồn tại và quyền tạo DB. Chạy từ thư mục gốc: `sqlcmd -f 65001 -I -S <server> -d master -U <user> -i db/KTX_Group3_clean.sql`. `-f 65001` bảo đảm input UTF-8 được đọc đúng. Script không drop DB đã có; chỉ chạy khi `KTX_Group3` chưa tồn tại.

Với database đã có schema nhưng các bảng vận hành đang rỗng, `db/run_all.sql` chạy migrations 001-010 bằng `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/run_all.sql`; sau đó nạp dữ liệu nền bằng `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/seed/run_master.sql`. Không chạy master room seed trên DB đang có người ở vì seed đặt sĩ số về 0. Các seed master dùng `MERGE` theo khóa tự nhiên và không tạo dữ liệu vận hành. `003_taikhoan_admin.sql` và clean SQL lưu bcrypt hash cost 12; BE chuyển các mật khẩu plaintext cũ sang bcrypt trước khi mở cổng. Mật khẩu bootstrap cũ từng xuất hiện trong bản gốc, do đó phải đổi mật khẩu trước khi cấp hệ thống cho người dùng khác.

## Xóa dữ liệu vận hành

Trước khi reset phải backup theo lệnh/hướng dẫn trong `db/00_backup_note.md`. `db/maintenance/reset_operational_data.sql` mặc định chỉ đếm bảng; chỉ xóa thật khi truyền `-v XacNhan=1`. Chạy từ thư mục gốc repo:

```powershell
sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/maintenance/reset_operational_data.sql
sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -v XacNhan=1 -i db/maintenance/reset_operational_data.sql
```

Không chạy script reset trên production nếu chưa kiểm tra bản backup.

## Kiểm chứng

Sau khi dựng `KTX_Group3`, chạy `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/audit.sql`, rồi test `POST /api/login` bằng tài khoản Admin đã seed. Chỉ đánh dấu đã xác minh khi cả hai chạy được trên SQL Server đích.