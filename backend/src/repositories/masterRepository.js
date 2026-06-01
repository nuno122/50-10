const prisma = require('../database/prisma');

const buildStudioStyleRelationQuery = (incluirInativos = false) => ({
    ...(incluirInativos ? {} : {
        where: {
            EstiloDanca: {
                EstaAtivo: true
            }
        }
    }),
    include: {
        EstiloDanca: true
    }
});

const findAllEstudios = async ({ incluirInativos = false } = {}) => {
    return await prisma.estudio.findMany({
        where: incluirInativos ? undefined : {
            EstaAtivo: true
        },
        orderBy: incluirInativos
            ? [
                { EstaAtivo: 'desc' },
                { Numero: 'asc' }
            ]
            : {
                Numero: 'asc'
            },
        include: {
            EstudioEstilo: buildStudioStyleRelationQuery(incluirInativos)
        }
    });
};

const findAllEstilos = async ({ incluirInativos = false } = {}) => {
    return await prisma.estiloDanca.findMany({
        where: incluirInativos ? undefined : {
            EstaAtivo: true
        },
        orderBy: incluirInativos
            ? [
                { EstaAtivo: 'desc' },
                { Nome: 'asc' }
            ]
            : {
                Nome: 'asc'
            }
    });
};

const findEstudioById = async (id, { incluirInativos = true } = {}) => {
    return await prisma.estudio.findFirst({
        where: {
            IdEstudio: id,
            ...(incluirInativos ? {} : { EstaAtivo: true })
        },
        include: {
            EstudioEstilo: buildStudioStyleRelationQuery(true),
            _count: {
                select: {
                    Aula: true
                }
            }
        }
    });
};

const findEstudioByNumero = async (numero) => {
    return await prisma.estudio.findFirst({
        where: { Numero: numero }
    });
};

const createEstudio = async ({ Numero, Capacidade, IdsEstiloDanca = [] }) => {
    return await prisma.$transaction(async (tx) => {
        const estudio = await tx.estudio.create({
            data: {
                Numero,
                Capacidade,
                EstaAtivo: true
            }
        });

        for (const IdEstiloDanca of IdsEstiloDanca) {
            await tx.estudioEstilo.create({
                data: {
                    IdEstudio: estudio.IdEstudio,
                    IdEstiloDanca
                }
            });
        }

        return await tx.estudio.findFirst({
            where: { IdEstudio: estudio.IdEstudio },
            include: {
                EstudioEstilo: buildStudioStyleRelationQuery(true)
            }
        });
    });
};

const updateEstudio = async (id, { Numero, Capacidade, IdsEstiloDanca = [] }) => {
    return await prisma.$transaction(async (tx) => {
        await tx.estudio.update({
            where: { IdEstudio: id },
            data: {
                Numero,
                Capacidade
            }
        });

        await tx.estudioEstilo.deleteMany({
            where: { IdEstudio: id }
        });

        for (const IdEstiloDanca of IdsEstiloDanca) {
            await tx.estudioEstilo.create({
                data: {
                    IdEstudio: id,
                    IdEstiloDanca
                }
            });
        }

        return await tx.estudio.findFirst({
            where: { IdEstudio: id },
            include: {
                EstudioEstilo: buildStudioStyleRelationQuery(true)
            }
        });
    });
};

const updateEstudioStatus = async (id, EstaAtivo) => {
    return await prisma.estudio.update({
        where: { IdEstudio: id },
        data: { EstaAtivo }
    });
};

const findActiveAulasByEstudio = async (idEstudio, dataMinima = new Date(0)) => {
    return await prisma.aula.findMany({
        where: {
            IdEstudio: idEstudio,
            EstaAtivo: true,
            Data: {
                gte: dataMinima
            }
        },
        include: {
            EstiloDanca: {
                select: {
                    IdEstiloDanca: true,
                    Nome: true
                }
            },
            Marcacao: {
                where: {
                    EstaAtivo: true
                },
                select: {
                    IdMarcacao: true
                }
            }
        },
        orderBy: [
            { Data: 'asc' },
            { HoraInicio: 'asc' }
        ]
    });
};

