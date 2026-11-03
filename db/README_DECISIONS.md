# Quyết định triển khai CSDL và BE

## Quyết định schema

- **Thông báo Sinh viên:** migration 023 tạo `dbo.ThongBao` với phạm vi `TAT_CA`, `PHONG`, `SINH_VIEN`; thông báo xóa mềm qua `DaXoa`. API Sinh viên xác định phạm vi phòng từ hợp đồng còn hiệu lực và thành viên `Đang ở` trong `ChiTietHopDong`, không tin `SinhVien.TenPhong` hay dữ liệu phòng từ client. Migration yêu cầu user `DNKTX` đã tồn tại trước khi ghi nhận 023; user này chỉ được `SELECT`, `INSERT`, `UPDATE` trực tiếp trên đúng bảng, không cấp `DELETE`.
- **Tham chiếu nhắc nợ:** migration 024 chỉ thêm `ThongBao.MaHoaDon` nullable, FK tới `HoaDon.MaHoaDon` và index `(MaHoaDon, NgayTao)`; không cập nhật dòng thông báo cũ nên các dòng cũ giữ `MaHoaDon = NULL`. `NguoiTao` và `NgayTao` hiện có lưu vết người gửi/thời điểm. DNKTX đã thuộc `db_datawriter` và migration 023 đã cấp `SELECT`, `INSERT`, `UPDATE` trên đúng `dbo.ThongBao`, vì vậy migration 024 không cấp thêm quyền. API khóa dòng hóa đơn trong transaction, kiểm tra công nợ và lần nhắc gần nhất, rồi ghi thông báo trong cùng transaction.
- **Kiểm tra giới tính và sức chứa hợp đồng:** migration 025 đổi `sp_TaoHopDong` và `sp_ThemSinhVienVaoHopDong` thành lớp kiểm tra lỗi có mã SQL riêng; phần ghi dữ liệu tiếp tục dùng implementation 014 trong cùng transaction, với khóa phòng/sinh viên để giữ kiểm tra đồng thời. Lỗi 51458 = không có sinh viên, 51459 = sai giới tính, 51460 = đang ở nơi khác, 51461 = hết chỗ. Migration chỉ `GRANT EXECUTE` trên đúng hai procedure mới cho `DNKTX`; không thêm cột/bảng.
- **Hạn chi phí phát sinh và thông báo nghiệp vụ:** migration 026 thêm `ChiPhiPhatSinh.HanDong` bắt buộc, backfill dữ liệu cũ bằng `NgayPhatSinh + 7 ngày`, và đặt mặc định CSDL 7 ngày cho đường ghi trực tiếp; API yêu cầu client gửi hạn hợp lệ. `sp_TaoHoaDonPhatSinh` sao chép hạn này sang `HoaDon.HanThanhToan`; các hóa đơn phát sinh cũ được backfill từ liên kết dòng hóa đơn. `ThongBao.MaSuKien` cùng unique filtered index trên `(MaSuKien, MaSinhVien)` chống gửi thông báo nghiệp vụ trùng theo người nhận. Việc ghi thông báo nằm trong transaction nghiệp vụ; không đổi số tiền, phiếu thu, trigger bảo vệ hay trạng thái thanh toán.
- **Hợp đồng và hóa đơn đầu kỳ:** BE ghi thông báo hợp đồng cho từng thành viên đang ở trong cùng transaction, khóa sự kiện `CONTRACT:<MaHopDong>:<MaSinhVien>` được migration 026 chống trùng. Hóa đơn đầu kỳ gọi `sp_TaoHoaDonTienPhong` để giữ kiểm tra chồng kỳ hiện có; `CONTRACT_PAYMENT_DUE_DAYS` mặc định 7, hạn lấy ngày tạo cộng số ngày này nhưng không muộn hơn ngày bắt đầu tương lai. Thiếu snapshot giá hợp lệ thì không lập hóa đơn và API trả cảnh báo. Migration 029 cho phép truyền ngày tạo theo UTC+7, đồng thời mặc định procedure cũng xác định ngày Việt Nam.
- **Chuyển khoản thiếu/dư:** migration 027 thêm `GiaoDichThanhToan.SoTienThucNhan` (nullable cho lịch sử) và `HoanTienChuyenKhoanDu`, unique theo giao dịch, tách tiền dư khỏi phiếu thu/doanh thu. Webhook chỉ phân bổ `MIN(số thực nhận, công nợ đang khóa)`; phần thiếu vẫn nằm ở hóa đơn gốc, phần dư chờ hoàn. Trigger cấm xóa khoản đã hoàn hoặc chuyển `DA_HOAN` ngược về `CHO_HOAN`. `sp_DanhDauHoanTienChuyenKhoanDu` khóa và cập nhật trạng thái một lần; endpoint chỉ Quản lý được gọi, không tạo `PhieuChi`. `vw_CongNo.TienDuChoHoan` hiển thị nghĩa vụ hoàn riêng; `vw_DoanhThuThang` không cộng tiền dư và không trừ khoản hoàn dư. Giao dịch mới còn `RECONCILIATION` khi webhook hợp lệ chữ ký nhưng `NoiDungCK` không khớp giao dịch đang chờ; tiền thực nhận được giữ toàn bộ ở bảng hoàn dư, hóa đơn không được ghi thu, và Admin có thể xem chi tiết rồi dùng thao tác **Đã trả lại**. Các bản reconciliation lịch sử thiếu `SoTienThucNhan` chỉ có thể được hoàn sau khi đối chiếu thủ công và nhập số tiền thực tế bằng quy trình ngoài API; không tự đoán số tiền.

