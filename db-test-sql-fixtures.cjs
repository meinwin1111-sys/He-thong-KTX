const assert = require("node:assert/strict");
const crypto = require("node:crypto");

async function createSqlIntegrationFixture(pool, sql, {
    roomMemberCount = 3,
    unassignedCount = 0,
    createOtherRoomStudent = true,
    roomPrefix = "T5-",
    roomCapacity = 4,
    studentPrefix = "T5",
    managerEmailPrefix = "b5-",
    tierPrefix = "T5HP",
    servicePrefix = "T5DV",
    suffixLength = 12,
    studentIdFactory,
    leaveTransactionOpen = false
} = {}) {
    const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
    assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");

    const suffix = crypto.randomBytes(8).toString("hex").slice(0, suffixLength).toUpperCase();
    const fixture = {
        managerEmail: `${managerEmailPrefix}${suffix.toLowerCase()}@example.test`,
        tierId: `${tierPrefix}${suffix}`,
        tierName: `B5 fixture ${suffix}`,
        serviceId: `${servicePrefix}${suffix}`,
        serviceName: `B5 service ${suffix}`,
        roomA: `${roomPrefix}${suffix}-A`,
        roomB: `${roomPrefix}${suffix}-B`,
        studentIds: Array.from(
            { length: roomMemberCount + unassignedCount + Number(createOtherRoomStudent) },
            (_, index) => studentIdFactory
                ? studentIdFactory(index)
                : `${studentPrefix}${suffix}${String.fromCharCode(65 + index)}`
        )
    };

    const transaction = new sql.Transaction(pool);
    let committed = false;
    let currentStep = "beginning SQL fixture transaction";
    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        currentStep = "inserting fixture manager account";
        const manager = await new sql.Request(transaction)
            .input("Email", sql.VarChar(100), fixture.managerEmail)
            .input("TenHienThi", sql.NVarChar(100), `B5 manager ${suffix}`)
            .query(`
                INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro)
                OUTPUT inserted.MaTaiKhoan
                VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Quản lý')
            `);
        fixture.managerId = manager.recordset[0].MaTaiKhoan;

        currentStep = "inserting fixture room tier";
        await new sql.Request(transaction)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .input("TenHangPhong", sql.NVarChar(100), fixture.tierName)
            .input("RoomCapacity", sql.Int, roomCapacity)
            .query(`
                INSERT INTO dbo.HangPhong
                    (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang, GiaPhongNam)
                VALUES (@MaHangPhong, @TenHangPhong, @RoomCapacity, 1200000, 14400000)
            `);
        currentStep = "inserting fixture service";
        await new sql.Request(transaction)
            .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
            .input("TenDichVu", sql.NVarChar(100), fixture.serviceName)
            .query(`
                INSERT INTO dbo.DichVu (MaDichVu, TenDichVu, DonVi, HoatDong)
                VALUES (@MaDichVu, @TenDichVu, N'lần', 1)
            `);
        currentStep = "linking fixture service to room tier";
        await new sql.Request(transaction)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
            .query(`
                INSERT INTO dbo.HangPhong_DichVu
                    (MaHangPhong, MaDichVu, DonGia, CachTinh, DoiTuongThanhToan, HoatDong)
                VALUES (@MaHangPhong, @MaDichVu, 1000, N'CO_DINH_KY', N'PHONG', 1)
            `);

        for (const roomName of [fixture.roomA, fixture.roomB]) {
            currentStep = `inserting fixture room ${roomName}`;
            await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), roomName)
                .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                .input("RoomCapacity", sql.Int, roomCapacity)
                .query(`
                    INSERT INTO dbo.Phong
                        (TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong,
                         SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                    VALUES (@TenPhong, N'C', N'Nam', @RoomCapacity, @MaHangPhong, 0, N'Trống', N'B5 isolated SQL fixture')
                `);
        }

        for (let index = 0; index < fixture.studentIds.length; index++) {
            const studentId = fixture.studentIds[index];
            currentStep = `inserting fixture student ${studentId}`;
            await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("Email", sql.NVarChar(100), `${studentId.toLowerCase()}@example.test`)
                .query(`
                    INSERT INTO dbo.SinhVien
                        (MaSinhVien, HoTen, GioiTinh, Email, TrangThaiSinhVien, TenPhong)
                    VALUES (@MaSinhVien, @MaSinhVien, N'Nam', @Email, NULL, NULL)
                `);
        }
        if (leaveTransactionOpen) {
            fixture.transaction = transaction;
        } else {
            await transaction.commit();
            committed = true;
        }
        return fixture;
    } catch (error) {
        if (!committed) {
            try {
                await transaction.rollback();
            } catch {
                // Preserve the SQL failure that caused the transaction to abort.
            }
        }
        error.message = `[createSqlIntegrationFixture: ${currentStep}] ${error.message}`;
        throw error;
    }
}

async function createNonFixtureContract(pool, sql, {
    roomPrefix = "NR-",
    studentPrefix = "NR",
    managerEmailPrefix = "nrtrigger-",
    tierPrefix = "NRHP",
    servicePrefix = "NRDV",
    suffixLength = 12,
    studentIdFactory
} = {}) {
    const fixture = await createSqlIntegrationFixture(pool, sql, {
        roomMemberCount: 1,
        createOtherRoomStudent: false,
        roomPrefix,
        studentPrefix,
        managerEmailPrefix,
        tierPrefix,
        servicePrefix,
        suffixLength,
        studentIdFactory,
        leaveTransactionOpen: true
    });
    const transaction = fixture.transaction;
    const contractId = `NRH${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const startDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 372 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
        await new sql.Request(transaction)
            .input("TenPhong", sql.NVarChar(50), fixture.roomA)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("NgayBatDau", sql.Date, startDate)
            .input("NgayKetThuc", sql.Date, endDate)
            .query(`
                INSERT INTO dbo.HopDong
                    (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
                     TrangThaiHopDong, NgayTao, SoLanGiaHan)
                VALUES
                    (@MaHopDong, @TenPhong, @MaHangPhong, @NgayBatDau, @NgayKetThuc,
                     N'Còn hiệu lực', CONVERT(date, GETDATE()), 0)
            `);
        await new sql.Request(transaction)
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MaSinhVien", sql.NVarChar(30), fixture.studentIds[0])
            .input("NgayVao", sql.Date, startDate)
            .input("GiaPhong", sql.Decimal(18, 2), 1200000)
            .query(`
                INSERT INTO dbo.ChiTietHopDong
                    (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong,
                     GiaPhongApDung, GiaPhongThangApDung,
                     LaNguoiDaiDienThanhToanDichVu, TrangThai)
                VALUES
                    (@MaHopDong, @MaSinhVien, @NgayVao, N'THANG',
                     @GiaPhong, @GiaPhong, 1, N'Đang ở')
            `);
        const member = await new sql.Request(transaction)
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaChiTiet, MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        assert.equal(member.recordset.length, 1);
        return {
            ...fixture,
            contractId,
            memberId: member.recordset[0].MaChiTiet,
            studentId: member.recordset[0].MaSinhVien
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            if (rollbackError.code !== "EABORT") throw rollbackError;
        }
        throw error;
    }
}

module.exports = { createSqlIntegrationFixture, createNonFixtureContract };
