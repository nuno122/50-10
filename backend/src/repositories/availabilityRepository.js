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
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    const match = String(value || '').match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '';
};

const buildIsoTime = (dateKey, timeValue) => `${dateKey}T${timeValue}:00.000Z`;

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

const mergeAvailabilityEntries = (disponibilidades = []) => {
    const normalized = disponibilidades
        .map((item) => ({
            Data: normalizeDateKey(item.Data),
            HoraInicio: extractTime(item.HoraInicio),
            HoraFim: extractTime(item.HoraFim)
        }))
        .filter((item) => item.Data && item.HoraInicio && item.HoraFim)
        .sort((left, right) => {
            if (left.Data !== right.Data) {
                return left.Data.localeCompare(right.Data);
            }

            return toMinutes(left.HoraInicio) - toMinutes(right.HoraInicio);
        });

    const merged = [];

    normalized.forEach((current) => {
        const previous = merged[merged.length - 1];

        if (
            previous &&
            previous.Data === current.Data &&
            intervalsOverlap(previous.HoraInicio, previous.HoraFim, current.HoraInicio, current.HoraFim)
        ) {
            if (toMinutes(current.HoraFim) > toMinutes(previous.HoraFim)) {
                previous.HoraFim = current.HoraFim;
            }
            return;
        }

        if (
            previous &&
            previous.Data === current.Data &&
            previous.HoraInicio === current.HoraInicio &&
            previous.HoraFim === current.HoraFim
        ) {
            return;
        }

        merged.push({ ...current });
    });

    return merged.map((item) => ({
        Data: item.Data,
        HoraInicio: buildIsoTime(item.Data, item.HoraInicio),
        HoraFim: buildIsoTime(item.Data, item.HoraFim)
    }));
};

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

        let finalDisponibilidades = [...disponibilidades];

        if (removidas.length > 0 || finalDisponibilidades.length > 0) {
            const aulas = await tx.aula.findMany({
                where: {
                    IdProfessor: idProfessor,
                    EstaAtivo: true,
                    Data: where.Data
                }
            });

            const aulasSemDisponibilidade = aulas.filter((aula) => {
                const aulaDateKey = normalizeDateKey(aula.Data);

                return !finalDisponibilidades.some((disponibilidade) => (
                    normalizeDateKey(disponibilidade.Data) === aulaDateKey &&
                    intervalContains(disponibilidade.HoraInicio, disponibilidade.HoraFim, aula.HoraInicio, aula.HoraFim)
                ));
            });

            if (aulasSemDisponibilidade.length > 0) {
                finalDisponibilidades = mergeAvailabilityEntries([
                    ...finalDisponibilidades,
                    ...aulasSemDisponibilidade.map((aula) => {
                        const aulaDateKey = normalizeDateKey(aula.Data);

                        return {
                            Data: aulaDateKey,
                            HoraInicio: buildIsoTime(aulaDateKey, extractTime(aula.HoraInicio)),
                            HoraFim: buildIsoTime(aulaDateKey, extractTime(aula.HoraFim))
                        };
                    })
                ]);
            }
        }

        await tx.disponibilidade.deleteMany({
            where
        });

        if (finalDisponibilidades.length > 0) {
            await tx.disponibilidade.createMany({
                data: finalDisponibilidades.map((item) => ({
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
