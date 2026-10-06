BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_wo_operations] ADD [specialty_type] NVARCHAR(80);

-- AlterTable
ALTER TABLE [dbo].[mnt_work_request] ADD [specialty_type] NVARCHAR(80);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