- **Tổng hóa đơn:** giữ nguyên `HoaDon.TongTien` computed column để không phá tương thích dump/trigger; tổng chuẩn là `vw_HoaDonTongHop.TongThuc = SUM(ChiTietHoaDon.SoTien)`. Admin GET `/api/HoaDon` hiện đọc `TongThuc AS TongTien`. Mọi endpoint Student và endpoint xem/in hóa đơn cần dùng cùng view này; không dùng `TongTienCotTinh` làm số hiển thị. Như vậy các khoản INTERNET/CLEANING/PENALTY được cộng giống nhau ở mọi vai trò.
- **Vai trò:** chỉ có `Quản lý` (quyền quản trị KTX) và `Sinh viên`. Migration 009 đổi role legacy `Admin` thành `Quản lý`, rồi thay `CK_TaiKhoan_VaiTro` bằng constraint chỉ chấp nhận hai role này.
- **Tài khoản quản trị:** master seed chỉ tạo `quanlyktx@gmail.com` với `VaiTro = Quản lý`. Khi chạy lại, seed xóa đúng tài khoản mặc định cũ `adminktx@gmail.com`/`Quản trị viên` nếu còn. Không seed tài khoản sinh viên.
- **Dữ liệu nền:** chỉ phòng, cấu hình hệ thống và một tài khoản Quản lý được đưa vào master seed. Không seed sinh viên, hợp đồng, hóa đơn, thanh toán, yêu cầu, lịch sử, nhật ký hay tài khoản sinh viên. `db/seed/master/001_phong.sql` trích đủ 137 phòng từ dump gốc; trạng thái phòng hoạt động đặt về `Trống`, `Bảo trì`/`Ngưng sử dụng` giữ nguyên; sĩ số ban đầu là 0.
- **Giá phòng:** seed dùng theo sức chứa: 4 -> 1.200.000, 6 -> 800.000, 8 -> 500.000. Migration 006 cũ có thể đã backfill từ hóa đơn; migration 008 ghi đè mọi `GiaPhong` theo sức chứa, không phụ thuộc dữ liệu vận hành. Dump có 137 phòng: 22 phòng sức chứa 4, 49 phòng sức chứa 6, 66 phòng sức chứa 8; trạng thái gốc gồm 116 `Trống`, 19 `Đầy`, 2 `Ngưng sử dụng`, không có `Bảo trì`.
- **Hạng phòng và hợp đồng:** migration 013 chuẩn hóa `HangPhong`, `DichVu`, `HangPhong_DichVu` và gắn hạng vào phòng. Migration 014 giữ `HopDong` làm hợp đồng theo phòng, còn thành viên và giá snapshot theo từng người nằm trong `ChiTietHopDong`; `GiaPhongApDung` lưu giá theo kỳ, `GiaPhongThangApDung` lưu riêng giá tháng. Hạng ký ban đầu được backfill từ phòng trong log `Tạo mới`; phòng hiện tại được đối chiếu với log `Chuyển phòng` mới nhất để xác định `NgayVao` của thành viên tại phòng đó. Nếu hợp đồng đã chuyển phòng nhưng thiếu log `Tạo mới`, migration dừng thay vì đoán hạng snapshot. Do proc legacy chỉ lưu phòng đích trong log chuyển, không thể khôi phục đầy đủ lịch sử phòng nguồn ngoài các log đang có. Hợp đồng cũ nhiều sinh viên phải được đối soát trước khi chạy migration; không tự gộp các hợp đồng hiệu lực cùng phòng.
- **Chi tiết hợp đồng cũ:** migration 014 sao lưu nguyên dòng vào `LichSuHopDong_Backup`, chuyển mỗi dòng sang `NhatKyHeThong` và so khớp số lượng trước khi xóa bảng cũ. API đọc dùng `vw_LichSuHopDongFE` trên bảng backup; không xóa bảng này khi reset. Các proc hợp đồng mới ghi vào `NhatKyHeThong`; FE không POST `/api/history` sau khi tạo/gia hạn/kết thúc.
- **Hóa đơn đến migration 015:** migration 015 thêm `HoaDon.LoaiHoaDon` (`TIEN_PHONG`, `DICH_VU_PHONG`, `CU`), gán mọi hóa đơn cũ thành `CU` và giữ nguyên mã/tổng. Giá mặc định cho hóa đơn mới vẫn là `CU` để backend legacy không ghi NULL trong giai đoạn chuyển tiếp.
- **Mã sinh viên:** migration mở rộng mọi cột `MaSinhVien` lên `nvarchar(30)`, giữ nullability, tháo/dựng lại FK và index do migration 002-005 tạo. Tham số của các proc BE mới/cập nhật phải dùng độ dài tối đa 30 để không cắt mã trước khi tới cột.
- **Mã hóa đơn:** `sp_TaoHoaDon` cấp `INVyyyymmNNNN`. Bộ đếm theo tháng được khóa trong transaction bằng `UPDLOCK, HOLDLOCK`, nên các request đồng thời không lấy cùng số. Gọi proc với `@MaHoaDon = NULL`; FE không tự tạo mã. Hết 9.999 số trong một tháng thì proc báo lỗi thay vì tạo mã trùng.
- **Mã hợp đồng:** giữ `Seq_MaHopDong`/`sp_TaoHopDong` từ migration 005; `NEXT VALUE FOR` cấp số an toàn đồng thời. BE gọi proc không truyền mã (hoặc `NULL`), FE không tự sinh mã.
- **Tương thích BE:** `api-routes.js` và backend hiện tại còn gọi các cột/proc hợp đồng legacy, trong đó có `HopDong.MaSinhVien` đã bị migration 014 xóa. Không dùng các route hợp đồng này sau khi chuyển đổi cho tới khi hoàn tất bước cập nhật BE; migration 014 không chuyển endpoint.
- **Chuẩn hóa:** gọi `dbo.sp_KiemTraChuanHoaDuLieu` không tham số để chỉ báo cáo. Chỉ khi chủ động chọn áp dụng mới gọi `EXEC dbo.sp_KiemTraChuanHoaDuLieu @ApDung = 1;`. Proc gọi `sp_CapNhatHopDong` để đóng các hợp đồng quá hạn. Danh sách sinh viên vẫn `Đang ở` dù hợp đồng đã kết thúc chỉ được xuất ra, không tự đổi trạng thái sinh viên/phòng.
- **Điện thoại Student:** `StudentAuth.register` chuẩn hóa `+84xxxxxxxxx` thành `0xxxxxxxxx` trước khi lưu/gửi tiếp; biểu mẫu vẫn nhận cả hai định dạng.

