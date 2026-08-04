/*
  Warnings:

  - The primary key for the `mnt_human_resources` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `organizations` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[mnt_human_resources] DROP CONSTRAINT [mnt_human_resources_pkey];
ALTER TABLE [dbo].[mnt_human_resources] ALTER COLUMN [supervisor_id] NVARCHAR(255) NULL;
ALTER TABLE [dbo].[mnt_human_resources] ADD CONSTRAINT mnt_human_resources_pkey PRIMARY KEY CLUSTERED ([resource_code]);

-- DropTable
DROP TABLE [dbo].[organizations];

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_hr_org_code] ON [dbo].[mnt_human_resources]([organization_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_op_hr_resource_code] ON [dbo].[mnt_operation_human_resource_usages]([resource_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_wo_op_asset_code] ON [dbo].[mnt_wo_operations]([asset_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_wr_asset_code] ON [dbo].[mnt_work_request]([asset_code]);

-- AddForeignKey
ALTER TABLE [dbo].[mnt_work_request] ADD CONSTRAINT [mnt_work_request_asset_code_fkey] FOREIGN KEY ([asset_code]) REFERENCES [dbo].[mnt_assets]([asset_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_work_orders] ADD CONSTRAINT [mnt_work_orders_work_request_id_fkey] FOREIGN KEY ([work_request_id]) REFERENCES [dbo].[mnt_work_request]([request_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_wo_operations] ADD CONSTRAINT [mnt_wo_operations_work_order_code_fkey] FOREIGN KEY ([work_order_code]) REFERENCES [dbo].[mnt_work_orders]([work_order_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_operation_material_usages] ADD CONSTRAINT [mnt_operation_material_usages_operation_code_fkey] FOREIGN KEY ([operation_code]) REFERENCES [dbo].[mnt_wo_operations]([operation_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_operation_human_resource_usages] ADD CONSTRAINT [mnt_operation_human_resource_usages_operation_code_fkey] FOREIGN KEY ([operation_code]) REFERENCES [dbo].[mnt_wo_operations]([operation_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_operation_human_resource_usages] ADD CONSTRAINT [mnt_operation_human_resource_usages_resource_code_fkey] FOREIGN KEY ([resource_code]) REFERENCES [dbo].[mnt_human_resources]([resource_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
