BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_work_orders] ADD [add_attribute_1] NVARCHAR(254),
[add_attribute_10] NVARCHAR(254),
[add_attribute_2] NVARCHAR(254),
[add_attribute_3] NVARCHAR(254),
[add_attribute_4] NVARCHAR(254),
[add_attribute_5] NVARCHAR(254),
[add_attribute_6] NVARCHAR(254),
[add_attribute_7] NVARCHAR(254),
[add_attribute_8] NVARCHAR(254),
[add_attribute_9] NVARCHAR(254),
[old_id] INT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
