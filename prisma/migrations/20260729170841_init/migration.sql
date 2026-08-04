BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[organizations] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [country_code] NVARCHAR(10) NOT NULL,
    [country_name] NVARCHAR(100) NOT NULL,
    [is_active] CHAR(1) NOT NULL CONSTRAINT [organizations_is_active_df] DEFAULT 'Y',
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [organizations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET NOT NULL CONSTRAINT [organizations_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [organizations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [organizations_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_assets] (
    [asset_code] NVARCHAR(80) NOT NULL,
    [asset_description] NVARCHAR(240),
    [asset_short_description] NVARCHAR(200),
    [asset_status] NVARCHAR(100),
    [operational_hours_origin] NVARCHAR(100),
    [organization_code] NVARCHAR(255) NOT NULL,
    [organization_name] NVARCHAR(255),
    [country_code] NVARCHAR(10),
    [country_name] NVARCHAR(100),
    [work_center_id] UNIQUEIDENTIFIER,
    [work_center_code] NVARCHAR(255),
    [work_center_description] NVARCHAR(255),
    [center_cost_code] INT,
    [work_area_code] NVARCHAR(255),
    [work_area_description] NVARCHAR(255),
    [accounting_account_code] NVARCHAR(100),
    [supervisor_code] NVARCHAR(255),
    [asset_dependency] NVARCHAR(100),
    [process_type_code] NVARCHAR(100),
    [subprocess_type_code] NVARCHAR(100),
    [hierarchy_code] NVARCHAR(100),
    [class] NVARCHAR(100),
    [enabled_maintenance_program] CHAR(1),
    [enabled_maintenance_hours_control] CHAR(1),
    [enabled_financial_kpi] CHAR(1),
    [enabled_technical_kpi] CHAR(1),
    [wo_allowed_flag] CHAR(1),
    [created_by] NVARCHAR(255),
    [updated_by] NVARCHAR(255),
    [update_up] DATETIMEOFFSET,
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [mnt_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [enabled_iiot] CHAR(1),
    [sector] NVARCHAR(50),
    [subsector] NVARCHAR(50),
    [is_active] CHAR(1) NOT NULL CONSTRAINT [mnt_assets_is_active_df] DEFAULT 'Y',
    CONSTRAINT [mnt_assets_pkey] PRIMARY KEY CLUSTERED ([asset_code]),
    CONSTRAINT [uq_mnt_assets_code] UNIQUE NONCLUSTERED ([asset_code],[work_center_id])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_human_resources] (
    [resource_code] NVARCHAR(255) NOT NULL,
    [resource_name] NVARCHAR(255) NOT NULL,
    [resource_type] NVARCHAR(30) NOT NULL,
    [organization_code] NVARCHAR(255) NOT NULL,
    [organization_name] NVARCHAR(255),
    [availability_status] NVARCHAR(255) NOT NULL,
    [supervisor_id] UNIQUEIDENTIFIER,
    [supervisor_name] NVARCHAR(70),
    [is_active] CHAR(1),
    [created_at] DATETIMEOFFSET NOT NULL CONSTRAINT [mnt_human_resources_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    CONSTRAINT [mnt_human_resources_pkey] PRIMARY KEY CLUSTERED ([organization_code],[resource_code])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_work_request] (
    [request_id] BIGINT NOT NULL IDENTITY(1,1),
    [asset_code] NVARCHAR(80) NOT NULL,
    [asset_short_description] NVARCHAR(200),
    [issue_description] NVARCHAR(240) NOT NULL,
    [status_code] NVARCHAR(30) NOT NULL,
    [requested_at] DATETIMEOFFSET NOT NULL CONSTRAINT [mnt_work_request_requested_at_df] DEFAULT CURRENT_TIMESTAMP,
    [completed_at] DATETIMEOFFSET,
    [released_at] DATETIMEOFFSET,
    [canceled_at] DATETIMEOFFSET,
    [work_center_code] NVARCHAR(255),
    [work_center_description] NVARCHAR(255),
    [center_cost_code] INT,
    [work_area_code] NVARCHAR(255),
    [work_area_description] NVARCHAR(255),
    [sector] NVARCHAR(50),
    [subsector] NVARCHAR(50),
    [organization_code] NVARCHAR(255) NOT NULL,
    [organization_name] NVARCHAR(255),
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_work_request_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    CONSTRAINT [mnt_work_request_pkey] PRIMARY KEY CLUSTERED ([request_id])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_work_orders] (
    [work_order_code] BIGINT NOT NULL IDENTITY(1,1),
    [work_order_description] NVARCHAR(240),
    [asset_code] NVARCHAR(80),
    [asset_short_description] NVARCHAR(200),
    [work_order_type] NVARCHAR(30),
    [work_order_sub_type] NVARCHAR(30),
    [work_definition_code] NVARCHAR(140),
    [work_order_priority] NVARCHAR(30),
    [wo_status_code] NVARCHAR(30) NOT NULL,
    [scheduling_method] NVARCHAR(30),
    [planned_start_date] DATETIMEOFFSET,
    [planned_completion_date] DATETIMEOFFSET,
    [planned_hours] FLOAT(53),
    [actual_start_date] DATETIMEOFFSET,
    [actual_completion_date] DATETIMEOFFSET,
    [actual_hours] FLOAT(53),
    [released_date] DATETIMEOFFSET,
    [closed_date] DATETIMEOFFSET,
    [canceled_date] DATETIMEOFFSET,
    [canceled_reason] NVARCHAR(240),
    [need_by_date] DATETIMEOFFSET,
    [work_request_id] BIGINT,
    [work_center_code] NVARCHAR(255),
    [work_center_description] NVARCHAR(255),
    [center_cost_code] INT,
    [work_area_code] NVARCHAR(255),
    [work_area_description] NVARCHAR(255),
    [sector] NVARCHAR(50),
    [subsector] NVARCHAR(50),
    [organization_code] NVARCHAR(255) NOT NULL,
    [organization_name] NVARCHAR(255),
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    [ocl_work_order_id] BIGINT,
    [ocl_work_order_number] NVARCHAR(120),
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_work_orders_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [mnt_work_orders_pkey] PRIMARY KEY CLUSTERED ([work_order_code])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_wo_operations] (
    [operation_code] BIGINT NOT NULL IDENTITY(1,1),
    [operation_name] NVARCHAR(120),
    [operation_description] NVARCHAR(240),
    [operation_seq_number] INT,
    [work_order_code] BIGINT NOT NULL,
    [asset_code] NVARCHAR(80),
    [asset_short_description] NVARCHAR(200),
    [unit] NVARCHAR(240),
    [subunit] NVARCHAR(240),
    [maintainable_item] NVARCHAR(240),
    [operation_category] NVARCHAR(100),
    [operation_status] NVARCHAR(30) NOT NULL,
    [operation_type] NVARCHAR(30),
    [planned_start_date] DATETIMEOFFSET,
    [planned_completion_date] DATETIMEOFFSET,
    [actual_start_date] DATETIMEOFFSET,
    [actual_completion_date] DATETIMEOFFSET,
    [planned_hours] FLOAT(53),
    [actual_hours] FLOAT(53),
    [ocl_work_order_id] BIGINT,
    [ocl_work_order_number] NVARCHAR(120),
    [client_operation_id] UNIQUEIDENTIFIER,
    [work_center_code] NVARCHAR(255),
    [work_center_description] NVARCHAR(255),
    [center_cost_code] INT,
    [work_area_code] NVARCHAR(255),
    [work_area_description] NVARCHAR(255),
    [sector] NVARCHAR(50),
    [subsector] NVARCHAR(50),
    [organization_code] NVARCHAR(255) NOT NULL,
    [organization_name] NVARCHAR(255),
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    [reviewed_by] UNIQUEIDENTIFIER,
    [reviewed_by_name] NVARCHAR(70),
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_wo_operations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    [reviewed_at] DATETIMEOFFSET,
    CONSTRAINT [mnt_wo_operations_pkey] PRIMARY KEY CLUSTERED ([operation_code]),
    CONSTRAINT [uq_wo_op_client_op_id] UNIQUE NONCLUSTERED ([client_operation_id])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_operation_material_usages] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [operation_code] BIGINT NOT NULL,
    [organization_code] NVARCHAR(255) NOT NULL,
    [material_code] NVARCHAR(255) NOT NULL,
    [material_name] NVARCHAR(255),
    [quantity] FLOAT(53),
    [unit_cost] DECIMAL(18,2),
    [total_cost] DECIMAL(18,2),
    [supply_type] CHAR(1) CONSTRAINT [mnt_operation_material_usages_supply_type_df] DEFAULT '1',
    [material_sequence_number] INT,
    [transacted_in_oracle] CHAR(1) CONSTRAINT [mnt_operation_material_usages_transacted_in_oracle_df] DEFAULT 'N',
    [ocl_wo_operation_material_id] BIGINT,
    [synced_to_oracle_at] DATETIMEOFFSET,
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_operation_material_usages_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [mnt_operation_material_usages_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[mnt_operation_human_resource_usages] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [operation_code] BIGINT NOT NULL,
    [organization_code] NVARCHAR(255) NOT NULL,
    [resource_code] NVARCHAR(255) NOT NULL,
    [planned_hours] FLOAT(53),
    [actual_hours] FLOAT(53),
    [hourly_cost] DECIMAL(18,2),
    [principal_flag] CHAR(1) CONSTRAINT [mnt_operation_human_resource_usages_principal_flag_df] DEFAULT 'N',
    [resource_sequence_number] INT,
    [planned_start_date] DATETIMEOFFSET,
    [planned_completion_date] DATETIMEOFFSET,
    [usage_rate] DECIMAL(18,2),
    [transacted_in_oracle] CHAR(1) CONSTRAINT [mnt_operation_human_resource_usages_transacted_in_oracle_df] DEFAULT 'N',
    [ocl_wo_operation_resource_id] BIGINT,
    [synced_to_oracle_at] DATETIMEOFFSET,
    [created_by] UNIQUEIDENTIFIER NOT NULL,
    [created_by_name] NVARCHAR(70) NOT NULL,
    [updated_by] UNIQUEIDENTIFIER,
    [updated_by_name] NVARCHAR(70),
    [created_at] DATETIMEOFFSET CONSTRAINT [mnt_operation_human_resource_usages_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIMEOFFSET,
    CONSTRAINT [mnt_operation_human_resource_usages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_op_hr_resource_sequence] UNIQUE NONCLUSTERED ([operation_code],[resource_code],[resource_sequence_number])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_mnt_assets_org_code] ON [dbo].[mnt_assets]([organization_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_wo_work_request_id] ON [dbo].[mnt_work_orders]([work_request_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_wo_asset_code] ON [dbo].[mnt_work_orders]([asset_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_wo_op_work_order_code] ON [dbo].[mnt_wo_operations]([work_order_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_op_mat_operation_code] ON [dbo].[mnt_operation_material_usages]([operation_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_op_hr_operation_code] ON [dbo].[mnt_operation_human_resource_usages]([operation_code]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
