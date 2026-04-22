const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const classRepository = {
    findAll: async () => {
        return await prisma.aula.findMany({
            include: {
                Professor: {
                    include: {
                        Utilizador: true
                    }
                },
                Estudio: true,
                EstiloDanca: true,
                Marcacao: {
                    where: {
                        EstaAtivo: true
                    }
                }
            }
        });
    },

    findOverlapping: async (idEstudio, data) => {
        return await prisma.aula.findMany({
            where: {
                IdEstudio: idEstudio,
                Data: new Date(data)
            }
        });
    },

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
    },

    atualizarConfirmacaoProfessor: async (idAula) => {
        return await prisma.aula.update({
            where: { IdAula: idAula },
            data: { ConfirmacaoProfessor: true }
        });
    },

    atualizarValidacaoDirecao: async (idAula) => {
        return await prisma.aula.update({
            where: { IdAula: idAula },
            data: { ValidacaoDirecao: true }
        });
    },

    findByIdComAlunos: async (idAula) => {
        return await prisma.aula.findUnique({
            where: { IdAula: idAula },
            include: {
                Marcacao: {
                    where: {
                        EstaAtivo: true
                    },
                    include: {
                        Aluno: true
                    }
                }
            }
        });
    }
};

module.exports = classRepository;
