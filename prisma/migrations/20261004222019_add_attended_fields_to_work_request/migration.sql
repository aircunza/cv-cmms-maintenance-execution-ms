BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_work_request] ADD [attended_by_supervisor] NVARCHAR(255),
[attended_by_supervisor_name] NVARCHAR(255),
[attended_by_technician] NVARCHAR(255),
[attended_by_technician_name] NVARCHAR(255);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
