const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const utilizadorResumoSelect = {
    IdUtilizador: true,
    NomeCompleto: true,
    Email: true,
    Permissoes: true
};

const pedidoInclude = {
    Encarregado: {
        include: {
            Utilizador: {
                select: utilizadorResumoSelect
            }
        }
    },
    Aluno: {
        include: {
            Utilizador: {
                select: utilizadorResumoSelect
            }
        }
    },
    EstiloDanca: true,
    AulaCriada: {
        include: {
            Professor: {
                include: {
                    Utilizador: {
                        select: utilizadorResumoSelect
                    }
                }
            },
            Estudio: true,
            EstiloDanca: true
        }
    },
    DiretorDecisao: {
        select: {
            IdUtilizador: true,
            NomeCompleto: true
        }
    }
};

const privateLessonRequestRepository = {
    findAll: async () => {
        return await prisma.pedidoAula.findMany({
            include: pedidoInclude,
            orderBy: [
                { DataPedido: 'desc' },
                { IdPedidoAulaPrivada: 'desc' }
            ]
        });
    },

    findByGuardian: async (idEncarregado) => {
        return await prisma.pedidoAula.findMany({
            where: { IdEncarregado: idEncarregado },
            include: pedidoInclude,
            orderBy: [
                { DataPedido: 'desc' },
                { IdPedidoAulaPrivada: 'desc' }
            ]
        });
    },

    findById: async (idPedidoAulaPrivada) => {
        return await prisma.pedidoAula.findUnique({
            where: { IdPedidoAulaPrivada: idPedidoAulaPrivada },
            include: pedidoInclude
        });
    },

    create: async (dados) => {
        return await prisma.pedidoAula.create({
            data: {
                IdEncarregado: dados.IdEncarregado,
                IdAluno: dados.IdAluno,
                IdEstiloDanca: dados.IdEstiloDanca,
                DataPretendida: dados.DataPretendida,
                HoraPretendida: dados.HoraPretendida,
                DuracaoMinutos: dados.DuracaoMinutos,
                CapacidadePretendida: dados.CapacidadePretendida,
                Observacoes: dados.Observacoes ?? null,
                EstadoPedido: dados.EstadoPedido || 'Pendente'
            },
            include: pedidoInclude
        });
    },

    update: async (idPedidoAulaPrivada, dados) => {
        return await prisma.pedidoAula.update({
            where: { IdPedidoAulaPrivada: idPedidoAulaPrivada },
            data: dados,
            include: pedidoInclude
        });
    }
};

module.exports = privateLessonRequestRepository;