const findEstiloById = async (id, { incluirInativos = true } = {}) => {
    return await prisma.estiloDanca.findFirst({
        where: {
            IdEstiloDanca: id,
            ...(incluirInativos ? {} : { EstaAtivo: true })
        },
        include: {
            EstudioEstilo: {
                include: {
                    Estudio: true
                }
            },
            _count: {
                select: {
                    Aula: true,
                    PedidoAula: true,
                    EstiloProfessor: true,
                    EstudioEstilo: true
                }
            }
        }
    });
};

const findEstiloByNome = async (nome) => {
    return await prisma.estiloDanca.findFirst({
        where: { Nome: nome }
    });
};

const findEstilosByIds = async (ids = [], { incluirInativos = false } = {}) => {
    return await prisma.estiloDanca.findMany({
        where: {
            IdEstiloDanca: {
                in: ids
            },
            ...(incluirInativos ? {} : { EstaAtivo: true })
        }
    });
};

const createEstilo = async ({ Nome }) => {
    return await prisma.estiloDanca.create({
        data: {
            Nome,
            EstaAtivo: true
        }
    });
};

const updateEstilo = async (id, { Nome }) => {
    return await prisma.estiloDanca.update({
        where: { IdEstiloDanca: id },
        data: { Nome }
    });
};

const updateEstiloStatus = async (id, EstaAtivo) => {
    return await prisma.estiloDanca.update({
        where: { IdEstiloDanca: id },
        data: { EstaAtivo }
    });
};

const findActiveAulasByEstilo = async (idEstiloDanca, dataMinima = new Date(0)) => {
    return await prisma.aula.findMany({
        where: {
            IdEstiloDanca: idEstiloDanca,
            EstaAtivo: true,
            Data: {
                gte: dataMinima
            }
        },
        include: {
            Estudio: {
                select: {
                    IdEstudio: true,
                    Numero: true
                }
            },
            Marcacao: {
                where: {
                    EstaAtivo: true
                },
                select: {
                    IdMarcacao: true
                }
            }
        },
        orderBy: [
            { Data: 'asc' },
            { HoraInicio: 'asc' }
        ]
    });
};

const findPendingPedidosByEstilo = async (idEstiloDanca, dataMinima = new Date(0)) => {
    return await prisma.pedidoAula.findMany({
        where: {
            IdEstiloDanca: idEstiloDanca,
            DataPretendida: {
                gte: dataMinima
            },
            EstadoPedido: {
                in: ['PendenteProfessor', 'PendenteDirecao']
            }
        },
        select: {
            IdPedidoAulaPrivada: true,
            DataPretendida: true,
            HoraPretendida: true,
            EstadoPedido: true
        },
        orderBy: [
            { DataPretendida: 'asc' },
            { HoraPretendida: 'asc' }
        ]
    });
};

const findActiveStudiosByEstilo = async (idEstiloDanca) => {
    return await prisma.estudio.findMany({
        where: {
            EstaAtivo: true,
            EstudioEstilo: {
                some: {
                    IdEstiloDanca: idEstiloDanca
                }
            }
        },
        include: {
            EstudioEstilo: buildStudioStyleRelationQuery(false)
        },
        orderBy: {
            Numero: 'asc'
        }
    });
};

const findAllProfessores = async () => {
    return await prisma.professor.findMany({
        include: {
            Utilizador: {
                select: {
                    IdUtilizador: true,
                    NomeCompleto: true,
                    Email: true,
                    EstaAtivo: true
                }
            },
            EstiloProfessor: {
                include: {
                    EstiloDanca: true
                }
            }
        }
    });
};

const findAllPaises = async () => {
    return await prisma.pais.findMany();
};

const findAllDistritos = async () => {
    return await prisma.distrito.findMany({
        include: { Cidade: true }
    });
};

module.exports = {
    findAllEstudios,
    findAllEstilos,
    findEstudioById,
    findEstudioByNumero,
    createEstudio,
    updateEstudio,
    updateEstudioStatus,
    findActiveAulasByEstudio,
    findEstiloById,
    findEstiloByNome,
    findEstilosByIds,
    createEstilo,
    updateEstilo,
    updateEstiloStatus,
    findActiveAulasByEstilo,
    findPendingPedidosByEstilo,
    findActiveStudiosByEstilo,
    findAllProfessores,
    findAllPaises,
    findAllDistritos
};
