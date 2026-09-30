SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
    THROW 50120, N'Chạy migrations 001-008 trước khi seed master.', 1;

MERGE dbo.CauHinhHeThong AS target
USING (VALUES
    (N'DON_GIA_DIEN', N'3500', N'Đơn giá điện (VND / chỉ số)'),
    (N'DON_GIA_NUOC', N'15000', N'Đơn giá nước (VND / chỉ số)'),
    (N'SO_NGAY_HAN_THANH_TOAN', N'15', N'Số ngày cộng vào NgayLap để ra hạn thanh toán'),
    (N'NGUONG_CANH_BAO_HET_HAN_ADMIN', N'7', N'Số ngày còn lại để cảnh báo admin'),
    (N'NGUONG_CANH_BAO_HET_HAN_SV', N'30', N'Số ngày còn lại để cảnh báo sinh viên'),
    (N'THOI_GIAN_HET_HAN_QR_PHUT', N'15', N'Thời gian hết hạn giao dịch ONLINE PENDING (phút)')
) AS source (Khoa, GiaTri, MoTa)
ON target.Khoa = source.Khoa
WHEN MATCHED THEN
    UPDATE SET GiaTri = source.GiaTri, MoTa = source.MoTa
WHEN NOT MATCHED THEN
    INSERT (Khoa, GiaTri, MoTa) VALUES (source.Khoa, source.GiaTri, source.MoTa);
GO