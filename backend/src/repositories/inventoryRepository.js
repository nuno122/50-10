const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizeImagePath = (value) => {
    if (typeof value !== 'string') return null;

    const normalized = value.trim().replace(/\\/g, '/');
    if (!normalized) return null;

    if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) {
        return normalized;
    }

    const relativePath = normalized
        .replace(/^.*\/frontend\/images\//i, '')
        .replace(/^\.?\/*images\//i, '')
        .replace(/^\/+/, '');

    return relativePath || null;
};

const inventoryRepository = {
    // Buscar todos os artigos
    findAll: async () => {
        return await prisma.artigo.findMany({
            include: {
                TamanhoArtigo: {
                    select: {
                        IdTamanhoArtigo: true,
                        Tamanho: true,
                        Quantidade: true
                    }
                }
            }
        });
    },

    // Criar um novo artigo
    create: async (dados) => {
        return await prisma.artigo.create({
            data: {
                Nome: dados.Nome,
                CustoPorDia: parseFloat(dados.CustoPorDia),
                ImagemPath: normalizeImagePath(dados.ImagemPath)
            }
        });
    },

    // Atualizar um artigo existente
    update: async (id, dados) => {
        const hasImagemPath = Object.prototype.hasOwnProperty.call(dados || {}, 'ImagemPath');

        return await prisma.artigo.update({
            where: { IdArtigo: id },
            data: {
                Nome: dados.Nome,
                CustoPorDia: dados.CustoPorDia ? parseFloat(dados.CustoPorDia) : undefined,
                EstadoArtigo: dados.EstadoArtigo,
                ImagemPath: hasImagemPath ? normalizeImagePath(dados.ImagemPath) : undefined
            }
        });
    },

    // Remover um artigo
    delete: async (id) => {
        return await prisma.artigo.delete({
            where: { IdArtigo: id }
        });
    }
};

module.exports = inventoryRepository;
