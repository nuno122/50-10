const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const buscarTodos = async () => {
    return await prisma.aluguer.findMany({
        include: {
            Utilizador: true,
            PedidoExtensao: {
                orderBy: {
                    DataPedido: 'desc'
                }
            },
            Pagamento: true,
            ArtigoAluguer: {
                include: {
                    TamanhoArtigo: {
                        include: { Artigo: true }
                    }
                }
            }
        },
        orderBy: {
            DataLevantamento: 'desc'
        }
    });
};

const getAluguerById = async (idAluguer) => {
    return await prisma.aluguer.findUnique({
        where: { IdAluguer: idAluguer },
        include: {
            Utilizador: true,
            PedidoExtensao: true,
            Pagamento: true,
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

const criarPedidoExtensao = async (idAluguer, novaDataProposta) => {
    return await prisma.pedidoExtensao.create({
        data: {
            IdAluguer: idAluguer,
            NovaDataProposta: new Date(novaDataProposta),
            EstadoAprovacao: 'Pendente',
            ValorAdicional: 0
        },
        include: {
            Aluguer: true
        }
    });
};

const atualizarPedidoValorAdicional = async (idPedido, valorAdicional) => {
    return await prisma.pedidoExtensao.update({
        where: { IdPedido: idPedido },
        data: {
            ValorAdicional: valorAdicional
        }
    });
};

const getPedidoExtensaoById = async (idPedido) => {
    return await prisma.pedidoExtensao.findUnique({
        where: { IdPedido: idPedido },
        include: {
            Aluguer: true
        }
    });
};

const atualizarEstadoPedido = async (idPedido, estado) => {
    return await prisma.pedidoExtensao.update({
        where: { IdPedido: idPedido },
        data: { EstadoAprovacao: estado }
    });
};

const atualizarAluguer = async (idAluguer, novaDataEntrega) => {
    return await prisma.aluguer.update({
        where: { IdAluguer: idAluguer },
        data: {
            DataEntrega: new Date(novaDataEntrega)
        }
    });
};

const registarDevolucao = async (idAluguer, estadoEntrega, multa = 0) => {
    return await prisma.$transaction(async (tx) => {
        const aluguer = await tx.aluguer.findUnique({
            where: { IdAluguer: idAluguer },
            include: {
                ArtigoAluguer: true
            }
        });

        if (!aluguer) {
            return null;
        }

        for (const item of aluguer.ArtigoAluguer) {
            await tx.tamanhoArtigo.update({
                where: { IdTamanhoArtigo: item.IdTamanhoArtigo },
                data: {
                    Quantidade: { increment: item.Quantidade }
                }
            });

            await tx.artigoAluguer.update({
                where: {
                    IdTamanhoArtigo_IdAluguer: {
                        IdTamanhoArtigo: item.IdTamanhoArtigo,
                        IdAluguer: item.IdAluguer
                    }
                },
                data: {
                    EstadoDevolucao: estadoEntrega
                }
            });
        }

        await tx.aluguer.update({
            where: { IdAluguer: idAluguer },
            data: {
                EstadoAluguer: 'Entregue'
            }
        });

        if (Number(multa) > 0) {
            await tx.pagamento.create({
                data: {
                    IdAluguer: idAluguer,
                    DataPagamento: null,
                    PrazoPagamento: new Date(),
                    Custo: multa,
                    EstadoPagamento: 'Pendente'
                }
            });
        }

        return await tx.aluguer.findUnique({
            where: { IdAluguer: idAluguer },
            include: {
                Utilizador: true,
                PedidoExtensao: true,
                Pagamento: true,
                ArtigoAluguer: {
                    include: {
                        TamanhoArtigo: {
                            include: { Artigo: true }
                        }
                    }
                }
            }
        });
    });
};

module.exports = {
    buscarTodos,
    getAluguerById,
    buscarStockArtigo,
    criarComTransacao,
    create: criarPedidoExtensao,
    criarPedidoExtensao,
    atualizarPedidoValorAdicional,
    getPedidoExtensaoById,
    atualizarEstadoPedido,
    atualizarAluguer,
    registarDevolucao
};
