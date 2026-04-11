const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const buscarTodos = async () => {
    return await prisma.aluguer.findMany({
        include: {
            Utilizador: true,
            ArtigoAluguer: {
                include: {
                    TamanhoArtigo: {
                        include: { Artigo: true }
                    }
                }
            }
        }
    });
};

const buscarStockArtigo = async (idTamanhoArtigo) => {
    return await prisma.tamanhoArtigo.findUnique({
        where: { IdTamanhoArtigo: idTamanhoArtigo }
    });
};

const criarComTransacao = async (idUtilizador, dataLevantamento, dataEntrega, listaArtigos) => {
    return await prisma.$transaction(async (tx) => {
        const novoAluguer = await tx.aluguer.create({
            data: {
                Utilizador: { connect: { IdUtilizador: idUtilizador } },
                DataLevantamento: new Date(dataLevantamento),
                DataEntrega: new Date(dataEntrega),
                EstadoAluguer: 'Pendente',
                ArtigoAluguer: {
                    create: listaArtigos.map((artigo) => ({
                        TamanhoArtigo: { connect: { IdTamanhoArtigo: artigo.IdTamanhoArtigo } },
                        Quantidade: artigo.Quantidade,
                        EstadoDevolucao: 'Por Levantar'
                    }))
                }
            }
        });

        for (const artigo of listaArtigos) {
            await tx.tamanhoArtigo.update({
                where: { IdTamanhoArtigo: artigo.IdTamanhoArtigo },
                data: {
                    Quantidade: { decrement: artigo.Quantidade }
                }
            });
        }

        return novoAluguer;
    });
};

module.exports = {
    buscarTodos,
    buscarStockArtigo,
    criarComTransacao
};
