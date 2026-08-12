BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_operation_human_resource_usages] ADD [actual_completion_date] DATETIMEOFFSET,
[actual_start_date] DATETIMEOFFSET,
[canceled_reason] NVARCHAR(240),
[status] NVARCHAR(30) NOT NULL CONSTRAINT [mnt_operation_human_resource_usages_status_df] DEFAULT 'ACTIVE';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
