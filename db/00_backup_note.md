# Backup trước khi migrate

Chạy trên bản sao hoặc sau khi đã backup. Không chạy migration lần đầu trên production nếu chưa có file `.bak`.

## Full backup (SQL Server)

Trong `sqlcmd` (cờ `-I` bật `QUOTED_IDENTIFIER`; database gốc đang `QUOTED_IDENTIFIER OFF`):

```sql
-- Chỉnh đường dẫn DISK cho máy bạn. SQL Server service account phải ghi được thư mục này.
BACKUP DATABASE [KTX_Group3]
TO DISK = N'C:\Backup\KTX_Group3_pre_migrate.bak'
WITH COPY_ONLY, INIT, STATS = 10;
```

PowerShell / cmd (từ thư mục repo):

```bat
sqlcmd -I -S 127.0.0.1,53606 -d master -U DNKTX -P "<MAT_KHAU>" -Q "BACKUP DATABASE [KTX_Group3] TO DISK = N'C:\Backup\KTX_Group3_pre_migrate.bak' WITH COPY_ONLY, INIT, STATS = 10"
```

## Restore nhanh (kiểm tra migration)

```sql
RESTORE DATABASE [KTX_Group3_MigrateTest]
FROM DISK = N'C:\Backup\KTX_Group3_pre_migrate.bak'
WITH MOVE N'DMS_Group6' TO N'C:\Data\KTX_Group3_MigrateTest.mdf',
     MOVE N'DMS_Group6_log' TO N'C:\Data\KTX_Group3_MigrateTest.ldf',
     REPLACE;
```

Tên logical file trong dump gốc là `DMS_Group6` / `DMS_Group6_log` (không phải `KTX_Group3`). Tra lại bằng `RESTORE FILELISTONLY`.
