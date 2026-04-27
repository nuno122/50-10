const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
                CustoPorDia: parseFloat(dados.CustoPorDia) // Garante que é número
            }
        });
    },

    // Atualizar um artigo existente
    update: async (id, dados) => {
        return await prisma.artigo.update({
            where: { IdArtigo: id },
            data: {
                Nome: dados.Nome,
                CustoPorDia: dados.CustoPorDia ? parseFloat(dados.CustoPorDia) : undefined,
                EstadoArtigo: dados.EstadoArtigo
            }
        });
    },

    // Remover um artigo
    delete: async (id) => {
        return await prisma.artigo.delete({
            where: { IdArtigo: id }
        });
    },
    
    setEstado: async (idArtigo, estado) => {
    return await prisma.artigo.update({
        where: { IdArtigo: idArtigo },
        data: { EstadoArtigo: estado }
    });
}
};

module.exports = inventoryRepository;