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
:r db/migrations/011_student_registration_approval.sql
GO
PRINT N'=== Migration 012 ==='
GO
:r db/migrations/012_align_student_request_type_check.sql
GO
PRINT N'=== Migration 013 ==='
GO
:r db/migrations/013_room_classes_services.sql
GO
PRINT N'=== Migration 014 ==='
GO
:r db/migrations/014_contract_members.sql
GO
PRINT N'=== Migration 015 ==='
GO
:r db/migrations/015_invoice_types.sql
GO
PRINT N'=== Migration 016 ==='
GO
:r db/migrations/016_invoice_periods_and_details.sql
GO
PRINT N'=== Migration 017 ==='
GO
:r db/migrations/017_incident_costs.sql
GO
PRINT N'=== Migration 018 ==='
GO
:r db/migrations/018_receipts_and_refunds.sql
GO
PRINT N'=== Migration 019 ==='
GO
:r db/migrations/019_payment_workflows.sql
GO
PRINT N'=== Migration 020 ==='
GO
:r db/migrations/020_grant_app_permissions.sql
GO
PRINT N'=== Migration 021 ==='
GO
:r db/migrations/021_money_api_permissions.sql
GO
PRINT N'=== Migration 022 ==='
GO
:r db/migrations/022_complete_financial_reports.sql
GO
PRINT N'=== Hết run_all (master seed chạy riêng: db/seed/run_master.sql) ==='
GO
