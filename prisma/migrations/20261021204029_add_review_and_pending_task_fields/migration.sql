/*
  Warnings:

  - You are about to drop the column `reviewed_by` on the `mnt_wo_operations` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_wo_operations] ALTER COLUMN [reviewed_by_name] NVARCHAR(254) NULL;
ALTER TABLE [dbo].[mnt_wo_operations] DROP COLUMN [reviewed_by];
ALTER TABLE [dbo].[mnt_wo_operations] ADD [pending_task] NVARCHAR(1370),
[pending_task_status] NVARCHAR(40),
[reviewed_by_code] NVARCHAR(254),
[reviewer_comment] NVARCHAR(254);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
