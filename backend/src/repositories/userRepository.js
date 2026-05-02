const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { query } = require('../database/sqlServer');
const PERMISSOES = require('../config/permissions');

const userRepository = {
    // Buscar todos
    findAll: async () => {
        try {
            return await prisma.utilizador.findMany({
                include: {
                    Aluno: true,
                    Professor: true,
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
                Professor: true,
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
                NomeCompleto: dados.NomeCompleto,
                NomeUtilizador: dados.NomeUtilizador,
                Email: dados.Email,
                PalavraPasseHash: dados.PalavraPasseHash,
                Permissoes,
                Nif: dados.Nif,
                Morada: dados.Morada,
                NumeroTelemovel: dados.NumeroTelemovel,
                EstaAtivo: true,
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: dados.CodigoPostal }
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
                            Iban: dados.Iban ?? null
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
                Professor: true,
                Encarregado: true
            }
        });
    },

    update: async (idUtilizador, dados) => {
        return await prisma.utilizador.update({
            where: { IdUtilizador: idUtilizador },
            data: {
                NomeCompleto: dados.NomeCompleto,
                NomeUtilizador: dados.NomeUtilizador,
                Email: dados.Email,
                ...(dados.PalavraPasseHash ? { PalavraPasseHash: dados.PalavraPasseHash } : {}),
                Nif: dados.Nif,
                Morada: dados.Morada,
                NumeroTelemovel: dados.NumeroTelemovel,
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: dados.CodigoPostal }
                },
                ...(dados.Permissoes === PERMISSOES.PROFESSOR && {
                    Professor: {
                        update: {
                            Iban: dados.Iban ?? null
                        }
                    }
                })
            },
            include: {
                Aluno: true,
                Professor: true,
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
                Professor: true,
                Encarregado: true
            }
        });
    }
};

module.exports = userRepository;
