BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_wo_operations] ADD [assigned_to_code] NVARCHAR(255),
[assigned_to_name] NVARCHAR(255);

-- AlterTable
ALTER TABLE [dbo].[mnt_work_orders] ADD [assigned_to_code] NVARCHAR(255),
[assigned_to_name] NVARCHAR(255);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
