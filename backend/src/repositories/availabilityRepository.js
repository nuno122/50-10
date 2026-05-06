const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalizeDateKey = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const extractTime = (value) => {
    const match = String(value || '').match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '';
};

const toMinutes = (value) => {
    const [hours, minutes] = String(extractTime(value) || value || '00:00').split(':').map(Number);
    return (hours * 60) + minutes;
};

const intervalsOverlap = (inicioA, fimA, inicioB, fimB) => (
    toMinutes(inicioA) < toMinutes(fimB) && toMinutes(fimA) > toMinutes(inicioB)
);

const intervalContains = (containerInicio, containerFim, inicio, fim) => (
    toMinutes(containerInicio) <= toMinutes(inicio) && toMinutes(containerFim) >= toMinutes(fim)
);

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

    if (range.idProfessor) {
        where.IdProfessor = range.idProfessor;
    }

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
        include: {
            Professor: {
                include: {
                    Utilizador: {
                        select: {
                            IdUtilizador: true,
                            NomeCompleto: true,
                            Email: true
                        }
                    }
                }
            }
        },
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
        const atuais = await tx.disponibilidade.findMany({
            where,
            orderBy: [
                { Data: 'asc' },
                { HoraInicio: 'asc' }
            ]
        });

        const nextKeys = new Set(disponibilidades.map((item) => (
            `${normalizeDateKey(item.Data)}|${extractTime(item.HoraInicio)}|${extractTime(item.HoraFim)}`
        )));

        const removidas = atuais.filter((item) => !nextKeys.has(
            `${normalizeDateKey(item.Data)}|${extractTime(item.HoraInicio)}|${extractTime(item.HoraFim)}`
        ));

        if (removidas.length > 0) {
            const datasRemovidas = [...new Set(removidas.map((item) => normalizeDateKey(item.Data)).filter(Boolean))];
            const aulas = await tx.aula.findMany({
                where: {
                    IdProfessor: idProfessor,
                    EstaAtivo: true,
                    Data: {
                        in: datasRemovidas.map((date) => new Date(date))
                    }
                }
            });

            const aulaSemDisponibilidade = aulas.find((aula) => {
                const aulaDateKey = normalizeDateKey(aula.Data);
                const estavaCoberta = removidas.some((disponibilidade) => (
                    normalizeDateKey(disponibilidade.Data) === aulaDateKey &&
                    intervalsOverlap(disponibilidade.HoraInicio, disponibilidade.HoraFim, aula.HoraInicio, aula.HoraFim)
                ));

                if (!estavaCoberta) {
                    return false;
                }

                return !disponibilidades.some((disponibilidade) => (
                    normalizeDateKey(disponibilidade.Data) === aulaDateKey &&
                    intervalContains(disponibilidade.HoraInicio, disponibilidade.HoraFim, aula.HoraInicio, aula.HoraFim)
                ));
            });

            if (aulaSemDisponibilidade) {
                const erro = new Error('Nao e possivel remover disponibilidade com aulas ja marcadas nesse horario.');
                erro.statusCode = 400;
                throw erro;
            }
        }

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
