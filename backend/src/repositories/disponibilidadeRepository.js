const prisma = require('../database/sqlServer');

const criar = async (dados) => {
    return await prisma.disponibilidade.create({
        data: dados
    });
};

const listarPorProfessor = async (idProfessor) => {
    return await prisma.disponibilidade.findMany({
        where: { IdProfessor: idProfessor },
        orderBy: { Data: 'asc' }
    });
};

module.exports = {
    criar,
    listarPorProfessor
};

