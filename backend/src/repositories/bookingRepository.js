const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bookingRepository = {
    // Procurar todas as marcações com detalhes
    findAll: async () => {
        return await prisma.marcacao.findMany({
            include: { Aluno: true, Aula: true }
        });
    },

    // Procurar um aluno específico
    findAlunoById: async (idUtilizador) => {
        return await prisma.aluno.findUnique({
            where: { IdUtilizador: idUtilizador }
        });
    },

    // Procurar uma aula com as suas marcações (para contar vagas)
    findAulaWithMarcacoes: async (idAula) => {
        return await prisma.aula.findUnique({
            where: { IdAula: idAula },
            include: { Marcacao: true }
        });
    },

    // Verificar se já existe uma inscrição ativa
    findExisting: async (idAluno, idAula) => {
        return await prisma.marcacao.findFirst({
            where: {
                IdAluno: idAluno,
                IdAula: idAula,
                EstaAtivo: true  // ← ignorar canceladas
            }
        });
    },

    // Procurar uma marcação pelo ID
    findById: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao }
        });
    },

    // Procurar todas as marcações de um aluno
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

    // Criar a marcação
    create: async (idAluno, idAula) => {
        return await prisma.marcacao.create({
            data: {
                Aluno: { connect: { IdUtilizador: idAluno } },
                Aula:  { connect: { IdAula: idAula } },
                EstaAtivo:          true,
                PresencaConfirmada: false
            }
        });
    },

    // Cancelar uma marcação
    cancelar: async (idMarcacao, motivo) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: {
                EstaAtivo:          false,
                MotivoCancelamento: motivo ?? 'Cancelado pelo aluno'
            }
        });
    },

    // Criar pagamento associado à marcação
    criarPagamento: async (idMarcacao, custo, prazoPagamento) => {
        return await prisma.pagamento.create({
            data: {
                IdMarcacao:      idMarcacao,
                Custo:           custo,
                PrazoPagamento:  prazoPagamento,
                EstadoPagamento: 'Pendente'
            }
        });
    }
};

module.exports = bookingRepository;