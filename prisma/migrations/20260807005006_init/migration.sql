/*
  Warnings:

  - You are about to drop the column `usage_rate` on the `mnt_operation_human_resource_usages` table. All the data in the column will be lost.
  - You are about to drop the column `client_operation_id` on the `mnt_wo_operations` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[mnt_wo_operations] DROP CONSTRAINT [uq_wo_op_client_op_id];

-- AlterTable
ALTER TABLE [dbo].[mnt_operation_human_resource_usages] DROP COLUMN [usage_rate];

-- AlterTable
ALTER TABLE [dbo].[mnt_wo_operations] DROP COLUMN [client_operation_id];
ALTER TABLE [dbo].[mnt_wo_operations] ADD [operation_sub_type] NVARCHAR(30);

-- AlterTable
ALTER TABLE [dbo].[mnt_work_orders] ADD [enable_oracle_work_order] CHAR(1) NOT NULL CONSTRAINT [mnt_work_orders_enable_oracle_work_order_df] DEFAULT 'N',
[total_man_hours] FLOAT(53),
[total_supplier_hours] FLOAT(53);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
