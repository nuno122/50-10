const { PrismaClient } = require('@prisma/client');
const path = require('path');
const prisma = new PrismaClient();

const normalizeImagePath = (value) => {
    if (typeof value !== 'string') return null;

    const normalized = value.trim().replace(/\\/g, '/');
    if (!normalized) return null;

    if (normalized.startsWith('data:')) {
        return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
        try {
            const url = new URL(normalized);
            const urlFileName = path.basename(decodeURIComponent(url.pathname));
            return urlFileName || null;
        } catch (erro) {
            return null;
        }
    }

    const relativePath = normalized
        .replace(/^.*\/frontend\/images\//i, '')
        .replace(/^\.?\/*images\//i, '')
        .replace(/^\/+/, '');

    const filename = path.basename(relativePath);
    return filename || null;
};

const normalizeBoolean = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
};

const inventoryRepository = {
    findById: async (id) => {
        return await prisma.artigo.findUnique({
            where: { IdArtigo: id },
            include: {
                Criador: {
                    select: {
                        IdUtilizador: true,
                        NomeCompleto: true,
                        Email: true,
                        Permissoes: true
                    }
                },
                TamanhoArtigo: {
                    select: {
                        IdTamanhoArtigo: true,
                        Tamanho: true,
                        Quantidade: true,
                        Condicao: true
                    }
                }
            }
        });
    },

    // Buscar todos os artigos
    findAll: async () => {
        return await prisma.artigo.findMany({
            include: {
                Criador: {
                    select: {
                        IdUtilizador: true,
                        NomeCompleto: true,
                        Email: true,
                        Permissoes: true
                    }
                },
                TamanhoArtigo: {
                    select: {
                        IdTamanhoArtigo: true,
                        Tamanho: true,
                        Quantidade: true,
                        Condicao: true
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
                ImagemPath: normalizeImagePath(dados.ImagemPath),
                IdUtilizadorCriador: dados.IdUtilizadorCriador || null
            },
            include: {
                Criador: {
                    select: {
                        IdUtilizador: true,
                        NomeCompleto: true,
                        Email: true,
                        Permissoes: true
                    }
                },
                TamanhoArtigo: {
                    select: {
                        IdTamanhoArtigo: true,
                        Tamanho: true,
                        Quantidade: true,
                        Condicao: true
                    }
                }
            }
        });
    },

    // Atualizar um artigo existente
    update: async (id, dados) => {
        const payload = dados || {};
        const hasImagemPath = Object.prototype.hasOwnProperty.call(payload, 'ImagemPath');

        return await prisma.artigo.update({
            where: { IdArtigo: id },
            data: {
                Nome: payload.Nome,
                CustoPorDia: payload.CustoPorDia ? parseFloat(payload.CustoPorDia) : undefined,
                EstadoArtigo: normalizeBoolean(payload.EstadoArtigo),
                ImagemPath: hasImagemPath ? normalizeImagePath(payload.ImagemPath) : undefined
            },
            include: {
                Criador: {
                    select: {
                        IdUtilizador: true,
                        NomeCompleto: true,
                        Email: true,
                        Permissoes: true
                    }
                },
                TamanhoArtigo: {
                    select: {
                        IdTamanhoArtigo: true,
                        Tamanho: true,
                        Quantidade: true,
                        Condicao: true
                    }
                }
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