## Map thanh toán tập trung

`mapPaymentStatusToDatabase` và `mapPaymentMethodToDatabase` được định nghĩa một lần tại `server.js` và truyền vào route; không nhân đôi ở `api-routes.js` hay backend phụ. Các trạng thái giao dịch là `PENDING`, `SUCCESS`, `REJECTED`, `EXPIRED`, `RECONCILIATION`; API hiển thị `RECONCILIATION` thành `Cần đối soát`. Phiếu thu dùng `Hợp lệ`, `Chờ xác nhận`, `Đã hủy`.

Migration 021 giữ `GiaoDichThanhToan.TrangThai` ở `nvarchar(20)` để lưu đủ `RECONCILIATION`; trước đó cột `nvarchar(10)` có thể làm webhook nhận tiền vượt hóa đơn lỗi cắt chuỗi thay vì chuyển giao dịch sang đối soát.

| Giá trị FE | Giá trị CSDL | Cột/ý nghĩa |
| --- | --- | --- |
| `PAID` | `Đã thanh toán` | Trạng thái hạng mục; trạng thái hóa đơn được trigger tổng hợp |
| `UNPAID` | `Chưa thanh toán` | Trạng thái hạng mục/hóa đơn |
| `WAITING_CASH` | `Chờ tiền mặt` | `ChiTietHoaDon.TrangThai`; không ghi vào header `HoaDon.TrangThaiThanhToan` |
| `Tiền mặt` | `CASH` | `GiaoDichThanhToan.PhuongThuc` |
| `Chuyển khoản` | `ONLINE` | `GiaoDichThanhToan.PhuongThuc` |
| `Ví điện tử` | `ONLINE` | Nhóm thanh toán không tiền mặt trong schema hiện tại |

