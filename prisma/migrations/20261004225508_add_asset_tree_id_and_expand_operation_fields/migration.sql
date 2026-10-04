BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_wo_operations] ALTER COLUMN [unit] NVARCHAR(370) NULL;
ALTER TABLE [dbo].[mnt_wo_operations] ALTER COLUMN [subunit] NVARCHAR(370) NULL;
ALTER TABLE [dbo].[mnt_wo_operations] ALTER COLUMN [maintainable_item] NVARCHAR(370) NULL;
ALTER TABLE [dbo].[mnt_wo_operations] ADD [asset_tree_id] BIGINT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
