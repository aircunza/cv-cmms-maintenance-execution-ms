BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[organizations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [country_code] NVARCHAR(10) NOT NULL,
    [country_name] NVARCHAR(100) NOT NULL,
    [timezone] NVARCHAR(100) NOT NULL,
    [offset_minutes] INT,
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [organizations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET NOT NULL CONSTRAINT [organizations_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    [is_active] CHAR(1) NOT NULL CONSTRAINT [organizations_is_active_df] DEFAULT 'Y',
    CONSTRAINT [organizations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [organizations_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[work_areas] (
    [work_area_id] UNIQUEIDENTIFIER NOT NULL,
    [work_area_code] NVARCHAR(255) NOT NULL,
    [work_area_description] NVARCHAR(255),
    [organization_code] NVARCHAR(255) NOT NULL,
    [is_active] CHAR(1) NOT NULL CONSTRAINT [work_areas_is_active_df] DEFAULT 'Y',
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [work_areas_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [work_areas_pkey] PRIMARY KEY CLUSTERED ([work_area_id]),
    CONSTRAINT [uq_work_area_code_per_organization] UNIQUE NONCLUSTERED ([work_area_code],[organization_code])
);

-- CreateTable
CREATE TABLE [dbo].[work_centers] (
    [work_center_id] UNIQUEIDENTIFIER NOT NULL,
    [work_center_code] NVARCHAR(255) NOT NULL,
    [work_center_description] NVARCHAR(255),
    [work_area_id] UNIQUEIDENTIFIER NOT NULL,
    [center_cost_code] INT NOT NULL,
    [center_cost_description] NVARCHAR(255),
    [is_active] CHAR(1) NOT NULL CONSTRAINT [work_centers_is_active_df] DEFAULT 'Y',
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [work_centers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [work_centers_pkey] PRIMARY KEY CLUSTERED ([work_center_id]),
    CONSTRAINT [uq_work_centers_center_cost_code] UNIQUE NONCLUSTERED ([center_cost_code],[work_area_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_work_areas_organization_code] ON [dbo].[work_areas]([organization_code]);

-- AddForeignKey
ALTER TABLE [dbo].[work_areas] ADD CONSTRAINT [work_areas_organization_code_fkey] FOREIGN KEY ([organization_code]) REFERENCES [dbo].[organizations]([code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[work_centers] ADD CONSTRAINT [work_centers_work_area_id_fkey] FOREIGN KEY ([work_area_id]) REFERENCES [dbo].[work_areas]([work_area_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mnt_assets] ADD CONSTRAINT [mnt_assets_work_center_id_fkey] FOREIGN KEY ([work_center_id]) REFERENCES [dbo].[work_centers]([work_center_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
