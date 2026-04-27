const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rentalRepository = {

    buscarTodos: async () => {
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
    },

    buscarPorId: async (IdAluguer) => {
        return await prisma.aluguer.findUnique({
            where: { IdAluguer },
            include: {
                ArtigoAluguer: {
                    include: {
                        TamanhoArtigo: {
                            include: { Artigo: true }
                        }
                    }
                },
                PedidoExtensao: true
            }
        });
    },

    buscarStockArtigo: async (idTamanhoArtigo) => {
        return await prisma.tamanhoArtigo.findUnique({
            where: { IdTamanhoArtigo: idTamanhoArtigo }
        });
    },

    criarComTransacao: async (idUtilizador, dataLevantamento, dataEntrega, listaArtigos) => {
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
                    data: { Quantidade: { decrement: artigo.Quantidade } }
                });
            }

            return novoAluguer;
        });
    },

    criarPedidoExtensao: async (idAluguer, novaDataProposta) => {
        return await prisma.pedidoExtensao.create({
            data: {
                IdAluguer: idAluguer,
                NovaDataProposta: new Date(novaDataProposta),
                EstadoAprovacao: 'Pendente',
                ValorAdicional: 0
            },
            include: { Aluguer: true }
        });
    },

    getPedidoExtensaoById: async (idPedido) => {
        return await prisma.pedidoExtensao.findUnique({
            where: { IdPedido: idPedido },
            include: { Aluguer: true }
        });
    },

    atualizarPedidoValorAdicional: async (idPedido, valorAdicional) => {
        return await prisma.pedidoExtensao.update({
            where: { IdPedido: idPedido },
            data: { ValorAdicional: valorAdicional }
        });
    },

    atualizarEstadoPedido: async (idPedido, estado) => {
        return await prisma.pedidoExtensao.update({
            where: { IdPedido: idPedido },
            data: { EstadoAprovacao: estado }
        });
    },

    atualizarAluguer: async (idAluguer, novaDataEntrega) => {
        return await prisma.aluguer.update({
            where: { IdAluguer: idAluguer },
            data: { DataEntrega: new Date(novaDataEntrega) }
        });
    },

    atualizarEstadoArtigo: async (IdAluguer, IdTamanhoArtigo, EstadoDevolucao) => {
        return await prisma.artigoAluguer.update({
            where: {
                IdTamanhoArtigo_IdAluguer: { IdTamanhoArtigo, IdAluguer }
            },
            data: { EstadoDevolucao }
        });
    },

    finalizarAluguer: async (IdAluguer) => {
        return await prisma.aluguer.update({
            where: { IdAluguer },
            data: { EstadoAluguer: 'Devolvido' }
        });
    }
};

module.exports = rentalRepository;