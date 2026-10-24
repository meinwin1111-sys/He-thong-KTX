:on error exit
IF DB_NAME() <> N'KTX_Group3_test'
    THROW 51720, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO
:r db/run_all.sql
:r db/run_all.sql
PRINT N'PASS: db/run_all.sql chạy liên tiếp hai lần không lỗi.';
GO
