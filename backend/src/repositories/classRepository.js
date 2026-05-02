const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GetAulasDisponiveis = async () => {
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
                },
                include: {
                    Aluno: {
                        include: {
                            Utilizador: true
                        }
                    }
                }
            }
        }
    });
};

const ValidarConclusaoAula = async (idAula, confirmado = true) => {
    return await prisma.aula.update({
        where: { IdAula: idAula },
        data: { ConfirmacaoProfessor: confirmado }
    });
};

const classRepository = {
    GetAulasDisponiveis,
    findAll: GetAulasDisponiveis,

    findOverlapping: async (idEstudio, data) => {
        return await prisma.aula.findMany({
            where: {
                IdEstudio: idEstudio,
                Data: new Date(data)
            }
        });
    },

    findProfessorAvailabilityByDate: async (idProfessor, data) => {
        return await prisma.disponibilidade.findMany({
            where: {
                IdProfessor: idProfessor,
                Data: new Date(data)
            },
            orderBy: {
                HoraInicio: 'asc'
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
                TipoAula: dados.TipoAula || 'Regular',
                IdProfessor: dados.IdProfessor,
                IdEstudio: dados.IdEstudio,
                IdEstiloDanca: dados.IdEstiloDanca
            }
        });
    },

    ValidarConclusaoAula,
    atualizarConfirmacaoProfessor: (idAula) => ValidarConclusaoAula(idAula, true),

    atualizarValidacaoDirecao: async (idAula) => {
        return await prisma.aula.update({
            where: { IdAula: idAula },
            data: { ValidacaoDirecao: true }
        });
    },

    cancelarAula: async (idAula) => {
        return await prisma.aula.update({
            where: { IdAula: idAula },
            data: { EstaAtivo: false },
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
                    },
                    include: {
                        Aluno: {
                            include: {
                                Utilizador: true
                            }
                        }
                    }
                }
            }
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
            where: { IdUtilizador: idProfessor },
            include: {
                EstiloProfessor: true
            }
        });
    },

    findEstudioById: async (idEstudio) => {
        return await prisma.estudio.findUnique({
            where: { IdEstudio: idEstudio },
            include: {
                EstudioEstilo: true
            }
        });
    },

    findEstiloById: async (idEstiloDanca) => {
        return await prisma.estiloDanca.findUnique({
            where: { IdEstiloDanca: idEstiloDanca }
        });
    },

    findById: async (idAula) => {
        return await prisma.aula.findUnique({
            where: { IdAula: idAula }
        });
    }
};

module.exports = classRepository;
