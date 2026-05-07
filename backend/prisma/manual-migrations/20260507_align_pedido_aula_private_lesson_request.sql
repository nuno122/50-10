SET NOCOUNT ON;

IF COL_LENGTH('dbo.PedidoAula', 'IdProfessorSolicitado') IS NULL
BEGIN
    ALTER TABLE dbo.PedidoAula
    ADD IdProfessorSolicitado uniqueidentifier NULL;
END;

IF COL_LENGTH('dbo.PedidoAula', 'IdProfessorConfirmado') IS NULL
BEGIN
    ALTER TABLE dbo.PedidoAula
    ADD IdProfessorConfirmado uniqueidentifier NULL;
END;

IF COL_LENGTH('dbo.PedidoAula', 'ObservacaoProfessor') IS NULL
BEGIN
    ALTER TABLE dbo.PedidoAula
    ADD ObservacaoProfessor nvarchar(max) NULL;
END;

IF COL_LENGTH('dbo.PedidoAula', 'DataRespostaProfessor') IS NULL
BEGIN
    ALTER TABLE dbo.PedidoAula
    ADD DataRespostaProfessor datetime2 NULL;
END;

UPDATE dbo.PedidoAula
SET EstadoPedido = N'PendenteProfessor'
WHERE EstadoPedido = N'Pendente';

UPDATE dbo.PedidoAula
SET EstadoPedido = N'RejeitadoDirecao'
WHERE EstadoPedido = N'Rejeitado';

DECLARE @DefaultConstraintName sysname;

SELECT @DefaultConstraintName = dc.name
FROM sys.default_constraints AS dc
INNER JOIN sys.columns AS c
    ON c.default_object_id = dc.object_id
INNER JOIN sys.tables AS t
    ON t.object_id = c.object_id
WHERE t.name = 'PedidoAula'
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND c.name = 'EstadoPedido';

IF @DefaultConstraintName IS NOT NULL
BEGIN
    DECLARE @DropConstraintSql nvarchar(max);
    SET @DropConstraintSql = N'ALTER TABLE dbo.PedidoAula DROP CONSTRAINT [' + @DefaultConstraintName + N']';
    EXEC sp_executesql @DropConstraintSql;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables AS t
        ON t.object_id = c.object_id
    WHERE t.name = 'PedidoAula'
      AND SCHEMA_NAME(t.schema_id) = 'dbo'
      AND c.name = 'EstadoPedido'
)
BEGIN
    ALTER TABLE dbo.PedidoAula
    ADD CONSTRAINT DF_PedidoAula_EstadoPedido
    DEFAULT N'PendenteProfessor' FOR EstadoPedido;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'PedidoAula_IdProfessorSolicitado_fkey'
      AND parent_object_id = OBJECT_ID('dbo.PedidoAula')
)
BEGIN
    ALTER TABLE dbo.PedidoAula WITH CHECK
    ADD CONSTRAINT PedidoAula_IdProfessorSolicitado_fkey
    FOREIGN KEY (IdProfessorSolicitado) REFERENCES dbo.Professor (IdUtilizador);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'PedidoAula_IdProfessorConfirmado_fkey'
      AND parent_object_id = OBJECT_ID('dbo.PedidoAula')
)
BEGIN
    ALTER TABLE dbo.PedidoAula WITH CHECK
    ADD CONSTRAINT PedidoAula_IdProfessorConfirmado_fkey
    FOREIGN KEY (IdProfessorConfirmado) REFERENCES dbo.Professor (IdUtilizador);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'PedidoAula_IdProfessorSolicitado_EstadoPedido_idx'
      AND object_id = OBJECT_ID('dbo.PedidoAula')
)
BEGIN
    CREATE INDEX PedidoAula_IdProfessorSolicitado_EstadoPedido_idx
    ON dbo.PedidoAula (IdProfessorSolicitado, EstadoPedido);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'PedidoAula_IdProfessorConfirmado_EstadoPedido_idx'
      AND object_id = OBJECT_ID('dbo.PedidoAula')
)
BEGIN
    CREATE INDEX PedidoAula_IdProfessorConfirmado_EstadoPedido_idx
    ON dbo.PedidoAula (IdProfessorConfirmado, EstadoPedido);
END;
