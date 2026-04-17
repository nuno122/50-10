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
                IdAluno: idAluno,
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
    },

    // NOVA: Encontrar marcação com aula associada
    findByIdComAula: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao },
            include: {
                Aula: true
            }
        });
    },

    // NOVA: Atualizar estado da marcação
    atualizarEstadoCancelamento: async (idMarcacao, estado) => {
        return await prisma.marcacao.update({
            where: { IdMarcacao: idMarcacao },
            data: { 
                EstaAtivo: false,
                MotivoCancelamento: estado === 'Pendente_Cancelamento' ? 'Pedido pelo aluno' : estado
            }
        });
    }
};

module.exports = bookingRepository;
