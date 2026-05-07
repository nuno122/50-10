IF COL_LENGTH('dbo.Artigo', 'IdUtilizadorCriador') IS NULL
BEGIN
    ALTER TABLE dbo.Artigo
    ADD IdUtilizadorCriador uniqueidentifier NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'Artigo_IdUtilizadorCriador_fkey'
)
BEGIN
    ALTER TABLE dbo.Artigo
    ADD CONSTRAINT Artigo_IdUtilizadorCriador_fkey
    FOREIGN KEY (IdUtilizadorCriador) REFERENCES dbo.Utilizador (IdUtilizador);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'Artigo_IdUtilizadorCriador_idx'
      AND object_id = OBJECT_ID('dbo.Artigo')
)
BEGIN
    CREATE INDEX Artigo_IdUtilizadorCriador_idx
    ON dbo.Artigo (IdUtilizadorCriador);
END
GO
