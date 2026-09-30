/*
  Warnings:

  - Added the required column `operator_code` to the `mnt_work_request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operator_name` to the `mnt_work_request` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_work_request] ADD [operator_code] NVARCHAR(255) NOT NULL,
[operator_name] NVARCHAR(255) NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
