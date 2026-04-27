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
                EstaAtivo: true  // Mantido: ignora canceladas para permitir nova inscrição
            }
        });
    },

    // Procurar uma marcação pelo ID
    findById: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao }
        });
    },

    // NOVA: Encontrar marcação com aula associada (unificado)
    findByIdComAula: async (idMarcacao) => {
        return await prisma.marcacao.findUnique({
            where: { IdMarcacao: idMarcacao },
            include: {
                Aula: true
            }
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
    create,

    // Cancelar uma marcação (Unificado: aceita motivo ou estado)
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
