const { sql, getSqlConfig } = require('../database/sqlServer');

const NOTIFICATION_TABLE_SQL = `
IF OBJECT_ID('dbo.Notificacao', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notificacao (
        IdNotificacao UNIQUEIDENTIFIER NOT NULL DEFAULT newsequentialid() PRIMARY KEY,
        IdUtilizador UNIQUEIDENTIFIER NOT NULL,
        Titulo NVARCHAR(200) NOT NULL,
        Mensagem NVARCHAR(MAX) NULL,
        Tipo NVARCHAR(20) NOT NULL CONSTRAINT DF_Notificacao_Tipo DEFAULT 'info',
        Lida BIT NOT NULL CONSTRAINT DF_Notificacao_Lida DEFAULT 0,
        DataCriacao DATETIME2 NOT NULL CONSTRAINT DF_Notificacao_DataCriacao DEFAULT SYSUTCDATETIME(),
        EntidadeTipo NVARCHAR(100) NULL,
        EntidadeId UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_Notificacao_Utilizador FOREIGN KEY (IdUtilizador) REFERENCES dbo.Utilizador(IdUtilizador)
    );

    CREATE INDEX IX_Notificacao_Utilizador_DataCriacao ON dbo.Notificacao(IdUtilizador, DataCriacao DESC);
    CREATE INDEX IX_Notificacao_Utilizador_Lida ON dbo.Notificacao(IdUtilizador, Lida, DataCriacao DESC);
END
`;

const withPool = async (callback) => {
    const pool = await sql.connect(getSqlConfig());

    try {
        return await callback(pool);
    } finally {
        await pool.close();
    }
};

const mapNotification = (row) => ({
    IdNotificacao: row.IdNotificacao,
    IdUtilizador: row.IdUtilizador,
    Titulo: row.Titulo,
    Mensagem: row.Mensagem || '',
    Tipo: row.Tipo || 'info',
    Lida: Boolean(row.Lida),
    DataCriacao: row.DataCriacao instanceof Date ? row.DataCriacao.toISOString() : row.DataCriacao,
    EntidadeTipo: row.EntidadeTipo || null,
    EntidadeId: row.EntidadeId || null
});

const ensureTable = async () => {
    await withPool(async (pool) => {
        await pool.request().query(NOTIFICATION_TABLE_SQL);
    });
};

const findByUser = async (idUtilizador, { apenasNaoLidas = false, limit = 100 } = {}) => {
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 200)) : 100;

    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);
        request.input('limit', sql.Int, safeLimit);
        request.input('apenasNaoLidas', sql.Bit, apenasNaoLidas ? 1 : 0);

        const result = await request.query(`
            SELECT TOP (@limit)
                IdNotificacao,
                IdUtilizador,
                Titulo,
                Mensagem,
                Tipo,
                Lida,
                DataCriacao,
                EntidadeTipo,
                EntidadeId
            FROM dbo.Notificacao
            WHERE IdUtilizador = @idUtilizador
              AND (@apenasNaoLidas = 0 OR Lida = 0)
            ORDER BY DataCriacao DESC
        `);

        return result.recordset.map(mapNotification);
    });
};

const findEntityIdsByUserAndType = async (idUtilizador, entidadeTipo) => {
    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);
        request.input('entidadeTipo', sql.NVarChar(100), entidadeTipo);

        const result = await request.query(`
            SELECT EntidadeId
            FROM dbo.Notificacao
            WHERE IdUtilizador = @idUtilizador
              AND EntidadeTipo = @entidadeTipo
              AND EntidadeId IS NOT NULL
        `);

        return result.recordset.map((row) => String(row.EntidadeId));
    });
};

const createMany = async (notifications = []) => {
    const items = (Array.isArray(notifications) ? notifications : [])
        .filter((item) => item?.IdUtilizador && item?.Titulo);

    if (items.length === 0) {
        return [];
    }

    return await withPool(async (pool) => {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const created = [];

            for (const item of items) {
                const request = new sql.Request(transaction);
                request.input('idUtilizador', sql.UniqueIdentifier, item.IdUtilizador);
                request.input('titulo', sql.NVarChar(200), String(item.Titulo || '').trim());
                request.input('mensagem', sql.NVarChar(sql.MAX), item.Mensagem ? String(item.Mensagem).trim() : '');
                request.input('tipo', sql.NVarChar(20), String(item.Tipo || 'info').trim() || 'info');
                request.input('entidadeTipo', sql.NVarChar(100), item.EntidadeTipo ? String(item.EntidadeTipo).trim() : null);
                request.input('entidadeId', sql.UniqueIdentifier, item.EntidadeId || null);

                const result = await request.query(`
                    INSERT INTO dbo.Notificacao (IdUtilizador, Titulo, Mensagem, Tipo, EntidadeTipo, EntidadeId)
                    OUTPUT
                        inserted.IdNotificacao,
                        inserted.IdUtilizador,
                        inserted.Titulo,
                        inserted.Mensagem,
                        inserted.Tipo,
                        inserted.Lida,
                        inserted.DataCriacao,
                        inserted.EntidadeTipo,
                        inserted.EntidadeId
                    VALUES (@idUtilizador, @titulo, @mensagem, @tipo, @entidadeTipo, @entidadeId)
                `);

                if (result.recordset[0]) {
                    created.push(mapNotification(result.recordset[0]));
                }
            }

            await transaction.commit();
            return created;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    });
};

const markAsRead = async (idNotificacao, idUtilizador) => {
    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idNotificacao', sql.UniqueIdentifier, idNotificacao);
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);

        const result = await request.query(`
            UPDATE dbo.Notificacao
            SET Lida = 1
            OUTPUT
                inserted.IdNotificacao,
                inserted.IdUtilizador,
                inserted.Titulo,
                inserted.Mensagem,
                inserted.Tipo,
                inserted.Lida,
                inserted.DataCriacao,
                inserted.EntidadeTipo,
                inserted.EntidadeId
            WHERE IdNotificacao = @idNotificacao
              AND IdUtilizador = @idUtilizador
        `);

        return result.recordset[0] ? mapNotification(result.recordset[0]) : null;
    });
};

const markAllAsRead = async (idUtilizador) => {
    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);

        const result = await request.query(`
            UPDATE dbo.Notificacao
            SET Lida = 1
            WHERE IdUtilizador = @idUtilizador
              AND Lida = 0
        `);

        return result.rowsAffected?.[0] || 0;
    });
};

const removeOne = async (idNotificacao, idUtilizador) => {
    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idNotificacao', sql.UniqueIdentifier, idNotificacao);
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);

        const result = await request.query(`
            DELETE FROM dbo.Notificacao
            WHERE IdNotificacao = @idNotificacao
              AND IdUtilizador = @idUtilizador
        `);

        return result.rowsAffected?.[0] || 0;
    });
};

const removeAllByUser = async (idUtilizador) => {
    return await withPool(async (pool) => {
        const request = pool.request();
        request.input('idUtilizador', sql.UniqueIdentifier, idUtilizador);

        const result = await request.query(`
            DELETE FROM dbo.Notificacao
            WHERE IdUtilizador = @idUtilizador
        `);

        return result.rowsAffected?.[0] || 0;
    });
};

module.exports = {
    ensureTable,
    findByUser,
    findEntityIdsByUserAndType,
    createMany,
    markAsRead,
    markAllAsRead,
    removeOne,
    removeAllByUser
};
