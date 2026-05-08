SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [name] = 'PedidoAula_IdAulaCriada_key'
      AND [parent_object_id] = OBJECT_ID('dbo.PedidoAula')
)
BEGIN
    ALTER TABLE dbo.PedidoAula
    DROP CONSTRAINT [PedidoAula_IdAulaCriada_key];
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = 'PedidoAula_IdAulaCriada_key'
      AND [object_id] = OBJECT_ID('dbo.PedidoAula')
      AND [is_unique] = 1
      AND [is_unique_constraint] = 0
      AND [filter_definition] IS NULL
)
BEGIN
    DROP INDEX [PedidoAula_IdAulaCriada_key]
    ON dbo.PedidoAula;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = 'PedidoAula_IdAulaCriada_key'
      AND [object_id] = OBJECT_ID('dbo.PedidoAula')
      AND [is_unique] = 1
      AND [filter_definition] = '([IdAulaCriada] IS NOT NULL)'
)
BEGIN
    CREATE UNIQUE INDEX [PedidoAula_IdAulaCriada_key]
    ON dbo.PedidoAula ([IdAulaCriada])
    WHERE [IdAulaCriada] IS NOT NULL;
END;
