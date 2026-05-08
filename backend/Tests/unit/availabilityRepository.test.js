jest.mock('@prisma/client');

const { PrismaClient } = require('@prisma/client');
const availabilityRepository = require('../../src/repositories/availabilityRepository');

describe('Availability Repository', () => {
    const prisma = PrismaClient.mock.results[0].value;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('deve preservar a cobertura de uma aula ativa ao substituir a disponibilidade', async () => {
        prisma.disponibilidade.findMany
            .mockResolvedValueOnce([
                {
                    IdDisponibilidade: 'disp-1',
                    Data: new Date('2026-05-05T00:00:00.000Z'),
                    HoraInicio: new Date('1970-01-01T09:00:00.000Z'),
                    HoraFim: new Date('1970-01-01T12:00:00.000Z')
                }
            ])
            .mockResolvedValueOnce([
                {
                    IdDisponibilidade: 'disp-2',
                    Data: new Date('2026-05-05T00:00:00.000Z'),
                    HoraInicio: new Date('2026-05-05T10:00:00.000Z'),
                    HoraFim: new Date('2026-05-05T12:00:00.000Z')
                }
            ]);

        prisma.aula.findMany.mockResolvedValue([
            {
                IdAula: 'aula-1',
                Data: new Date('2026-05-05T00:00:00.000Z'),
                HoraInicio: new Date('1970-01-01T10:00:00.000Z'),
                HoraFim: new Date('1970-01-01T11:00:00.000Z'),
                EstaAtivo: true
            }
        ]);

        prisma.disponibilidade.deleteMany.mockResolvedValue({ count: 1 });
        prisma.disponibilidade.createMany.mockResolvedValue({ count: 1 });

        await availabilityRepository.replaceByProfessorInScope('prof-1', {
            scope: {
                type: 'dates',
                dates: ['2026-05-05']
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T10:30:00.000Z',
                    HoraFim: '2026-05-05T12:00:00.000Z'
                }
            ]
        });

        expect(prisma.disponibilidade.createMany).toHaveBeenCalledTimes(1);

        const payload = prisma.disponibilidade.createMany.mock.calls[0][0].data;
        expect(payload).toHaveLength(1);
        expect(payload[0].Data.toISOString()).toBe('2026-05-05T00:00:00.000Z');
        expect(payload[0].HoraInicio.toISOString()).toBe('2026-05-05T10:00:00.000Z');
        expect(payload[0].HoraFim.toISOString()).toBe('2026-05-05T12:00:00.000Z');
    });
});
