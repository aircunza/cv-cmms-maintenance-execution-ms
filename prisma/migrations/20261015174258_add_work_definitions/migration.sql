BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[mnt_work_definitions] (
    [work_definition_id] BIGINT NOT NULL IDENTITY(1,1),
    [work_definition_code] NVARCHAR(255) NOT NULL,
    [work_definition_description] NVARCHAR(500) NOT NULL,
    [is_active] CHAR(1) NOT NULL CONSTRAINT [mnt_work_definitions_is_active_df] DEFAULT 'Y',
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_work_definitions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [mnt_work_definitions_pkey] PRIMARY KEY CLUSTERED ([work_definition_id]),
    CONSTRAINT [mnt_work_definitions_work_definition_code_key] UNIQUE NONCLUSTERED ([work_definition_code])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
