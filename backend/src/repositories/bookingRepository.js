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

    // Verificar se já existe uma inscrição específica
    findExisting: async (idAluno, idAula) => {
        return await prisma.marcacao.findFirst({
            where: {
                IdAluno: idAluno, // Assumindo que a FK no Prisma é IdAluno
                IdAula: idAula
            }
        });
    },

    // Criar a marcação
    create: async (idAluno, idAula) => {
        return await prisma.marcacao.create({
            data: {
                Aluno: { connect: { IdUtilizador: idAluno } },
                Aula: { connect: { IdAula: idAula } },
                EstaAtivo: true,
                PresencaConfirmada: false
            }
        });
    }
};

module.exports = bookingRepository;