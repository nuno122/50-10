const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { query } = require('../database/sqlServer');
const PERMISSOES = require('../config/permissions');


const userRepository = {
    // Buscar todos
    findAll: async () => {
        try {
            return await prisma.utilizador.findMany();
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
                    ValidadeCartaoCidadao
                FROM Utilizador
                ORDER BY NomeCompleto
            `);
        }
    },

    // Buscar um único por Email (Usado no Login)
    findByEmail: async (email) => {
        return await prisma.utilizador.findUnique({
            where: { Email: email }
        });
    },

    // Criar Utilizador com as relações chatas
create: async (dados) => {
    const { Permissoes } = dados;

    return await prisma.utilizador.create({
        data: {
            NomeCompleto:    dados.NomeCompleto,
            NomeUtilizador:  dados.NomeUtilizador,
            Email:           dados.Email,
            PalavraPasseHash: dados.PalavraPasseHash,
            Permissoes,
            Nif:             dados.Nif,
            Morada:          dados.Morada,
            NumeroTelemovel: dados.NumeroTelemovel,
            EstaAtivo:       true,
            CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                connect: { CodigoPostal: dados.CodigoPostal }
            },

            ...(Permissoes === 1 && {
                Aluno: {
                    create: {
                        DataNascimento: dados.DataNascimento,
                        Informacao:     dados.Informacao ?? null
                    }
                }
            }),
            ...(Permissoes === 2 && {
                Professor: {
                    create: {
                        Iban: dados.Iban ?? null
                    }
                }
            }),
            ...(Permissoes === 4 && {
                Encarregado: {
                    create: {}
                }
            })
        },
        include: {
            Aluno:      true,
            Professor:  true,
            Encarregado: true
        }
    });
}
};

module.exports = userRepository;