Sau migration 018, trạng thái header được trigger suy ra từ tổng phiếu thu `Hợp lệ`, gồm cả `Thanh toán một phần`; không cập nhật trạng thái header hay hạng mục để giả lập khoản thu. Phương thức `ONLINE` gộp chuyển khoản và ví điện tử vì schema chỉ có `CASH`/`ONLINE`.

## Endpoint FE đang gọi nhưng server.js chưa có

Backend Bước 5 đã cung cấp API quản lý hóa đơn, phát sinh, phiếu thu/chi, công nợ và payment. Student FE vẫn dùng localStorage/demo cho tới Bước 6. `POST /api/HoaDon` và `PUT /api/HoaDon/:id` trả HTTP 410 để FE cũ hiển thị thông báo; dùng `POST /api/HoaDon/xuat-ky` cho API mới.

| Method + endpoint | Nguồn dữ liệu/đối tượng BE nên dùng |
| --- | --- |
| `GET /api/nam-co-du-lieu` | `HoaDon.NgayLap`, `SinhVien.NgayRoiKTX`, `HopDong.NgayBatDau`/`NgayKetThuc` |
| `GET /api/tyle-roi-bo/:year` | `SinhVien.NgayRoiKTX`, `TrangThaiSinhVien` |
| `GET /api/gioi-tinh-sinh-vien` | `SinhVien.GioiTinh` |
| `GET /api/doanhthu/:year` | `vw_DoanhThuThang` (thu/chi hợp lệ theo nhóm, doanh thu ròng) |
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

`db/KTX_Group3_clean.sql` là một file sqlcmd UTF-8 tự chứa: schema từ dump gốc (đã loại các dòng INSERT dữ liệu vận hành), nội dung migrations 001-021 được nhúng trực tiếp, rồi master seeds và quyền database cho login `DNKTX`. File tạo DB đúng tên `KTX_Group3` để khớp `server.js`, bật database `QUOTED_IDENTIFIER`, đặt ANSI session options cần cho filtered indexes, dùng đường dẫn MDF/LDF mặc định của instance, giữ `DNKTX` trong `db_datareader`/`db_datawriter` và cấp `EXECUTE` tường minh cho đúng các procedure hợp đồng (Bước 4) và tiền (Bước 5) được API gọi. Yêu cầu login server-level `DNKTX` đã tồn tại và quyền tạo DB. Chạy từ thư mục gốc: `sqlcmd -f 65001 -I -S <server> -d master -U <user> -i db/KTX_Group3_clean.sql`. `-f 65001` bảo đảm input UTF-8 được đọc đúng. Script không drop DB đã có; chỉ chạy khi `KTX_Group3` chưa tồn tại.

