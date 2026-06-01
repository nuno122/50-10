const prisma = require('../database/prisma');

const utilizadorResumoSelect = {
    IdUtilizador: true,
    NomeCompleto: true,
    Email: true,
    Permissoes: true
};

const comentarioInclude = {
    Professor: {
        include: {
            Utilizador: {
                select: utilizadorResumoSelect
            }
        }
    }
};

const eventoInclude = {
    Criador: {
        select: utilizadorResumoSelect
    },
    EventoComentario: {
        orderBy: [
            { DataComentario: 'desc' },
            { IdEventoComentario: 'desc' }
        ],
        include: comentarioInclude
    }
};

const eventRepository = {
    findAll: async () => {
        return await prisma.evento.findMany({
            include: eventoInclude,
            orderBy: [
                { DataEvento: 'asc' },
                { DataPublicacaoInicio: 'desc' },
                { IdEvento: 'desc' }
            ]
        });
    },

    findPublished: async (currentDate) => {
        return await prisma.evento.findMany({
            where: {
                EstadoEvento: true,
                DataPublicacaoInicio: { lte: currentDate },
                DataPublicacaoFim: { gte: currentDate }
            },
            include: eventoInclude,
            orderBy: [
                { DataEvento: 'asc' },
                { DataPublicacaoInicio: 'desc' },
                { IdEvento: 'desc' }
            ]
        });
    },

    findById: async (idEvento) => {
        return await prisma.evento.findUnique({
            where: { IdEvento: idEvento },
            include: eventoInclude
        });
    },

    create: async (dados) => {
        return await prisma.evento.create({
            data: {
                IdUtilizadorCriador: dados.IdUtilizadorCriador,
                Titulo: dados.Titulo,
                Descricao: dados.Descricao,
                DataPublicacaoInicio: dados.DataPublicacaoInicio,
                DataPublicacaoFim: dados.DataPublicacaoFim,
                DataEvento: dados.DataEvento,
                Local: dados.Local,
                TipoEvento: dados.TipoEvento,
                Link: dados.Link,
                EstadoEvento: dados.EstadoEvento
            },
            include: eventoInclude
        });
    },

    update: async (idEvento, dados) => {
        return await prisma.evento.update({
            where: { IdEvento: idEvento },
            data: {
                Titulo: dados.Titulo,
                Descricao: dados.Descricao,
                DataPublicacaoInicio: dados.DataPublicacaoInicio,
                DataPublicacaoFim: dados.DataPublicacaoFim,
                DataEvento: dados.DataEvento,
                Local: dados.Local,
                TipoEvento: dados.TipoEvento,
                Link: dados.Link,
                EstadoEvento: dados.EstadoEvento
            },
            include: eventoInclude
        });
    },

    delete: async (idEvento) => {
        return await prisma.evento.delete({
            where: { IdEvento: idEvento }
        });
    },

    findCommentById: async (idEventoComentario) => {
        return await prisma.eventoComentario.findUnique({
            where: { IdEventoComentario: idEventoComentario },
            include: comentarioInclude
        });
    },

    createComment: async (dados) => {
        return await prisma.eventoComentario.create({
            data: {
                IdEvento: dados.IdEvento,
                IdProfessor: dados.IdProfessor,
                Comentario: dados.Comentario
            },
            include: comentarioInclude
        });
    },

    updateComment: async (idEventoComentario, dados) => {
        return await prisma.eventoComentario.update({
            where: { IdEventoComentario: idEventoComentario },
            data: {
                Comentario: dados.Comentario,
                DataComentario: dados.DataComentario
            },
            include: comentarioInclude
        });
    }
};

module.exports = eventRepository;
