const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const findAllEstudios = async () => {
    return await prisma.estudio.findMany();
};

const findAllEstilos = async () => {
    return await prisma.estiloDanca.findMany();
};

const findAllPaises = async () => {
    return await prisma.pais.findMany();
};

const findAllDistritos = async () => {
    return await prisma.distrito.findMany({
        include: { Cidade: true } 
    });
};

const findPagamentosEntreDatas = async (inicio, fim) => {
    return await prisma.pagamento.findMany({
        where: {
            PrazoPagamento: {
                gte: inicio,
                lte: fim
            }
        },
        orderBy: { PrazoPagamento: 'asc' }
    });
}

module.exports = {
    findAllEstudios,
    findAllEstilos,
    findAllPaises,
    findAllDistritos,
    findPagamentosEntreDatas  // ← adiciona isto
};