Với database đã có schema nhưng các bảng vận hành đang rỗng, `db/run_all.sql` chạy migrations 001-021 bằng `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/run_all.sql`; sau đó nạp dữ liệu nền bằng `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/seed/run_master.sql`. Không chạy master room seed trên DB đang có người ở vì seed đặt sĩ số về 0. Các seed master dùng `MERGE` theo khóa tự nhiên và không tạo dữ liệu vận hành. `003_taikhoan_admin.sql` và clean SQL lưu bcrypt hash cost 12; BE chuyển các mật khẩu plaintext cũ sang bcrypt trước khi mở cổng. Mật khẩu bootstrap cũ từng xuất hiện trong bản gốc, do đó phải đổi mật khẩu trước khi cấp hệ thống cho người dùng khác.

Migration 020 cấp `EXECUTE` theo danh sách tường minh chỉ cho bảy procedure hợp đồng mà API Bước 4 gọi; nếu user database `DNKTX` chưa tồn tại, migration in cảnh báo và không ghi ledger để có thể thử lại sau khi user được tạo. Không cấp EXECUTE ở cấp database hoặc schema. `db_datareader` hiện có cung cấp SELECT cho các bảng/view; `db_datawriter` cung cấp quyền ghi bảng. Các procedure thanh toán như `sp_GhiPhieuThu` và `sp_TaoPhieuChi` chưa được cấp quyền; Bước 5 sẽ bổ sung đúng các procedure mà API mới sử dụng bằng migration riêng.

Sau khi chạy migration 014 trên bản sao DB cô lập, có thể kiểm thử mô hình bằng `sqlcmd -f 65001 -I -b -S <server> -d KTX_Group3_test -E -i db/tests/014_contract_members_verify.sql`; script tạo và dọn dữ liệu test. Để kiểm tra idempotence, chạy từ thư mục gốc repo: `sqlcmd -f 65001 -I -b -S <server> -d KTX_Group3_test -E -i db/tests/run_all_twice.sql`. Harness gọi `db/run_all.sql` hai lần liên tiếp và dừng ngay khi sqlcmd gặp lỗi. Cả hai script đều từ chối chạy nếu database hiện hành là `master`; không script test nào tự đổi database. `db/optional/merge_legacy_room_contracts.sql` không thuộc luồng migration mặc định: chạy trước bằng `-v ApDung=0` để xem ánh xạ, đối soát thủ công rồi mới dùng `-v ApDung=1`. Script chỉ gộp các hợp đồng cùng phòng có thời gian chồng lấn, khóa bảng hợp đồng khi áp dụng, rollback nếu vẫn còn nhiều hợp đồng hiệu lực/phòng, rồi tạo filtered unique index theo phòng.

## Migrations 016-022: hóa đơn, phát sinh, thu, hoàn và báo cáo

