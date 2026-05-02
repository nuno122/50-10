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

const userRepository = {
    // Buscar todos
    findAll: async () => {
        try {
            return await prisma.utilizador.findMany({
                include: {
                    Aluno: true,
                    Professor: {
                        include: {
                            EstiloProfessor: true
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
                        EstiloProfessor: true
                    }
                },
                Encarregado: true
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

                ...(Permissoes === PERMISSOES.ALUNO && {
                    Aluno: {
                        create: {
                            DataNascimento: dados.DataNascimento,
                            Informacao: dados.Informacao ?? null
                        }
                    }
                }),
                ...(Permissoes === PERMISSOES.PROFESSOR && {
                    Professor: {
                        create: {
                            Iban: normalizeOptionalValue(dados.Iban)
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
                        EstiloProfessor: true
                    }
                },
                Encarregado: true
            }
        });
    },

    update: async (idUtilizador, dados) => {
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
                            Iban: normalizeOptionalValue(dados.Iban)
                        }
                    }
                })
            },
            include: {
                Aluno: true,
                Professor: {
                    include: {
                        EstiloProfessor: true
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
                        EstiloProfessor: true
                    }
                },
                Encarregado: true
            }
        });
    }
};

module.exports = userRepository;
