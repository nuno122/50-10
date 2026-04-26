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
    },

    // Lookup methods used by classService (and mocked in tests)
    findProfessorById: async (idProfessor) => {
        return await prisma.professor.findUnique({
            where: { IdUtilizador: idProfessor }
        });
    },

    findEstudioById: async (idEstudio) => {
        return await prisma.estudio.findUnique({
            where: { IdEstudio: idEstudio }
        });
    },

    findEstiloById: async (idEstiloDanca) => {
        return await prisma.estiloDanca.findUnique({
            where: { IdEstiloDanca: idEstiloDanca }
        });
    }

};


const atualizarConfirmacaoProfessor = async (idAula) => {
    return await prisma.aula.update({
        where: { IdAula: idAula },
        data: { ConfirmacaoProfessor: true }
    });
};

const atualizarValidacaoDirecao = async (idAula) => {
    return await prisma.aula.update({
        where: { IdAula: idAula },
        data: { ValidacaoDirecao: true }
    });
};

const findByIdComAlunos = async (idAula) => {
    return await prisma.aula.findUnique({
        where: { IdAula: idAula },
        include: {
            Marcacao: {
                where: {
                    EstaAtivo: true
                },
                include: {
                    Utilizador: true // Aluno
                }
            }
        }
    });
};

module.exports = classRepository;
