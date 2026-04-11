const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { query } = require('../database/sqlServer');

const utilizadorRepository = {
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
        return await prisma.utilizador.create({
            data: {
                NomeCompleto: dados.NomeCompleto,
                NomeUtilizador: dados.NomeUtilizador,
                Email: dados.Email,
                PalavraPasseHash: dados.PalavraPasseHash,
                Permissoes: dados.Permissoes,
                Nif: dados.Nif,
                EstaAtivo: true,
                Morada: dados.Morada,
                // Escondemos a complexidade da relação aqui
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: dados.CodigoPostal }
                }
            }
        });
    }
};

module.exports = utilizadorRepository;
