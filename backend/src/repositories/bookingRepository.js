const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const create = async (idAluno, idAula) => {
    return await prisma.marcacao.create({
        data: {
            Aluno: { connect: { IdUtilizador: idAluno } },
            Aula: { connect: { IdAula: idAula } },
            EstaAtivo: true,
            PresencaConfirmada: false
        }
    });
};

const bookingRepository = {
    findAll: async () => {
        return await prisma.marcacao.findMany({
            include: { Aluno: true, Aula: true }
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
            include: { Marcacao: true }
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
            include: {
                Aula: true
            }
        });
    },

    findByAluno: async (idAluno) => {
        return await prisma.marcacao.findMany({
            where: { IdAluno: idAluno },
            include: {
                Aula: {
                    include: {
                        EstiloDanca: true,
                        Estudio: true
                    }
                },
                Pagamento: true
            },
            orderBy: { Aula: { Data: 'desc' } }
        });
    },

    findStudentsByGuardian: async (idEncarregado) => {
        return await prisma.encarregadoAluno.findMany({
            where: { IdEncarregado: idEncarregado },
            include: {
                Aluno: {
                    include: {
                        Utilizador: true
                    }
                }
            }
        });
    },

    create,

    cancelar: async (idMarcacao, motivoOuEstado) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: false,
                MotivoCancelamento: motivoOuEstado === 'Pendente_Cancelamento'
                    ? 'Pedido pelo aluno'
                    : (motivoOuEstado ?? 'Cancelado pelo aluno')
            }
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

    RegistarPedidoCancelamento: async (idMarcacao, aprovado = false) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo: aprovado,
                MotivoCancelamento: aprovado ? null : 'Pedido pelo aluno'
            }
        });
    }
};

module.exports = bookingRepository;
