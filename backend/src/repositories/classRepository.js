const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const classRepository = {
    // Buscar todas as aulas com as relações
    findAll: async () => {
        return await prisma.aula.findMany({
            include: {
                Professor: true,
                Estudio: true,
                EstiloDanca: true
            }
        });
    },

    // Buscar aulas num estúdio e data específica (para validar sobreposição)
    findOverlapping: async (idEstudio, data) => {
        return await prisma.aula.findMany({
            where: {
                IdEstudio: idEstudio,
                Data: new Date(data)
            }
        });
    },

    // Criar a aula propriamente dita
    create: async (dados) => {
        return await prisma.aula.create({
            data: {
                Data: new Date(dados.Data),
                HoraInicio: new Date(dados.HoraInicio),
                HoraFim: new Date(dados.HoraFim),
                CapacidadeMaxima: dados.CapacidadeMaxima,
                Preco: dados.Preco,
                ConfirmacaoProfessor: false,
                ValidacaoDirecao: false,
                EstaAtivo: true,
                IdProfessor: dados.IdProfessor,
                IdEstudio: dados.IdEstudio,
                IdEstiloDanca: dados.IdEstiloDanca
            }
        });
    }
};

module.exports = classRepository;