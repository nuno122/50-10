const prisma = require('../database/prisma');

const normalizeLimit = (limit) => {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) {
        return 100;
    }

    return Math.max(1, Math.min(Math.trunc(parsed), 200));
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

const ensureTable = async () => true;

const findByUser = async (idUtilizador, { apenasNaoLidas = false, limit = 100 } = {}) => {
    const rows = await prisma.notificacao.findMany({
        where: {
            IdUtilizador: idUtilizador,
            ...(apenasNaoLidas ? { Lida: false } : {})
        },
        orderBy: {
            DataCriacao: 'desc'
        },
        take: normalizeLimit(limit)
    });

    return rows.map(mapNotification);
};

const createMany = async (notifications = []) => {
    const items = (Array.isArray(notifications) ? notifications : [])
        .filter((item) => item?.IdUtilizador && item?.Titulo)
        .map((item) => ({
            IdUtilizador: item.IdUtilizador,
            Titulo: String(item.Titulo || '').trim(),
            Mensagem: item.Mensagem ? String(item.Mensagem).trim() : '',
            Tipo: item.Tipo ? String(item.Tipo).trim() : 'info',
            EntidadeTipo: item.EntidadeTipo ? String(item.EntidadeTipo).trim() : null,
            EntidadeId: item.EntidadeId || null
        }));

    if (items.length === 0) {
        return [];
    }

    const created = await prisma.$transaction(
        items.map((item) => prisma.notificacao.create({ data: item }))
    );

    return created.map(mapNotification);
};

const markAsRead = async (idNotificacao, idUtilizador) => {
    const existing = await prisma.notificacao.findFirst({
        where: {
            IdNotificacao: idNotificacao,
            IdUtilizador: idUtilizador
        }
    });

    if (!existing) {
        return null;
    }

    const updated = await prisma.notificacao.update({
        where: {
            IdNotificacao: idNotificacao
        },
        data: {
            Lida: true
        }
    });

    return mapNotification(updated);
};

const markAllAsRead = async (idUtilizador) => {
    const result = await prisma.notificacao.updateMany({
        where: {
            IdUtilizador: idUtilizador,
            Lida: false
        },
        data: {
            Lida: true
        }
    });

    return result.count || 0;
};

const removeOne = async (idNotificacao, idUtilizador) => {
    const result = await prisma.notificacao.deleteMany({
        where: {
            IdNotificacao: idNotificacao,
            IdUtilizador: idUtilizador
        }
    });

    return result.count || 0;
};

const removeAllByUser = async (idUtilizador) => {
    const result = await prisma.notificacao.deleteMany({
        where: {
            IdUtilizador: idUtilizador
        }
    });

    return result.count || 0;
};

module.exports = {
    ensureTable,
    findByUser,
    createMany,
    markAsRead,
    markAllAsRead,
    removeOne,
    removeAllByUser
};
