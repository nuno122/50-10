const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizeDateOnly = (value) => {
    const dateOnlyMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0));
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return date;
    }

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
};

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
                Data: normalizeDateOnly(data),
                EstaAtivo: true
            }
        });
    },

    findProfessorClassesByDate: async (idProfessor, data) => {
        return await prisma.aula.findMany({
            where: {
                IdProfessor: idProfessor,
                Data: normalizeDateOnly(data),
                EstaAtivo: true
            }
        });
    },

    findClassesByDate: async (data) => {
        return await prisma.aula.findMany({
            where: {
                Data: normalizeDateOnly(data),
                EstaAtivo: true
            }
        });
    },

    findProfessorAvailabilityByDate: async (idProfessor, data) => {
        return await prisma.disponibilidade.findMany({
            where: {
                IdProfessor: idProfessor,
                Data: normalizeDateOnly(data)
            },
            orderBy: {
                HoraInicio: 'asc'
            }
        });
    },

    create: async (dados) => {
        return await prisma.aula.create({
            data: {
                Data: normalizeDateOnly(dados.Data),
                HoraInicio: new Date(dados.HoraInicio),
                HoraFim: new Date(dados.HoraFim),
                CapacidadeMaxima: dados.CapacidadeMaxima,
                Preco: dados.Preco,
                ConfirmacaoProfessor: false,
                ValidacaoDirecao: false,
                EstaAtivo: true,
                TipoAula: dados.TipoAula || 'Regular',
                OrigemAula: dados.OrigemAula || 'Direcao',
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
                        Aluno: true,
                        Pagamento: true
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
                EstiloProfessor: {
                    include: {
                        EstiloDanca: true
                    }
                }
            }
        });
    },

    findEstudioById: async (idEstudio) => {
        return await prisma.estudio.findFirst({
            where: {
                IdEstudio: idEstudio,
                EstaAtivo: true
            },
            include: {
                EstudioEstilo: {
                    where: {
                        EstiloDanca: {
                            EstaAtivo: true
                        }
                    },
                    include: {
                        EstiloDanca: true
                    }
                }
            }
        });
    },

    findAllStudios: async () => {
        return await prisma.estudio.findMany({
            where: {
                EstaAtivo: true
            },
            include: {
                EstudioEstilo: {
                    where: {
                        EstiloDanca: {
                            EstaAtivo: true
                        }
                    },
                    include: {
                        EstiloDanca: true
                    }
                }
            }
        });
    },

    findEstiloById: async (idEstiloDanca) => {
        return await prisma.estiloDanca.findFirst({
            where: {
                IdEstiloDanca: idEstiloDanca,
                EstaAtivo: true
            }
        });
    },

    findById: async (idAula) => {
        return await prisma.aula.findUnique({
            where: { IdAula: idAula }
        });
    }
};

module.exports = classRepository;
