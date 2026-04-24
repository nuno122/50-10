const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const paymentRepository = {
    create: async (dadosPagamento) => {
        return await prisma.pagamento.create({
            data: {
                DataPagamento: null,
                PrazoPagamento: dadosPagamento.DataLimite,
                Custo: dadosPagamento.Valor,
                EstadoPagamento: dadosPagamento.estado || 'Pendente',
                IdAluguer: null,
                IdMarcacao: dadosPagamento.IdMarcacao || null
            }
        });
    }
};

paymentRepository.criarPagamento = paymentRepository.create;

const buscarTodosPagamentos = async () => {
    try {
        return await prisma.pagamento.findMany({
            include: {
                Aluguer: true,
                Marcacao: {
                    include: {
                        Aluno: true,
                        Aula: true
                    }
                }
            },
            orderBy: [
                { DataPagamento: 'desc' },
                { PrazoPagamento: 'desc' }
            ]
        });
    } catch (error) {
        console.error('Erro buscarTodosPagamentos:', error);
        throw new Error('Erro ao buscar pagamentos');
    }
};

const buscarPagamentoPorId = async (idPagamento) => {
    return await prisma.pagamento.findUnique({
        where: { IdPagamento: idPagamento },
        include: {
            Aluguer: true,
            Marcacao: {
                include: {
                    Aluno: true,
                    Aula: true
                }
            }
        }
    });
};

const registarRecebimento = async (idPagamento) => {
    return await prisma.pagamento.update({
        where: { IdPagamento: idPagamento },
        data: {
            EstadoPagamento: 'Pago',
            DataPagamento: new Date()
        }
    });
};

module.exports = {
    ...paymentRepository,
    buscarTodosPagamentos,
    buscarPagamentoPorId,
    registarRecebimento
};
