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

const buildArticleWhere = (filters = {}) => {
    const where = {};
    const rentalFlag = normalizeBoolean(filters.DisponivelParaAluguer);

    if (rentalFlag !== undefined) {
        where.DisponivelParaAluguer = rentalFlag;
    }

    if (filters.IdUtilizadorCriador) {
        where.IdUtilizadorCriador = filters.IdUtilizadorCriador;
    }

    return where;
};

const articleInclude = {
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
};

const buildSizeCreatePayload = (sizes = []) => sizes.map((size) => ({
    Tamanho: size.Tamanho,
    Quantidade: size.Quantidade,
    Condicao: size.Condicao
}));

const buildArticleUpdatePayload = (payload = {}) => {
    const hasImagemPath = Object.prototype.hasOwnProperty.call(payload, 'ImagemPath');
    const hasSizes = Object.prototype.hasOwnProperty.call(payload, 'TamanhoArtigo');
    const sizes = Array.isArray(payload.TamanhoArtigo) ? payload.TamanhoArtigo : [];

    const data = {
        Nome: payload.Nome,
        CustoPorDia: payload.CustoPorDia ? parseFloat(payload.CustoPorDia) : undefined,
        EstadoArtigo: normalizeBoolean(payload.EstadoArtigo),
        DisponivelParaAluguer: normalizeBoolean(payload.DisponivelParaAluguer),
        ImagemPath: hasImagemPath ? normalizeImagePath(payload.ImagemPath) : undefined
    };

    if (hasSizes) {
        data.TamanhoArtigo = {
            upsert: sizes
                .filter((size) => size.IdTamanhoArtigo)
                .map((size) => ({
                    where: { IdTamanhoArtigo: size.IdTamanhoArtigo },
                    update: {
                        Tamanho: size.Tamanho,
                        Quantidade: size.Quantidade,
                        Condicao: size.Condicao
                    },
                    create: {
                        Tamanho: size.Tamanho,
                        Quantidade: size.Quantidade,
                        Condicao: size.Condicao
                    }
                })),
            create: buildSizeCreatePayload(sizes.filter((size) => !size.IdTamanhoArtigo))
        };
    }

    return data;
};

const inventoryRepository = {
    findById: async (id) => {
        return await prisma.artigo.findUnique({
            where: { IdArtigo: id },
            include: articleInclude
        });
    },

    findAll: async (filters = {}) => {
        return await prisma.artigo.findMany({
            where: buildArticleWhere(filters),
            include: articleInclude
        });
    },

    create: async (dados) => {
        const sizes = Array.isArray(dados.TamanhoArtigo) ? dados.TamanhoArtigo : [];

        return await prisma.artigo.create({
            data: {
                Nome: dados.Nome,
                CustoPorDia: parseFloat(dados.CustoPorDia),
                DisponivelParaAluguer: normalizeBoolean(dados.DisponivelParaAluguer) === true,
                ImagemPath: normalizeImagePath(dados.ImagemPath),
                IdUtilizadorCriador: dados.IdUtilizadorCriador || null,
                TamanhoArtigo: sizes.length > 0
                    ? { create: buildSizeCreatePayload(sizes) }
                    : undefined
            },
            include: articleInclude
        });
    },

    update: async (id, dados) => {
        return await prisma.artigo.update({
            where: { IdArtigo: id },
            data: buildArticleUpdatePayload(dados || {}),
            include: articleInclude
        });
    },

    delete: async (id) => {
        return await prisma.artigo.delete({
            where: { IdArtigo: id }
        });
    }
};

module.exports = inventoryRepository;
