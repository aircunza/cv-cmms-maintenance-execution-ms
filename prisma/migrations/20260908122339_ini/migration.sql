BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[mnt_assets_tree] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [asset_code] NVARCHAR(80) NOT NULL,
    [unit] NVARCHAR(370) NOT NULL,
    [subunit] NVARCHAR(370) NOT NULL,
    [maintainable_item] NVARCHAR(370) NOT NULL,
    [spare_part_code] NVARCHAR(255) NOT NULL,
    [spare_part_name] NVARCHAR(255) NOT NULL,
    [created_by] UNIQUEIDENTIFIER,
    [created_by_name] NVARCHAR(70),
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [mnt_assets_tree_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    [is_active] CHAR(1) NOT NULL CONSTRAINT [mnt_assets_tree_is_active_df] DEFAULT 'Y',
    CONSTRAINT [mnt_assets_tree_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_assets_tree_combination] UNIQUE NONCLUSTERED ([asset_code],[unit],[subunit],[maintainable_item],[spare_part_code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_assets_tree_asset_code] ON [dbo].[mnt_assets_tree]([asset_code]);

-- AddForeignKey
ALTER TABLE [dbo].[mnt_assets_tree] ADD CONSTRAINT [mnt_assets_tree_asset_code_fkey] FOREIGN KEY ([asset_code]) REFERENCES [dbo].[mnt_assets]([asset_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
