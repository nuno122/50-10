SET NOCOUNT ON;

IF OBJECT_ID('dbo.Evento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Evento (
        IdEvento uniqueidentifier NOT NULL
            CONSTRAINT PK_Evento PRIMARY KEY
            CONSTRAINT DF_Evento_IdEvento DEFAULT (newsequentialid()),
        IdUtilizadorCriador uniqueidentifier NOT NULL,
        Titulo nvarchar(200) NOT NULL,
        Descricao nvarchar(max) NOT NULL,
        DataPublicacaoInicio datetime2 NOT NULL,
        DataPublicacaoFim datetime2 NOT NULL,
        DataEvento date NOT NULL,
        Local nvarchar(200) NOT NULL,
        TipoEvento nvarchar(100) NOT NULL,
        Link nvarchar(500) NOT NULL,
        EstadoEvento bit NOT NULL
            CONSTRAINT DF_Evento_EstadoEvento DEFAULT ((1))
    );
END;

IF COL_LENGTH('dbo.Evento', 'IdUtilizadorCriador') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD IdUtilizadorCriador uniqueidentifier NOT NULL;
END;

IF COL_LENGTH('dbo.Evento', 'Titulo') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD Titulo nvarchar(200) NOT NULL CONSTRAINT DF_Evento_Titulo DEFAULT (N'');
END;

IF COL_LENGTH('dbo.Evento', 'Descricao') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD Descricao nvarchar(max) NOT NULL CONSTRAINT DF_Evento_Descricao DEFAULT (N'');
END;

IF COL_LENGTH('dbo.Evento', 'DataPublicacaoInicio') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD DataPublicacaoInicio datetime2 NOT NULL CONSTRAINT DF_Evento_DataPublicacaoInicio DEFAULT (GETDATE());
END;

IF COL_LENGTH('dbo.Evento', 'DataPublicacaoFim') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD DataPublicacaoFim datetime2 NOT NULL CONSTRAINT DF_Evento_DataPublicacaoFim DEFAULT (GETDATE());
END;

IF COL_LENGTH('dbo.Evento', 'DataEvento') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD DataEvento date NOT NULL CONSTRAINT DF_Evento_DataEvento DEFAULT (CONVERT(date, GETDATE()));
END;

IF COL_LENGTH('dbo.Evento', 'Local') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD Local nvarchar(200) NOT NULL CONSTRAINT DF_Evento_Local DEFAULT (N'');
END;

IF COL_LENGTH('dbo.Evento', 'TipoEvento') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD TipoEvento nvarchar(100) NOT NULL CONSTRAINT DF_Evento_TipoEvento DEFAULT (N'');
END;

IF COL_LENGTH('dbo.Evento', 'Link') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD Link nvarchar(500) NOT NULL CONSTRAINT DF_Evento_Link DEFAULT (N'');
END;

IF COL_LENGTH('dbo.Evento', 'EstadoEvento') IS NULL
BEGIN
    ALTER TABLE dbo.Evento ADD EstadoEvento bit NOT NULL CONSTRAINT DF_Evento_EstadoEvento_Auto DEFAULT ((1));
END;

IF OBJECT_ID('dbo.EventoComentario', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventoComentario (
        IdEventoComentario uniqueidentifier NOT NULL
            CONSTRAINT PK_EventoComentario PRIMARY KEY
            CONSTRAINT DF_EventoComentario_IdEventoComentario DEFAULT (newsequentialid()),
        IdEvento uniqueidentifier NOT NULL,
        IdProfessor uniqueidentifier NOT NULL,
        Comentario nvarchar(max) NOT NULL,
        DataComentario datetime2 NOT NULL
            CONSTRAINT DF_EventoComentario_DataComentario DEFAULT (GETDATE())
    );
END;

IF COL_LENGTH('dbo.EventoComentario', 'IdEvento') IS NULL
BEGIN
    ALTER TABLE dbo.EventoComentario ADD IdEvento uniqueidentifier NOT NULL;
END;

IF COL_LENGTH('dbo.EventoComentario', 'IdProfessor') IS NULL
BEGIN
    ALTER TABLE dbo.EventoComentario ADD IdProfessor uniqueidentifier NOT NULL;
END;

IF COL_LENGTH('dbo.EventoComentario', 'Comentario') IS NULL
BEGIN
    ALTER TABLE dbo.EventoComentario ADD Comentario nvarchar(max) NOT NULL CONSTRAINT DF_EventoComentario_Comentario DEFAULT (N'');
END;

IF COL_LENGTH('dbo.EventoComentario', 'DataComentario') IS NULL
BEGIN
    ALTER TABLE dbo.EventoComentario ADD DataComentario datetime2 NOT NULL CONSTRAINT DF_EventoComentario_DataComentario_Auto DEFAULT (GETDATE());
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'Evento_IdUtilizadorCriador_fkey'
      AND parent_object_id = OBJECT_ID('dbo.Evento')
)
BEGIN
    ALTER TABLE dbo.Evento WITH CHECK
    ADD CONSTRAINT Evento_IdUtilizadorCriador_fkey
    FOREIGN KEY (IdUtilizadorCriador) REFERENCES dbo.Utilizador (IdUtilizador);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'EventoComentario_IdEvento_fkey'
      AND parent_object_id = OBJECT_ID('dbo.EventoComentario')
)
BEGIN
    ALTER TABLE dbo.EventoComentario WITH CHECK
    ADD CONSTRAINT EventoComentario_IdEvento_fkey
    FOREIGN KEY (IdEvento) REFERENCES dbo.Evento (IdEvento)
    ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'EventoComentario_IdProfessor_fkey'
      AND parent_object_id = OBJECT_ID('dbo.EventoComentario')
)
BEGIN
    ALTER TABLE dbo.EventoComentario WITH CHECK
    ADD CONSTRAINT EventoComentario_IdProfessor_fkey
    FOREIGN KEY (IdProfessor) REFERENCES dbo.Professor (IdUtilizador);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'Evento_EstadoEvento_DataPublicacaoInicio_DataPublicacaoFim_idx'
      AND object_id = OBJECT_ID('dbo.Evento')
)
BEGIN
    CREATE INDEX Evento_EstadoEvento_DataPublicacaoInicio_DataPublicacaoFim_idx
    ON dbo.Evento (EstadoEvento, DataPublicacaoInicio, DataPublicacaoFim);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'Evento_DataEvento_idx'
      AND object_id = OBJECT_ID('dbo.Evento')
)
BEGIN
    CREATE INDEX Evento_DataEvento_idx
    ON dbo.Evento (DataEvento);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'Evento_IdUtilizadorCriador_DataPublicacaoInicio_idx'
      AND object_id = OBJECT_ID('dbo.Evento')
)
BEGIN
    CREATE INDEX Evento_IdUtilizadorCriador_DataPublicacaoInicio_idx
    ON dbo.Evento (IdUtilizadorCriador, DataPublicacaoInicio);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'EventoComentario_IdEvento_DataComentario_idx'
      AND object_id = OBJECT_ID('dbo.EventoComentario')
)
BEGIN
    CREATE INDEX EventoComentario_IdEvento_DataComentario_idx
    ON dbo.EventoComentario (IdEvento, DataComentario);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'EventoComentario_IdProfessor_DataComentario_idx'
      AND object_id = OBJECT_ID('dbo.EventoComentario')
)
BEGIN
    CREATE INDEX EventoComentario_IdProfessor_DataComentario_idx
    ON dbo.EventoComentario (IdProfessor, DataComentario);
END;
