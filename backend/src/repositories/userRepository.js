const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { query } = require('../database/sqlServer');
const PERMISSOES = require('../config/permissions');

const normalizeOptionalValue = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    const text = String(value).trim();
    return text ? text : null;
};

const normalizeRequiredValue = (value) => String(value || '').trim();
const normalizeStyleIds = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(
        value
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
    )];
};

const userRepository = {
    // Buscar todos
    findAll: async () => {
        try {
            return await prisma.utilizador.findMany({
                include: {
                    Aluno: true,
                    Professor: {
                        include: {
                            EstiloProfessor: {
                                include: {
                                    EstiloDanca: true
                                }
                            }
                        }
                    },
                    Encarregado: true
                }
            });
        } catch (error) {
            return await query(`
                SELECT
                    IdUtilizador,
                    CodigoPostal,
                    Morada,
                    Permissoes,
                    NomeCompleto,
                    NomeUtilizador,
                    Email,
                    NumeroTelemovel,
                    Nif,
                    EstaAtivo,
                    NumeroCartaoCidadao,
                    ValidadeCartaoCidadao,
                    CASE WHEN Permissoes = ${PERMISSOES.PROFESSOR} THEN 1 ELSE 0 END AS ProfessorValido
                FROM Utilizador
                ORDER BY NomeCompleto
            `);
        }
    },

    // Buscar um unico por Email (Usado no Login)
    findByEmail: async (email) => {
        return await prisma.utilizador.findUnique({
            where: { Email: email }
        });
    },

    findById: async (idUtilizador) => {
        return await prisma.utilizador.findUnique({
            where: { IdUtilizador: idUtilizador },
            include: {
                Aluno: true,
                Professor: {
                    include: {
                        EstiloProfessor: {
                            include: {
                                EstiloDanca: true
                            }
                        }
                    }
                },
                Encarregado: true
            }
        });
    },

    findAuthById: async (idUtilizador) => {
        return await prisma.utilizador.findUnique({
            where: { IdUtilizador: idUtilizador },
            select: {
                IdUtilizador: true,
                NomeCompleto: true,
                Email: true,
                Permissoes: true,
                EstaAtivo: true
            }
        });
    },

    findGuardianIdsByStudentIds: async (studentIds = []) => {
        const ids = [...new Set((Array.isArray(studentIds) ? studentIds : []).filter(Boolean))];
        if (ids.length === 0) {
            return [];
        }

        return await prisma.encarregadoAluno.findMany({
            where: {
                IdAluno: {
                    in: ids
                }
            },
            select: {
                IdEncarregado: true,
                IdAluno: true
            }
        });
    },

    updatePasswordHash: async (idUtilizador, palavraPasseHash) => {
        return await prisma.utilizador.update({
            where: { IdUtilizador: idUtilizador },
            data: { PalavraPasseHash: palavraPasseHash }
        });
    },

    // Criar Utilizador com as relacoes chatas
    create: async (dados) => {
        const { Permissoes } = dados;
        const styleIds = normalizeStyleIds(dados.IdsEstiloDanca);

        return await prisma.utilizador.create({
            data: {
                NomeCompleto: normalizeRequiredValue(dados.NomeCompleto),
                NomeUtilizador: normalizeRequiredValue(dados.NomeUtilizador),
                Email: normalizeRequiredValue(dados.Email),
                PalavraPasseHash: dados.PalavraPasseHash,
                Permissoes,
                Nif: normalizeRequiredValue(dados.Nif),
                Morada: normalizeRequiredValue(dados.Morada),
                NumeroTelemovel: normalizeOptionalValue(dados.NumeroTelemovel),
                EstaAtivo: true,
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: normalizeRequiredValue(dados.CodigoPostal) }
                },

                ...(Permissoes === PERMISSOES.PROFESSOR && {
                    Professor: {
                        create: {
                            Iban: normalizeOptionalValue(dados.Iban),
                            EstiloProfessor: styleIds.length > 0
                                ? {
                                    create: styleIds.map((idEstiloDanca) => ({
                                        EstiloDanca: {
                                            connect: { IdEstiloDanca: idEstiloDanca }
                                        }
                                    }))
                                }
                                : undefined
                        }
                    }
                }),
                ...(Permissoes === PERMISSOES.ENCARREGADO && {
                    Encarregado: {
                        create: {}
                    }
                })
            },
            include: {
                Aluno: true,
                Professor: {
                    include: {
                        EstiloProfessor: {
                            include: {
                                EstiloDanca: true
                            }
                        }
                    }
                },
                Encarregado: true
            }
        });
    },

    update: async (idUtilizador, dados) => {
        const styleIds = normalizeStyleIds(dados.IdsEstiloDanca);

        return await prisma.utilizador.update({
            where: { IdUtilizador: idUtilizador },
            data: {
                NomeCompleto: normalizeRequiredValue(dados.NomeCompleto),
                NomeUtilizador: normalizeRequiredValue(dados.NomeUtilizador),
                Email: normalizeRequiredValue(dados.Email),
                ...(dados.PalavraPasseHash ? { PalavraPasseHash: dados.PalavraPasseHash } : {}),
                Nif: normalizeRequiredValue(dados.Nif),
                Morada: normalizeRequiredValue(dados.Morada),
                NumeroTelemovel: normalizeOptionalValue(dados.NumeroTelemovel),
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: normalizeRequiredValue(dados.CodigoPostal) }
                },
                ...(dados.Permissoes === PERMISSOES.PROFESSOR && {
                    Professor: {
                        update: {
                            Iban: normalizeOptionalValue(dados.Iban),
                            EstiloProfessor: {
                                deleteMany: {},
                                ...(styleIds.length > 0
                                    ? {
                                        create: styleIds.map((idEstiloDanca) => ({
                                            EstiloDanca: {
                                                connect: { IdEstiloDanca: idEstiloDanca }
                                            }
                                        }))
                                    }
                                    : {})
                            }
                        }
                    }
                })
            },
            include: {
                Aluno: true,
                Professor: {
                    include: {
                        EstiloProfessor: {
                            include: {
                                EstiloDanca: true
                            }
                        }
                    }
                },
                Encarregado: true
            }
        });
    },

    updateStatus: async (idUtilizador, estaAtivo) => {
        return await prisma.utilizador.update({
            where: { IdUtilizador: idUtilizador },
            data: { EstaAtivo: estaAtivo },
            include: {
                Aluno: true,
                Professor: {
                    include: {
                        EstiloProfessor: {
                            include: {
                                EstiloDanca: true
                            }
                        }
                    }
                },
                Encarregado: true
            }
        });
    }
};

module.exports = userRepository;