- Migration 016 thêm kỳ hóa đơn, liên kết hợp đồng/thành viên và snapshot dòng chi tiết. Hóa đơn mới dùng `TIEN_PHONG`, `DICH_VU_PHONG` hoặc `PHAT_SINH`; hóa đơn cũ tiếp tục là `CU`. Các unique kỳ tiền phòng/dịch vụ loại trừ hóa đơn `Đã hủy`; `PHAT_SINH` không chiếm unique kỳ dịch vụ. `MaSinhVien` trên hóa đơn nullable để các hóa đơn mới gắn chủ thể qua `MaChiTiet`/`MaHopDong`.
- Migration 017 lưu chi phí phát sinh; khi đã lập hóa đơn, dòng INCIDENT và khoản chi phí được khóa liên kết, không cho sửa/xóa để tránh mất dấu vết.
- Migration 018 tạo `PhieuThu`, `PhieuChi` và `PhieuChi_HoaDon`. Trạng thái hóa đơn sau chuyển đổi được suy ra từ tổng phiếu thu `Hợp lệ`; cả insert/update/delete thu đều khóa dòng hóa đơn để chống vượt tổng. Trigger bảo vệ chi tiết ngăn giảm tổng hóa đơn thấp hơn tổng đã thu. Phiếu chi chỉ được phân bổ vào hóa đơn `TIEN_PHONG` đúng thành viên, và tổng chi hợp lệ trên mỗi hóa đơn không vượt tổng thu hợp lệ.
- Migration 019 chuyển SUCCESS theo từng hóa đơn qua `ChiTietGiaoDich`; các dòng chi tiết cũ đã thanh toán nhận thêm phiếu `CHUYEN_DOI` cho phần còn thiếu, có ghi chú `Chuyển đổi từ dữ liệu cũ`. Chỉ xóa `ChiTietGiaoDich` sau khi in và xác nhận tổng đối chiếu. `GiaoDichThanhToan` vẫn được giữ làm bản ghi yêu cầu/đối soát và trigger đồng bộ trạng thái giao dịch sang phiếu thu.
- Migration 021 thêm `sp_XacNhanPhieuThu`/`sp_HuyPhieuThu`. Hai proc khóa hóa đơn bằng `UPDLOCK, HOLDLOCK`, chỉ xử lý phiếu `Chờ xác nhận`, kiểm tra `@@ROWCOUNT`, đồng bộ giao dịch và ghi `NhatKyHeThong`. Giao dịch xác nhận vượt tổng chuyển sang `RECONCILIATION` với `LyDoDoiSoat`; webhook nhận HTTP 200 và Quản lý thấy giao dịch trong `/api/payments/history`. Index lọc duy nhất trên `PhieuThu.MaGiaoDich` loại trừ phiếu đã hủy ngăn ghi thu trùng.
- Migration 028 thống nhất thứ tự khóa trên luồng thanh toán: `HoaDon` → `GiaoDichThanhToan` → `PhieuThu` → `HoanTienChuyenKhoanDu`. Các route khóa tuần tự trước khi gọi procedure; procedure xác nhận, hủy và hoàn tiền dư cũng lấy khóa theo thứ tự này. Các truy vấn tra cứu định danh trước đó chỉ dùng `READCOMMITTED`, không giữ khóa ghi.
- Migration 029 giữ nguyên kiểm tra chặn trùng kỳ của `sp_TaoHoaDonTienPhong`, bổ sung ngày lập tùy chọn để BE truyền ngày Việt Nam UTC+7; các caller khác mặc định cũng dùng ngày UTC+7 của SQL Server. Việc này chỉ tác động ngày lập/mã hóa đơn, không đổi thứ tự khóa thanh toán.
- Migration 022 mở rộng `vw_DoanhThuThang` thành thu, chi và doanh thu ròng theo tháng cho tiền phòng, dịch vụ/điện nước và phát sinh, đồng thời giữ các cột báo cáo cũ. `vw_CongNo` nhóm `TIEN_PHONG` theo sinh viên lấy qua `ChiTietHopDong`; `DICH_VU_PHONG`/`PHAT_SINH` theo phòng/hợp đồng, không phụ thuộc `HoaDon.MaSinhVien`. `/api/doanhthu/:year` trả đủ 12 tháng cùng các mảng tương thích `phong`/`dienNuoc`; `/api/congno` trả các cột `LoaiHoaDon`, phòng, hợp đồng, sinh viên (nếu có), tổng, đã thu và còn nợ.
- Kiểm thử báo cáo bằng `db/tests/022_financial_reports_verify.sql` sau `db/run_all.sql`. Script chỉ chạy trên `KTX_Group3_test`, tự tạo tài khoản quản lý, phòng, sinh viên, hợp đồng, hóa đơn và một khoản hoàn trong transaction rồi rollback; đối chiếu tổng công nợ với các dòng hóa đơn/phiếu thu và doanh thu ròng/nhóm với `PhieuThu` cùng `PhieuChi_HoaDon`.
- Quy trình xác minh báo cáo trên bản sao thử nghiệm: restore `C:\Temp\restore_test_safe.sql`, chạy `C:\Temp\fix_e2e.sql`, xác nhận `DB_NAME()` là `KTX_Group3_test`, chạy `db/run_all.sql` hai lần, `db/tests/022_financial_reports_verify.sql`, rồi `npm test` với `DB_NAME=KTX_Group3_test`. Không chạy migrations hoặc test trên `KTX_Group3`.
- API ghi số tiền VND dạng số nguyên dương; không nhận số dạng chuỗi, số thập phân hoặc số âm. Mọi thao tác ghi nhiều bước được bọc transaction và ghi nhật ký; API chỉ xác nhận/hủy phiếu chờ bằng hai stored procedure, không UPDATE trạng thái phiếu thu trực tiếp.
- `DNKTX` hiện thuộc `db_datawriter`, vì vậy GRANT EXECUTE tường minh **không phải** ranh giới bảo vệ số liệu tiền. Ràng buộc thực tế là trigger trên `PhieuThu`, `HoaDon`, `ChiTietHoaDon`, `PhieuChi` và phân bổ: khóa hóa đơn, chặn thu vượt tổng, chặn sửa/hủy trái điều kiện và chặn chi vượt thu. Migration 021 vẫn cấp EXECUTE riêng cho đúng tám procedure mà route Bước 5 gọi: `sp_TaoHoaDonTienPhong`, `sp_TaoHoaDonDichVuPhong`, `sp_TaoHoaDonPhatSinh`, `sp_GhiPhieuThu`, `sp_TinhGoiYHoanTien`, `sp_TaoPhieuChi`, `sp_XacNhanPhieuThu`, `sp_HuyPhieuThu`. Không cấp EXECUTE theo schema.
- `sp_TaoHoaDonTienPhong` tạo kỳ tháng hoặc năm theo snapshot giá hợp đồng. `sp_TaoHoaDonDichVuPhong` lấy dịch vụ/đơn giá từ hạng phòng, bỏ dịch vụ ngừng hoạt động và gom các khoản phát sinh chưa lập hóa đơn vào các dòng INCIDENT có tên duy nhất. `sp_TaoHoaDonPhatSinh` lập hóa đơn độc lập cho một khoản chi phí. Các view doanh thu dùng số thu hợp lệ trừ chi hợp lệ.
- Công thức gợi ý hoàn: số tháng sử dụng bằng 0 nếu ngày ra trùng ngày vào; nếu không, tính số tháng lịch đã bắt đầu và làm tròn lên khi còn ngày lẻ (5 tháng + 3 ngày thành 6 tháng). Tiền sử dụng = số tháng × giá tháng snapshot, làm tròn đến đồng; không có khấu trừ mặc định. Gợi ý = max(0, tổng thu tiền phòng hợp lệ - tiền sử dụng - khấu trừ - tổng hoàn hợp lệ trước đó). Quy tắc này không hoàn lại ưu đãi năm nếu tổng thu thấp hơn giá tháng nhân số tháng đã sử dụng.
- Kiểm thử sau khi restore bản sao `KTX_Group3_test`: chạy `db/run_all.sql` hai lần, rồi `db/tests/016_019_payment_workflows_verify.sql` và `db/tests/021_money_api_verify.sql`. Bài test tạo fixture giữ lại đến lần restore tiếp theo và in `ConcurrentReceiptTestInvoice`. Chạy hai sqlcmd worker đồng thời với cùng mã hóa đơn và kiểm tra chỉ một tiến trình thành công, tiến trình còn lại bị chặn bởi lỗi vượt tổng:

