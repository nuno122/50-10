// Versão corrigida e limpa
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const paymentRepository = {

    criarPagamento: async (dadosPagamento) => {
        return await prisma.pagamento.create({
            data: {
                PrazoPagamento:  dadosPagamento.DataLimite,
                Custo:           dadosPagamento.Valor,
                EstadoPagamento: dadosPagamento.estado || 'Pendente',
                IdMarcacao:      dadosPagamento.IdMarcacao || null,
                IdAluguer:       dadosPagamento.IdAluguer  || null
            }
        });
    },

    buscarTodosPagamentos: async () => {
        return await prisma.pagamento.findMany({
            include: {
                Aluguer: true,
                Marcacao: {
                    include: { Aluno: true, Aula: true }
                }
            },
            orderBy: { PrazoPagamento: 'desc' }
        });
    },

    buscarPagamentosEmAtraso: async () => {
        return await prisma.pagamento.findMany({
            where: {
                EstadoPagamento: 'Pendente',
                PrazoPagamento: { lt: new Date() }
            },
            include: {
                Marcacao: {
                    include: { Aluno: true, Aula: true }
                },
                Aluguer: true
            }
        });
    },

    buscarPagamentoPorId: async (id) => {
        return await prisma.pagamento.findUnique({
            where: { IdPagamento: id }
        });
    },

    registarRecebimento: async (id) => {
        return await prisma.pagamento.update({
            where: { IdPagamento: id },
            data: {
                EstadoPagamento: 'Pago',
                DataPagamento:   new Date()
            }
        });
    }
};

module.exports = paymentRepository;