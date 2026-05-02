const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const findProfessorById = async (idProfessor) => {
    return await prisma.professor.findUnique({
        where: { IdUtilizador: idProfessor }
    });
};

const findByProfessor = async (idProfessor, range = {}) => {
    const where = {
        IdProfessor: idProfessor
    };

    if (range.from || range.to) {
        where.Data = {};

        if (range.from) {
            where.Data.gte = new Date(range.from);
        }

        if (range.to) {
            where.Data.lte = new Date(range.to);
        }
    }

    return await prisma.disponibilidade.findMany({
        where,
        orderBy: [
            { Data: 'asc' },
            { HoraInicio: 'asc' }
        ]
    });
};

const findAll = async (range = {}) => {
    const where = {};

    if (range.from || range.to) {
        where.Data = {};

        if (range.from) {
            where.Data.gte = new Date(range.from);
        }

        if (range.to) {
            where.Data.lte = new Date(range.to);
        }
    }

    return await prisma.disponibilidade.findMany({
        where,
        orderBy: [
            { Data: 'asc' },
            { HoraInicio: 'asc' }
        ]
    });
};

const buildWhereForScope = (idProfessor, scope) => {
    const where = {
        IdProfessor: idProfessor
    };

    if (scope.type === 'dates') {
        where.Data = {
            in: scope.dates.map((date) => new Date(date))
        };
        return where;
    }

    where.Data = {
        gte: new Date(scope.from),
        lte: new Date(scope.to)
    };

    return where;
};

const replaceByProfessorInScope = async (idProfessor, { scope, disponibilidades }) => {
    const where = buildWhereForScope(idProfessor, scope);

    return await prisma.$transaction(async (tx) => {
        await tx.disponibilidade.deleteMany({
            where
        });

        if (disponibilidades.length > 0) {
            await tx.disponibilidade.createMany({
                data: disponibilidades.map((item) => ({
                    IdProfessor: idProfessor,
                    Data: new Date(item.Data),
                    HoraInicio: new Date(item.HoraInicio),
                    HoraFim: new Date(item.HoraFim)
                }))
            });
        }

        return await tx.disponibilidade.findMany({
            where,
            orderBy: [
                { Data: 'asc' },
                { HoraInicio: 'asc' }
            ]
        });
    });
};

module.exports = {
    findProfessorById,
    findByProfessor,
    findAll,
    replaceByProfessorInScope
};