```powershell
# Chạy gần như đồng thời trong hai cửa sổ PowerShell riêng:
sqlcmd -f 65001 -I -b -S <server> -d KTX_Group3_test -E -v MaHoaDon=<mã vừa in> -i db/tests/019_concurrent_receipt_worker.sql
```

Kết quả hợp lệ là đúng một phiên in thông báo ghi nhận thành công; phiên kia báo lỗi 51916 (API ánh xạ lỗi này thành HTTP 409). Hóa đơn đã có 100 trước khi mở hai worker cùng thu 200; sau đó tổng `PhieuThu` hợp lệ phải đúng 300. `db/tests/021_money_api_verify.sql` cũng kiểm quyền bằng `EXECUTE AS USER = 'DNKTX'` và xác nhận quyền SELECT/INSERT/UPDATE cần cho route cùng EXECUTE chỉ trên tám procedure nêu trên.

Để kiểm tra đồng thời hoàn tiền, lấy `ConcurrentRefundTestMember` và `ConcurrentRefundTestExitDate` từ cùng bài test rồi chạy hai worker với các giá trị đó:

```powershell
# Chạy gần như đồng thời trong hai cửa sổ PowerShell riêng:
sqlcmd -f 65001 -I -b -S <server> -d KTX_Group3_test -E -v MaChiTiet=<mã thành viên> NgayRa=<YYYY-MM-DD> -i db/tests/019_concurrent_refund_worker.sql
```

