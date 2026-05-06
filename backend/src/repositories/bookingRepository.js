const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ESTADOS_CANCELAMENTO = {
    SEM_PEDIDO: 'SemPedido',
    PENDENTE: 'Pendente',
    APROVADO_AUTOMATICO: 'AprovadoAutomatico',
    APROVADO_DIRECAO: 'AprovadoDirecao',
    REJEITADO_DIRECAO: 'RejeitadoDirecao'
};

const utilizadorResumoSelect = {
    IdUtilizador: true,
    NomeCompleto: true,
    Email: true,
    Permissoes: true
};

const aulaResumoInclude = {
    EstiloDanca: true,
    Estudio: true,
    Professor: {
        include: {
            Utilizador: {
                select: utilizadorResumoSelect
            }
        }
    }
};

const marcacaoDetalhadaInclude = {
    Aluno: {
        include: {
            Utilizador: {
                select: utilizadorResumoSelect
            }
        }
    },
    Aula: {
        include: aulaResumoInclude
    },
    Pagamento: true,
    DiretorCancelamento: {
        select: {
            IdUtilizador: true,
            NomeCompleto: true
        }
    }
};

const create = async (idAluno, idAula) => {
    return await prisma.marcacao.create({
        data: {
            Aluno: { connect: { IdUtilizador: idAluno } },
            Aula: { connect: { IdAula: idAula } },
            EstaAtivo: true,
            PresencaConfirmada: false,
            EstadoCancelamento: ESTADOS_CANCELAMENTO.SEM_PEDIDO
        }
    });
};

const bookingRepository = {
    ESTADOS_CANCELAMENTO,

    findAll: async () => {
        return await prisma.marcacao.findMany({
            include: marcacaoDetalhadaInclude,
            orderBy: [
                { Aula: { Data: 'desc' } },
                { IdMarcacao: 'desc' }
            ]
        });
    },

    findAlunoById: async (idUtilizador) => {
        return await prisma.aluno.findUnique({
            where: { IdUtilizador: idUtilizador }
        });
    },

    findAulaWithMarcacoes: async (idAula) => {
        return await prisma.aula.findUnique({
            where: { IdAula: idAula },
            include: {
                Marcacao: true
            }
        });
    },

    findExisting: async (idAluno, idAula) => {
        return await prisma.marcacao.findFirst({
            where: {
                IdAluno: idAluno,
                IdAula: idAula,
                EstaAtivo: true
            }
        });
    },

    findById: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao }
        });
    },

    findByIdComAula: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao },
            include: marcacaoDetalhadaInclude
        });
    },

    findByAluno: async (idAluno) => {
        return await prisma.marcacao.findMany({
            where: { IdAluno: idAluno },
            include: {
                Aula: {
                    include: aulaResumoInclude
                },
                Pagamento: true,
                DiretorCancelamento: {
                    select: {
                        IdUtilizador: true,
                        NomeCompleto: true
                    }
                }
            },
            orderBy: [
                { Aula: { Data: 'desc' } },
                { IdMarcacao: 'desc' }
            ]
        });
    },

    findStudentsByGuardian: async (idEncarregado) => {
        return await prisma.encarregadoAluno.findMany({
            where: { IdEncarregado: idEncarregado },
            include: {
                Aluno: {
                    include: {
                        Utilizador: {
                            select: utilizadorResumoSelect
                        }
                    }
                }
            }
        });
    },

    findPendingCancellationRequests: async () => {
        return await prisma.marcacao.findMany({
            where: {
                EstadoCancelamento: ESTADOS_CANCELAMENTO.PENDENTE
            },
            include: marcacaoDetalhadaInclude,
            orderBy: [
                { DataPedidoCancelamento: 'desc' },
                { IdMarcacao: 'desc' }
            ]
        });
    },

    create,

    cancelar: async (idMarcacao, motivo, estadoCancelamento = ESTADOS_CANCELAMENTO.APROVADO_AUTOMATICO) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: false,
                MotivoCancelamento: motivo ?? 'Cancelado pelo aluno',
                EstadoCancelamento: estadoCancelamento,
                DataPedidoCancelamento: new Date(),
                DataDecisaoCancelamento: new Date(),
                ObservacaoDirecaoCancelamento: estadoCancelamento === ESTADOS_CANCELAMENTO.APROVADO_AUTOMATICO
                    ? 'Cancelamento processado automaticamente com antecedencia minima de 24h.'
                    : null
            },
            include: marcacaoDetalhadaInclude
        });
    },

    criarPagamento: async (idMarcacao, custo, prazoPagamento) => {
        return await prisma.pagamento.create({
            data: {
                IdMarcacao: idMarcacao,
                Custo: custo,
                PrazoPagamento: prazoPagamento,
                EstadoPagamento: 'Pendente'
            }
        });
    },

    RegistarPedidoCancelamento: async (idMarcacao, motivo) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: true,
                MotivoCancelamento: motivo ?? 'Pedido pelo encarregado/aluno',
                EstadoCancelamento: ESTADOS_CANCELAMENTO.PENDENTE,
                DataPedidoCancelamento: new Date(),
                DataDecisaoCancelamento: null,
                ObservacaoDirecaoCancelamento: null,
                IdDiretorCancelamento: null
            },
            include: marcacaoDetalhadaInclude
        });
    },

    aprovarPedidoCancelamento: async (idMarcacao, idDiretor, observacao) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: false,
                EstadoCancelamento: ESTADOS_CANCELAMENTO.APROVADO_DIRECAO,
                DataDecisaoCancelamento: new Date(),
                ObservacaoDirecaoCancelamento: observacao ?? null,
                IdDiretorCancelamento: idDiretor
            },
            include: marcacaoDetalhadaInclude
        });
    },

    rejeitarPedidoCancelamento: async (idMarcacao, idDiretor, observacao) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: true,
                EstadoCancelamento: ESTADOS_CANCELAMENTO.REJEITADO_DIRECAO,
                DataDecisaoCancelamento: new Date(),
                ObservacaoDirecaoCancelamento: observacao ?? null,
                IdDiretorCancelamento: idDiretor
            },
            include: marcacaoDetalhadaInclude
        });
    }
};

module.exports = bookingRepository;
