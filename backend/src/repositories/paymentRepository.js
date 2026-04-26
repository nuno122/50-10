const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const paymentRepository = {
    // Criar pagamento
    criarPagamento: async (dadosPagamento) => {
        return await prisma.pagamento.create({
            data: {
                DataPagamento: null, // A definir após confirmação
                PrazoPagamento: dadosPagamento.DataLimite,
                Custo: dadosPagamento.Valor,
                EstadoPagamento: dadosPagamento.estado || 'Pendente',
                IdAluguer: null, // Para marcações será null
                IdMarcacao: dadosPagamento.IdMarcacao || dadosPagamento.IdMarcacao, // Para aulas
                IdAluno: dadosPagamento.IdAluno,
                IdAula: dadosPagamento.IdAula
            }
        });
    },

    // Alias usado pelo paymentService.GerarPagamento
    create: async (dadosPagamento) => {
        return await prisma.pagamento.create({
            data: {
                DataPagamento: null,
                PrazoPagamento: dadosPagamento.DataLimite,
                Custo: dadosPagamento.Valor,
                EstadoPagamento: dadosPagamento.estado || 'Pendente',
                IdAluguer: null,
                IdAluno: dadosPagamento.IdAluno,
            }
        });
    }
};

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
            orderBy: { DataPagamento: 'desc' }
        });
    } catch (error) {
        console.error('Erro buscarTodosPagamentos:', error);
        throw new Error('Erro ao buscar pagamentos');
    }
};

module.exports = {
    ...paymentRepository,
    buscarTodosPagamentos
};
