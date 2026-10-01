-- Chạy từ thư mục gốc repo. Bắt buộc -I (QUOTED_IDENTIFIER ON).
-- sqlcmd -I -S 127.0.0.1,53606 -d KTX_Group3 -U DNKTX -i db/run_all.sql
:on error exit
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
PRINT N'=== Migration 001 ==='
GO
:r db/migrations/001_fix_existing_objects.sql
GO
PRINT N'=== Migration 002 ==='
GO
:r db/migrations/002_schema_extensions.sql
GO
PRINT N'=== Migration 003 ==='
GO
:r db/migrations/003_invoice_items_payments.sql
GO
PRINT N'=== Migration 004 ==='
GO
:r db/migrations/004_requests_and_audit.sql
GO
PRINT N'=== Migration 005 ==='
GO
:r db/migrations/005_procs_views_indexes.sql
GO
PRINT N'=== Migration 006 ==='
GO
:r db/migrations/006_schema_alignment.sql
GO
PRINT N'=== Migration 007 ==='
GO
:r db/migrations/007_data_normalization_reports.sql
GO
PRINT N'=== Migration 008 ==='
GO
:r db/migrations/008_room_price_by_capacity.sql
GO
PRINT N'=== Migration 009 ==='
GO
:r db/migrations/009_canonical_management_role.sql
GO
PRINT N'=== Migration 010 ==='
GO
:r db/migrations/010_fixes.sql
GO
PRINT N'=== Migration 011 ==='
GO
:r db/migrations/011_align_student_request_type_check.sql
GO
PRINT N'=== Hết run_all (master seed chạy riêng: db/seed/run_master.sql) ==='
GO