Một worker phải lập được phiếu chi, worker còn lại bị chặn với lỗi 51937; cả hai đều in tổng thu/chi hợp lệ và kiểm tra tổng chi không vượt tổng thu.

- Kiểm thử backfill legacy bằng `db/tests/019_backfill_verify.sql`: restore bản backup vào `KTX_Group3_test`, chạy migrations 001-015, sau đó chạy script bằng `sqlcmd -f 65001 -I -b -S <server> -d KTX_Group3_test -E -i db/tests/019_backfill_verify.sql`. Script tự tạo hóa đơn/giao dịch legacy, chạy migrations 016-018, cố ý tăng sai tổng giao dịch SUCCESS để xác nhận lần chạy migration 019 đầu THROW 51902/rollback, sửa fixture rồi chạy lại 019 và đối chiếu tổng đã thu. Test phân biệt hóa đơn paid không giao dịch, paid partial/full SUCCESS, PENDING/REJECTED/EXPIRED và chi tiết `Chờ tiền mặt`; restore lại test DB sau khi hoàn thành vì fixture được giữ làm bằng chứng.

## Xóa dữ liệu vận hành

Trước khi reset phải backup theo lệnh/hướng dẫn trong `db/00_backup_note.md`. `db/maintenance/reset_operational_data.sql` mặc định chỉ đếm bảng; chỉ xóa thật khi truyền `-v XacNhan=1`. Sau migration 016-019, reset xóa các phiếu thu/chi, chi phí phát sinh, hóa đơn, `ChiTietHopDong` và `HopDong` theo thứ tự khóa ngoại. Trigger bảo vệ chi phí đã lập chỉ bị tắt trong transaction reset rõ ràng; reset giữ nguyên `LichSuHopDong_Backup` vĩnh viễn. Chạy từ thư mục gốc repo:

```powershell
sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/maintenance/reset_operational_data.sql
sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -v XacNhan=1 -i db/maintenance/reset_operational_data.sql
```

Không chạy script reset trên production nếu chưa kiểm tra bản backup.

Với bộ dữ liệu E2E release, `db/maintenance/inspect_e2e_release_students.sql` chỉ đọc và liệt kê cả hợp đồng lẫn từng chi tiết thành viên trong các hợp đồng bị ảnh hưởng. `db/maintenance/remove_e2e_release_students.sql` mặc định chạy transaction rồi rollback; chỉ sau khi xem kết quả kiểm kê và tạo backup mới đổi `DECLARE @ApDung bit = 0` thành `1` để commit. Script xóa chi tiết thành viên mục tiêu trước, chỉ xóa hợp đồng không còn bất kỳ chi tiết nào, chuyển đại diện cho thành viên còn ở nếu cần, rồi đồng bộ hồ sơ/phòng. `LichSuHopDong_Backup` và `NhatKyHeThong` được giữ nguyên.

## Kiểm chứng

Sau khi dựng `KTX_Group3`, chạy `sqlcmd -f 65001 -I -S <server> -d KTX_Group3 -U <user> -i db/audit.sql`, rồi test `POST /api/login` bằng tài khoản Quản lý đã seed. Chỉ đánh dấu đã xác minh khi cả hai chạy được trên SQL Server đích. Audit dùng mô hình thành viên sau migration 014 và sẽ báo lệch sĩ số, phòng, giới tính, thời gian lưu trú chồng lấn, sinh viên có nhiều chỗ ở hiệu lực và phòng có nhiều hợp đồng hiệu lực.