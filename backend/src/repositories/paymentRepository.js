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

paymentRepository.criarPagamento = paymentRepository.create;

const buscarTodosPagamentos = async () => {
    try {
        return await prisma.pagamento.findMany({
            include: {
                Aluguer: true,
                Marcacao: {
                    include: {
                        Aluno: {
                            include: {
                                Utilizador: true
                            }
                        },
                        Aula: {
                            include: {
                                EstiloDanca: true,
                                Professor: {
                                    include: {
                                        Utilizador: true
                                    }
                                }
                            }
                        }
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

const buscarPagamentosPorAlunos = async (alunosIds) => {
    return await prisma.pagamento.findMany({
        where: {
            IdMarcacao: { not: null },
            Marcacao: {
                IdAluno: {
                    in: alunosIds
                }
            }
        },
        include: {
            Aluguer: true,
            Marcacao: {
                include: {
                    Aluno: {
                        include: {
                            Utilizador: true
                        }
                    },
                    Aula: {
                        include: {
                            EstiloDanca: true,
                            Professor: {
                                include: {
                                    Utilizador: true
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: [
            { DataPagamento: 'desc' },
            { PrazoPagamento: 'desc' }
        ]
    });
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
    buscarPagamentosPorAlunos,
    buscarPagamentoPorId,
    registarRecebimento
};
